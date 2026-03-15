import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api.js';
import type { ConnectionsResponse } from '@panorama/shared';
import { cn } from '../lib/utils.js';

export function StatusBadge() {
  const [status, setStatus] = useState<'none' | 'healthy' | 'error'>('none');

  useEffect(() => {
    apiFetch<ConnectionsResponse>('/connections')
      .then((data) => {
        const connected = data.connections.filter((c) => c.connected);
        if (connected.length === 0) {
          setStatus('none');
        } else if (connected.some((c) => c.lastError)) {
          setStatus('error');
        } else {
          setStatus('healthy');
        }
      })
      .catch(() => setStatus('none'));
  }, []);

  return (
    <span
      className={cn(
        'absolute top-1 right-1 block h-2 w-2 rounded-full',
        status === 'healthy' && 'bg-[var(--color-success)]',
        status === 'error' && 'bg-[var(--color-danger)]',
        status === 'none' && 'bg-gray-300',
      )}
    />
  );
}
