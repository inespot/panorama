import type { LinkedItem } from '@panorama/shared';

const GITHUB_PR_URL_PATTERN = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/g;

/**
 * Extracts GitHub PR URLs from text (Jira ticket description or comments).
 * Returns linked items with type `github-pr`, the PR number, and full URL.
 */
export function extractGithubPrUrls(text: string): LinkedItem[] {
  const seen = new Set<string>();
  const items: LinkedItem[] = [];

  for (const match of text.matchAll(GITHUB_PR_URL_PATTERN)) {
    const url = match[0];
    const prNumber = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      items.push({ type: 'github-pr', identifier: `#${prNumber}`, url });
    }
  }

  return items;
}
