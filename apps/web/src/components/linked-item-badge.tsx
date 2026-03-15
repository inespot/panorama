import type { LinkedItem } from '@panorama/shared';
import { cn } from '../lib/utils.js';

const TYPE_LABELS: Record<string, string> = {
  'github-pr': 'github-pr',
  'github-issue': 'github-issue',
  'jira-ticket': 'jira',
};

interface LinkedItemBadgeProps {
  item: LinkedItem;
}

/** Clickable badge when URL available, display-only otherwise. */
export function LinkedItemBadge({ item }: LinkedItemBadgeProps) {
  const label = `${TYPE_LABELS[item.type] ?? item.type}:${item.identifier}`;

  const baseClasses =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)]';

  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(baseClasses, 'text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] cursor-pointer')}
      >
        {label}
      </a>
    );
  }

  return (
    <span className={cn(baseClasses, 'text-[var(--color-muted)]')}>
      {label}
    </span>
  );
}
