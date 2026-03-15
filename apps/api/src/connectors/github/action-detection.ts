import type { ActionNeeded } from '@panorama/shared';

interface ReviewInfo {
  author: string;
  state: string;
}

interface ReviewThread {
  isResolved: boolean;
  comments: Array<{ author: string }>;
}

/**
 * Determines what action the user needs to take on a PR.
 *
 * Logic:
 * - If user is a reviewer and hasn't submitted a review yet → needs_review
 * - If there are unresolved review threads where the last comment is from someone else → needs_response
 * - Otherwise → waiting_on_peer
 */
export function detectAction(
  userId: string,
  isAuthor: boolean,
  reviewRequests: string[],
  reviews: ReviewInfo[],
  reviewThreads: ReviewThread[],
): ActionNeeded {
  if (reviewRequests.includes(userId)) {
    return 'needs_review';
  }

  if (isAuthor) {
    const hasUnresolvedFeedback = reviewThreads.some(
      (thread) =>
        !thread.isResolved &&
        thread.comments.length > 0 &&
        thread.comments[thread.comments.length - 1].author !== userId,
    );

    if (hasUnresolvedFeedback) {
      return 'needs_response';
    }

    const hasChangesRequested = reviews.some(
      (r) => r.author !== userId && r.state === 'CHANGES_REQUESTED',
    );

    if (hasChangesRequested) {
      return 'needs_response';
    }
  }

  return 'waiting_on_peer';
}
