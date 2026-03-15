const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/**
 * Executes a GraphQL query against the GitHub API.
 */
export async function githubGraphQL<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Panorama/1.0',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const err = new Error('GitHub API rate limit exceeded');
    (err as NodeJS.ErrnoException).code = 'RATE_LIMITED';
    throw err;
  }

  if (!res.ok) {
    throw new Error(`GitHub GraphQL error: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${json.errors.map((e) => e.message).join(', ')}`);
  }

  return json.data as T;
}

export const SEARCH_ITEMS_QUERY = `
query SearchItems($query: String!, $after: String) {
  search(query: $query, type: ISSUE, first: 50, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        __typename
        number
        title
        body
        url
        state
        createdAt
        updatedAt
        isDraft
        author { login }
        repository { nameWithOwner }
        labels(first: 20) { nodes { name } }
        assignees(first: 5) { nodes { login } }
        reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } } } }
        reviews(last: 20) { nodes { author { login } state } }
        reviewThreads(first: 50) {
          nodes {
            isResolved
            comments(last: 1) { nodes { author { login } } }
          }
        }
      }
      ... on Issue {
        __typename
        number
        title
        body
        url
        state
        createdAt
        updatedAt
        author { login }
        repository { nameWithOwner }
        labels(first: 20) { nodes { name } }
        assignees(first: 5) { nodes { login } }
      }
    }
  }
}
`;
