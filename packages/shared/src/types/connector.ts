import type { GitHubIssue, GitHubPR, JiraTicket } from './work-items';

/** Tokens returned from an OAuth flow. */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
}

/** Result of handling an OAuth callback — tokens plus user identity. */
export interface OAuthResult {
  tokens: OAuthTokens;
  userIdentity: string;
  siteUrl?: string;
}

/** Context passed to a connector's fetchItems method. */
export interface FetchContext {
  token: string;
  since: Date | null;
  userId: string;
  siteUrl: string | null;
  config: Record<string, unknown>;
}

/** Discriminated union of typed work items returned by connectors. */
export type TypedWorkItem =
  | { type: 'github-pr'; data: Omit<GitHubPR, 'id' | 'syncedAt'> }
  | { type: 'github-issue'; data: Omit<GitHubIssue, 'id' | 'syncedAt'> }
  | { type: 'jira-ticket'; data: Omit<JiraTicket, 'id' | 'syncedAt'> };

/** Plugin interface that each source connector implements. */
export interface Connector {
  id: string;
  displayName: string;
  itemTypes: string[];

  /** Build the OAuth authorization URL for this source. */
  getAuthUrl(redirectUri: string): string;

  /** Exchange an OAuth code for tokens and fetch user identity. */
  handleCallback(code: string, redirectUri: string): Promise<OAuthResult>;

  /** Refresh an expired access token. No-op for sources with long-lived tokens. */
  refreshToken(refreshToken: string): Promise<OAuthTokens>;

  /** Fetch and normalize work items from the source. */
  fetchItems(context: FetchContext): Promise<TypedWorkItem[]>;
}
