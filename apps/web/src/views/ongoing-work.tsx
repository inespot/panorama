import { useState, useEffect, useMemo } from 'react';
import { Search, Eye, EyeOff, Settings, RefreshCw } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { cn } from '../lib/utils.js';
import { LinkedItemBadge } from '../components/linked-item-badge.js';
import type { ConnectionsResponse, WorkItemsResponse } from '@panorama/shared';
import type { LinkedItem } from '@panorama/shared';

const ACTIVE_STATUSES = ['open', 'in_progress', 'in_review'];

const ACTION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  needs_review: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Needs review' },
  needs_response: { bg: 'bg-red-100', text: 'text-red-800', label: 'Needs response' },
  waiting_on_peer: { bg: 'bg-sky-100', text: 'text-sky-800', label: 'Waiting on peer' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-800' },
  in_review: { bg: 'bg-purple-100', text: 'text-purple-800' },
  done: { bg: 'bg-gray-100', text: 'text-gray-500' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

interface WorkItem {
  id: number;
  sourceId: string;
  sourceUrl: string;
  title: string;
  description: string | null;
  status: string;
  assignee: string | null;
  labels: string[] | null;
  group: string | null;
  linkedItems: LinkedItem[] | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  actionNeeded?: string | null;
  priority?: string | null;
}

export function OngoingWorkView() {
  const [connections, setConnections] = useState<ConnectionsResponse['connections']>([]);
  const [prs, setPrs] = useState<WorkItem[]>([]);
  const [issues, setIssues] = useState<WorkItem[]>([]);
  const [tickets, setTickets] = useState<WorkItem[]>([]);
  const [search, setSearch] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await apiFetch('/sync-status/trigger', { method: 'POST' });
      await new Promise((r) => setTimeout(r, 3000));
      await loadAll();
    } catch (err) {
      console.error('Failed to trigger sync:', err);
    }
    setSyncing(false);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [conns, prData, issueData, ticketData] = await Promise.all([
        apiFetch<ConnectionsResponse>('/connections'),
        apiFetch<WorkItemsResponse>('/work-items?type=github-pr&limit=100').catch(() => ({ items: [], total: 0 })),
        apiFetch<WorkItemsResponse>('/work-items?type=github-issue&limit=100').catch(() => ({ items: [], total: 0 })),
        apiFetch<WorkItemsResponse>('/work-items?type=jira-ticket&limit=100').catch(() => ({ items: [], total: 0 })),
      ]);
      setConnections(conns.connections);
      setPrs(prData.items as WorkItem[]);
      setIssues(issueData.items as WorkItem[]);
      setTickets(ticketData.items as WorkItem[]);
    } catch (err) {
      console.error('Failed to load work items:', err);
    }
    setLoading(false);
  };

  const githubConnected = connections.some((c) => c.source === 'github' && c.connected);
  const jiraConnected = connections.some((c) => c.source === 'jira' && c.connected);
  const anyConnected = githubConnected || jiraConnected;

  const filterItems = (items: WorkItem[]) => {
    let filtered = items;
    if (!showResolved) {
      filtered = filtered.filter((i) => ACTIVE_STATUSES.includes(i.status));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (i) => i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q),
      );
    }
    return filtered;
  };

  const filteredPrs = useMemo(() => filterItems(prs), [prs, search, showResolved]);
  const filteredIssues = useMemo(() => filterItems(issues), [issues, search, showResolved]);
  const filteredTickets = useMemo(() => filterItems(tickets), [tickets, search, showResolved]);

  if (!loading && !anyConnected) {
    return <EmptyState />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work items..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md transition-colors',
            showResolved
              ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-light)]'
              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]',
          )}
        >
          {showResolved ? <Eye size={14} /> : <EyeOff size={14} />}
          {showResolved ? 'Showing resolved' : 'Show resolved'}
        </button>
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-green-300 rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
          title="Sync now"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          Sync
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-muted)]">Loading...</div>
      ) : (
        <div className="space-y-6">
          {githubConnected && (
            <div className="grid grid-cols-2 gap-6">
              <WorkItemPanel title="🚧 GitHub Pull Requests" items={filteredPrs} type="pr" />
              <WorkItemPanel title="🐛 GitHub Issues" items={filteredIssues} type="issue" />
            </div>
          )}
          {jiraConnected && (
            <WorkItemPanel title="Jira Tickets" items={filteredTickets} type="jira" />
          )}
        </div>
      )}
    </div>
  );
}

function WorkItemPanel({ title, items, type }: { title: string; items: WorkItem[]; type: 'pr' | 'issue' | 'jira' }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, WorkItem[]>();
    for (const item of items) {
      const key = item.group ?? 'Other';
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return groups;
  }, [items]);

  return (
    <div className="rounded-lg border border-[var(--color-border)] flex flex-col max-h-[500px]">
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-gray-50 rounded-t-lg shrink-0">
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
          {title}
          <span className="ml-2 text-[var(--color-muted)] font-normal">({items.length})</span>
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">No items</div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] overflow-y-auto">
          {Array.from(grouped.entries()).map(([group, groupItems]) => (
            <div key={group}>
              <div className="px-4 py-2 bg-gray-50/50 sticky top-0">
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{group}</span>
              </div>
              {groupItems.map((item) => (
                <WorkItemRow key={item.id} item={item} type={type} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkItemRow({ item, type }: { item: WorkItem; type: 'pr' | 'issue' | 'jira' }) {
  const action = type === 'pr' && item.actionNeeded ? ACTION_COLORS[item.actionNeeded] : null;

  return (
    <div className="px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            {item.title}
          </a>
          {item.summary && (
            <p className="mt-0.5 text-xs text-[var(--color-muted)] line-clamp-1">{item.summary}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {action && (
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', action.bg, action.text)}>
              {action.label}
            </span>
          )}
          {(type === 'issue' || type === 'jira') && item.priority && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-[var(--color-foreground)]">
              {item.priority}
            </span>
          )}
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-medium',
            STATUS_COLORS[item.status]?.bg ?? 'bg-gray-100',
            STATUS_COLORS[item.status]?.text ?? 'text-gray-500',
          )}>
            {item.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--color-muted)]">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
        {item.linkedItems?.map((linked, i) => (
          <LinkedItemBadge key={i} item={linked} />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
        <Settings size={28} className="text-[var(--color-muted)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-2">Welcome to Panorama</h3>
      <p className="text-sm text-[var(--color-muted)] mb-4">
        Connect your first source to start tracking your work.
      </p>
      <button
        onClick={() => {
          const event = new CustomEvent('open-settings');
          window.dispatchEvent(event);
        }}
        className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] rounded-md hover:opacity-90 transition-opacity"
      >
        Connect a source
      </button>
    </div>
  );
}
