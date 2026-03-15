/** Normalized work-item status across all sources. */
export type WorkItemStatus = 'open' | 'in_progress' | 'in_review' | 'done' | 'closed';

/** What action the user needs to take on a GitHub PR. */
export type ActionNeeded = 'needs_review' | 'needs_response' | 'waiting_on_peer';
