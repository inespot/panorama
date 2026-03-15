import type {
  Connector,
  FetchContext,
  OAuthResult,
  OAuthTokens,
  TypedWorkItem,
  LinkedItem,
  WorkItemStatus,
} from '@panorama/shared';
import { extractGithubPrUrls } from './parse-linked-items.js';

const JIRA_AUTH_URL = 'https://auth.atlassian.com/authorize';
const JIRA_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const JIRA_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

function getClientCredentials() {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Jira OAuth credentials not configured');
  }
  return { clientId, clientSecret };
}

function mapJiraStatus(statusCategory: string): WorkItemStatus {
  switch (statusCategory) {
    case 'new':
      return 'open';
    case 'indeterminate':
      return 'in_progress';
    case 'done':
      return 'done';
    default:
      return 'open';
  }
}

async function jiraFetch(siteUrl: string, path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${siteUrl}/rest/api/3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (res.status === 429) {
    const err = new Error('Jira API rate limit exceeded');
    (err as NodeJS.ErrnoException).code = 'RATE_LIMITED';
    throw err;
  }

  if (!res.ok) {
    throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export const jiraConnector: Connector = {
  id: 'jira',
  displayName: 'Jira',
  itemTypes: ['jira-ticket'],

  getAuthUrl(redirectUri: string): string {
    const { clientId } = getClientCredentials();
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: 'read:jira-work read:jira-user offline_access',
      redirect_uri: redirectUri,
      response_type: 'code',
      prompt: 'consent',
    });
    return `${JIRA_AUTH_URL}?${params.toString()}`;
  },

  async handleCallback(code: string, redirectUri: string): Promise<OAuthResult> {
    const { clientId, clientSecret } = getClientCredentials();

    const tokenRes = await fetch(JIRA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };

    if (!tokenData.access_token) {
      throw new Error(`Jira token exchange failed: ${tokenData.error ?? 'unknown'}`);
    }

    const resourcesRes = await fetch(JIRA_RESOURCES_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
    });
    const resources = (await resourcesRes.json()) as Array<{ id: string; url: string; name: string }>;

    if (resources.length === 0) {
      throw new Error('No accessible Jira Cloud sites found');
    }

    const site = resources[0];
    const siteUrl = `https://api.atlassian.com/ex/jira/${site.id}`;

    const meRes = await fetch(`${siteUrl}/rest/api/3/myself`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
    });
    const me = (await meRes.json()) as { accountId: string };

    return {
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
      },
      userIdentity: me.accountId,
      siteUrl,
    };
  },

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getClientCredentials();

    const res = await fetch(JIRA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };

    if (!data.access_token) {
      throw new Error(`Jira token refresh failed: ${data.error ?? 'unknown'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  },

  async fetchItems(context: FetchContext): Promise<TypedWorkItem[]> {
    const { token, since, userId, siteUrl } = context;
    if (!siteUrl) throw new Error('Jira siteUrl is required in FetchContext');

    const browseUrl = await resolveBrowseUrl(siteUrl, token);

    let jql = `assignee = "${userId}"`;
    if (since) {
      const sinceStr = since.toISOString().replace('T', ' ').substring(0, 19);
      jql += ` AND updated >= "${sinceStr}"`;
    } else {
      jql += ' AND statusCategory != Done';
    }

    const items: TypedWorkItem[] = [];
    const maxResults = 50;
    const fields = 'summary,description,status,priority,labels,assignee,created,updated,comment,parent,project';
    let nextPageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        jql,
        maxResults: String(maxResults),
        fields,
      });
      if (nextPageToken) {
        params.set('nextPageToken', nextPageToken);
      }

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const data = (await jiraFetch(siteUrl, `/search/jql?${params}`, token)) as {
        issues: any[];
        nextPageToken?: string;
      };
      /* eslint-enable @typescript-eslint/no-explicit-any */

      for (const issue of data.issues) {
        items.push(normalizeTicket(issue, browseUrl));
      }

      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return items;
  },
};

/** Resolves the human-readable Jira site URL (e.g. https://mysite.atlassian.net) from the API URL. */
async function resolveBrowseUrl(apiSiteUrl: string, token: string): Promise<string> {
  const cloudId = apiSiteUrl.match(/ex\/jira\/(.+)/)?.[1];
  if (!cloudId) return apiSiteUrl;

  try {
    const res = await fetch(JIRA_RESOURCES_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const resources = (await res.json()) as Array<{ id: string; url: string }>;
    const site = resources.find((r) => r.id === cloudId);
    if (site?.url) return site.url.replace(/\/$/, '');
  } catch {
    /* fall through */
  }
  return apiSiteUrl;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeTicket(issue: any, browseUrl: string): TypedWorkItem {
  const fields = issue.fields;
  const statusCategory = fields.status?.statusCategory?.key ?? 'new';
  const labels: string[] = fields.labels ?? [];

  const epicName = fields.parent?.fields?.summary ?? null;
  const projectName = fields.project?.name ?? null;
  const group = epicName ?? projectName;

  const sourceUrl = `${browseUrl}/browse/${issue.key}`;

  const descriptionText = extractTextFromADF(fields.description);
  const commentTexts = (fields.comment?.comments ?? [])
    .map((c: any) => extractTextFromADF(c.body))
    .join('\n');
  const allText = `${descriptionText}\n${commentTexts}`;
  const linkedItems: LinkedItem[] = extractGithubPrUrls(allText);

  return {
    type: 'jira-ticket',
    data: {
      sourceId: `jira-${issue.key}`,
      sourceUrl: sourceUrl || issue.self,
      title: fields.summary ?? issue.key,
      description: descriptionText || null,
      status: mapJiraStatus(statusCategory),
      priority: fields.priority?.name ?? null,
      assignee: fields.assignee?.displayName ?? null,
      labels: labels.length > 0 ? labels : null,
      group,
      linkedItems: linkedItems.length > 0 ? linkedItems : null,
      metadata: null,
      summary: null,
      summarizedAt: null,
      createdAt: fields.created,
      updatedAt: fields.updated,
    },
  };
}

function extractTextFromADF(doc: any): string {
  if (!doc || typeof doc !== 'object') return '';
  if (doc.type === 'text') return doc.text ?? '';

  if (Array.isArray(doc.content)) {
    return doc.content.map((node: any) => extractTextFromADF(node)).join('');
  }

  return '';
}
/* eslint-enable @typescript-eslint/no-explicit-any */
