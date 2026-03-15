const PRIORITY_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /^P0$/i, value: 'P0' },
  { pattern: /^P1$/i, value: 'P1' },
  { pattern: /^P2$/i, value: 'P2' },
  { pattern: /^P3$/i, value: 'P3' },
  { pattern: /^P4$/i, value: 'P4' },
  { pattern: /^priority[:/]critical$/i, value: 'critical' },
  { pattern: /^priority[:/]high$/i, value: 'high' },
  { pattern: /^priority[:/]medium$/i, value: 'medium' },
  { pattern: /^priority[:/]low$/i, value: 'low' },
];

/**
 * Extracts a priority string from a list of GitHub issue labels.
 * Returns the first matching priority, or null if none match.
 */
export function extractPriorityFromLabels(labels: string[]): string | null {
  for (const label of labels) {
    for (const { pattern, value } of PRIORITY_PATTERNS) {
      if (pattern.test(label)) return value;
    }
  }
  return null;
}
