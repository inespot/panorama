import type {
  Connector,
  FetchContext,
  OAuthResult,
  OAuthTokens,
  TypedWorkItem,
  LinkedItem,
  WorkItemStatus,
} from '@panorama/shared';
import { githubGraphQL, SEARCH_ITEMS_QUERY } from './graphql.js';
import { detectAction } from './action-detection.js';
import { extractPriorityFromLabels } from './parse-priority.js';
import { extractLinkedItemsFromPR } from './parse-linked-items.js';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

function getClientCredentials() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth credentials not configured');
  }
  return { clientId, clientSecret };
}

function mapPrStatus(state: string, isDraft: boolean): WorkItemStatus {
  if (isDraft) return 'open';
  if (state === 'MERGED') return 'done';
  if (state === 'CLOSED') return 'closed';
  return 'in_review';
}

function mapIssueStatus(state: string): WorkItemStatus {
  if (state === 'CLOSED') return 'closed';
  return 'open';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type GQLSearchResult = {
  search: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: any[];
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export const githubConnector: Connector = {
  id: 'github',
  displayName: 'GitHub',
  itemTypes: ['github-pr', 'github-issue'],

  getAuthUrl(redirectUri: string): string {
    const { clientId } = getClientCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user read:org public_repo',
    });
    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  },

  async handleCallback(code: string, _redirectUri: string): Promise<OAuthResult> {
    const { clientId, clientSecret } = getClientCredentials();

    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      throw new Error(`GitHub token exchange failed: ${tokenData.error ?? 'unknown'}`);
    }

    const userRes = await fetch(`${GITHUB_API_URL}/user`, {
      headers: { Authorization: `bearer ${tokenData.access_token}`, 'User-Agent': 'Panorama/1.0' },
    });
    const user = (await userRes.json()) as { login: string };

    return {
      tokens: { accessToken: tokenData.access_token },
      userIdentity: user.login,
    };
  },

  async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error('GitHub OAuth tokens are long-lived and do not require refresh');
  },

  async fetchItems(context: FetchContext): Promise<TypedWorkItem[]> {
    const { token, since, userId, config } = context;
    const orgs = (config.githubOrgs as string[] | undefined) ?? [];

    const items: TypedWorkItem[] = [];

    const queries = buildSearchQueries(userId, orgs, since);

    for (const searchQuery of queries) {
      let after: string | null = null;
      let hasNext = true;

      while (hasNext) {
        const result: GQLSearchResult = await githubGraphQL<GQLSearchResult>(token, SEARCH_ITEMS_QUERY, {
          query: searchQuery,
          after,
        });

        for (const node of result.search.nodes) {
          if (!node) continue;
          if (node.__typename === 'PullRequest') {
            items.push(normalizePR(node, userId));
          } else if (node.__typename === 'Issue') {
            items.push(normalizeIssue(node));
          }
        }

        hasNext = result.search.pageInfo.hasNextPage;
        after = result.search.pageInfo.endCursor;
      }
    }

    return deduplicateItems(items);
  },
};

function buildSearchQueries(userId: string, orgs: string[], since: Date | null): string[] {
  const dateFilter = since ? ` updated:>=${since.toISOString().split('T')[0]}` : ' is:open';
  const queries: string[] = [];

  queries.push(`user:${userId} involves:${userId}${dateFilter}`);

  for (const org of orgs) {
    queries.push(`org:${org} involves:${userId}${dateFilter}`);
  }

  return queries;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizePR(node: any, userId: string): TypedWorkItem {
  const repoName = node.repository.nameWithOwner;
  const labels = (node.labels?.nodes ?? []).map((l: any) => l.name);
  const isAuthor = node.author?.login === userId;

  const reviewRequests = (node.reviewRequests?.nodes ?? [])
    .map((r: any) => r.requestedReviewer?.login)
    .filter(Boolean);

  const reviews = (node.reviews?.nodes ?? []).map((r: any) => ({
    author: r.author?.login ?? '',
    state: r.state,
  }));

  const reviewThreads = (node.reviewThreads?.nodes ?? []).map((t: any) => ({
    isResolved: t.isResolved,
    comments: (t.comments?.nodes ?? []).map((c: any) => ({ author: c.author?.login ?? '' })),
  }));

  const actionNeeded = detectAction(userId, isAuthor, reviewRequests, reviews, reviewThreads);
  const linkedItems: LinkedItem[] = extractLinkedItemsFromPR(node.title, node.body);

  return {
    type: 'github-pr',
    data: {
      sourceId: `github-pr-${node.number}-${repoName}`,
      sourceUrl: node.url,
      title: node.title,
      description: node.body ?? null,
      status: mapPrStatus(node.state, node.isDraft),
      actionNeeded,
      assignee: node.assignees?.nodes?.[0]?.login ?? null,
      labels: labels.length > 0 ? labels : null,
      group: repoName,
      linkedItems: linkedItems.length > 0 ? linkedItems : null,
      metadata: null,
      summary: null,
      summarizedAt: null,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    },
  };
}

function normalizeIssue(node: any): TypedWorkItem {
  const repoName = node.repository.nameWithOwner;
  const labels = (node.labels?.nodes ?? []).map((l: any) => l.name);

  return {
    type: 'github-issue',
    data: {
      sourceId: `github-issue-${node.number}-${repoName}`,
      sourceUrl: node.url,
      title: node.title,
      description: node.body ?? null,
      status: mapIssueStatus(node.state),
      priority: extractPriorityFromLabels(labels),
      assignee: node.assignees?.nodes?.[0]?.login ?? null,
      labels: labels.length > 0 ? labels : null,
      group: repoName,
      linkedItems: null,
      metadata: null,
      summary: null,
      summarizedAt: null,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function deduplicateItems(items: TypedWorkItem[]): TypedWorkItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.data.sourceId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
