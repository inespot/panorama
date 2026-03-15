import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api.js';
import type { GreetingResponse } from '@panorama/shared';

export function GreetingPanel() {
  const [greeting, setGreeting] = useState<GreetingResponse | null>(null);

  useEffect(() => {
    apiFetch<GreetingResponse>('/greeting').then(setGreeting).catch(console.error);
  }, []);

  const name = greeting?.displayName;
  const hello = name ? `Hello, ${name} 👋` : 'Hello 👋';

  return (
    <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-gray-50 p-5">
      <h2 className="text-xl font-semibold text-[var(--color-foreground)]">{hello}</h2>
      {greeting?.quote && (
        <p className="mt-1 text-sm text-[var(--color-muted)] italic">{greeting.quote}</p>
      )}
      {greeting?.digest && (
        <p className="mt-2 text-sm text-[var(--color-foreground)]">{greeting.digest}</p>
      )}
      {!greeting?.quote && !greeting?.digest && (
        <p className="mt-1 text-sm text-[var(--color-muted)]">Welcome to your work dashboard.</p>
      )}
    </div>
  );
}
