import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encrypt, decrypt } from '../crypto/encryption.js';
import { extractPriorityFromLabels } from '../connectors/github/parse-priority.js';
import { extractJiraKeysFromText } from '../connectors/github/parse-linked-items.js';
import { extractGithubPrUrls } from '../connectors/jira/parse-linked-items.js';
import { detectAction } from '../connectors/github/action-detection.js';
import crypto from 'node:crypto';

describe('encryption round-trips', () => {
  const hexKey = crypto.randomBytes(32).toString('hex');

  it('decrypt(encrypt(x)) === x for any string', () => {
    fc.assert(
      fc.property(fc.string(), (plaintext) => {
        const encrypted = encrypt(plaintext, hexKey);
        const decrypted = decrypt(encrypted, hexKey);
        expect(decrypted).toBe(plaintext);
      }),
    );
  });

  it('different plaintexts produce different ciphertexts', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (a, b) => {
        fc.pre(a !== b);
        const encA = encrypt(a, hexKey);
        const encB = encrypt(b, hexKey);
        expect(encA).not.toBe(encB);
      }),
    );
  });

  it('same plaintext encrypts differently each time (random IV)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (plaintext) => {
        const enc1 = encrypt(plaintext, hexKey);
        const enc2 = encrypt(plaintext, hexKey);
        expect(enc1).not.toBe(enc2);
      }),
    );
  });
});

describe('priority extraction from labels', () => {
  it('returns null when no labels match', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 0, maxLength: 5 }),
        (labels) => {
          expect(extractPriorityFromLabels(labels)).toBeNull();
        },
      ),
    );
  });

  it('always extracts known priority labels', () => {
    const knownLabels = ['P0', 'P1', 'P2', 'P3', 'P4', 'priority:high', 'priority:low', 'priority:medium', 'priority:critical'];
    fc.assert(
      fc.property(
        fc.constantFrom(...knownLabels),
        fc.array(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 0, maxLength: 5 }),
        (priorityLabel, otherLabels) => {
          const result = extractPriorityFromLabels([...otherLabels, priorityLabel]);
          expect(result).not.toBeNull();
        },
      ),
    );
  });
});

describe('Jira key parsing from text', () => {
  it('extracts all Jira keys matching [A-Z]+-\\d+ pattern', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z]{2,5}$/),
        fc.integer({ min: 1, max: 99999 }),
        (project, number) => {
          const key = `${project}-${number}`;
          const text = `Fixes ${key} in the codebase`;
          const items = extractJiraKeysFromText(text);
          expect(items.some((i) => i.identifier === key)).toBe(true);
        },
      ),
    );
  });

  it('deduplicates repeated keys', () => {
    const text = 'ES-123 and ES-123 again';
    const items = extractJiraKeysFromText(text);
    expect(items.filter((i) => i.identifier === 'ES-123')).toHaveLength(1);
  });
});

describe('GitHub PR URL parsing from text', () => {
  it('extracts valid GitHub PR URLs', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{1,10}$/),
        fc.stringMatching(/^[a-z][a-z0-9-]{1,10}$/),
        fc.integer({ min: 1, max: 99999 }),
        (owner, repo, number) => {
          const url = `https://github.com/${owner}/${repo}/pull/${number}`;
          const text = `See ${url} for details`;
          const items = extractGithubPrUrls(text);
          expect(items.length).toBe(1);
          expect(items[0].url).toBe(url);
          expect(items[0].identifier).toBe(`#${number}`);
          expect(items[0].type).toBe('github-pr');
        },
      ),
    );
  });
});

describe('PR action detection', () => {
  it('returns needs_review when user is in review requests', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (userId) => {
        const result = detectAction(userId, false, [userId], [], []);
        expect(result).toBe('needs_review');
      }),
    );
  });

  it('returns waiting_on_peer when no action needed', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (userId) => {
        const result = detectAction(userId, true, [], [], []);
        expect(result).toBe('waiting_on_peer');
      }),
    );
  });

  it('returns needs_response when author has unresolved feedback from others', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (userId, reviewerName) => {
          fc.pre(userId !== reviewerName);
          const threads = [
            { isResolved: false, comments: [{ author: reviewerName }] },
          ];
          const result = detectAction(userId, true, [], [], threads);
          expect(result).toBe('needs_response');
        },
      ),
    );
  });
});

describe('todo ordering', () => {
  interface SimpleTodo {
    completed: boolean;
    createdAt: number;
    completedAt: number | null;
  }

  const todoOrdering = (a: SimpleTodo, b: SimpleTodo): number => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.completed) return a.createdAt - b.createdAt;
    return (b.completedAt ?? 0) - (a.completedAt ?? 0);
  };

  it('incomplete items always come before completed items', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            completed: fc.boolean(),
            createdAt: fc.integer({ min: 0, max: 1e12 }),
            completedAt: fc.option(fc.integer({ min: 0, max: 1e12 }), { nil: null }),
          }),
          { minLength: 2, maxLength: 20 },
        ),
        (todos) => {
          const sorted = [...todos].sort(todoOrdering);
          const firstCompletedIdx = sorted.findIndex((t) => t.completed);
          if (firstCompletedIdx === -1) return;
          const allAfterAreCompleted = sorted.slice(firstCompletedIdx).every((t) => t.completed);
          expect(allAfterAreCompleted).toBe(true);
        },
      ),
    );
  });

  it('incomplete items are ordered oldest first', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            completed: fc.constant(false as const),
            createdAt: fc.integer({ min: 0, max: 1e12 }),
            completedAt: fc.constant(null),
          }),
          { minLength: 2, maxLength: 20 },
        ),
        (todos) => {
          const sorted = [...todos].sort(todoOrdering);
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].createdAt).toBeGreaterThanOrEqual(sorted[i - 1].createdAt);
          }
        },
      ),
    );
  });
});
