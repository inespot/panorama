import type { LinkedItem } from '@panorama/shared';

const JIRA_KEY_PATTERN = /\b([A-Z][A-Z0-9_]+-\d+)\b/g;

/**
 * Extracts Jira ticket keys from text (e.g. PR title/description).
 * Returns linked items without URLs (GitHub connector can't construct Jira URLs).
 */
export function extractJiraKeysFromText(text: string): LinkedItem[] {
  const seen = new Set<string>();
  const items: LinkedItem[] = [];

  for (const match of text.matchAll(JIRA_KEY_PATTERN)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ type: 'jira-ticket', identifier: key });
    }
  }

  return items;
}

/**
 * Extracts linked items from PR title and body combined.
 */
export function extractLinkedItemsFromPR(title: string, body: string | null): LinkedItem[] {
  const combined = body ? `${title}\n${body}` : title;
  return extractJiraKeysFromText(combined);
}
