import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { getRegisteredViews } from '../lib/view-registry.js';
import { GreetingPanel } from './greeting-panel.js';
import { SettingsPanel } from './settings-panel.js';
import { StatusBadge } from './status-badge.js';
import { cn } from '../lib/utils.js';

export function DashboardShell() {
  const views = getRegisteredViews();
  const [activeViewId, setActiveViewId] = useState(views[0]?.id ?? '');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('settings') === 'open') {
      setSettingsOpen(true);
      window.history.replaceState({}, '', '/');
    }

    const handler = () => setSettingsOpen(true);
    window.addEventListener('open-settings', handler);
    return () => window.removeEventListener('open-settings', handler);
  }, []);

  const ActiveComponent = views.find((v) => v.id === activeViewId)?.component;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--color-border)] px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-6">
          <h1 className="text-lg font-semibold text-[var(--color-foreground)]">🏔️ Panorama</h1>
          <nav className="flex gap-1">
            {views.map((view) => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  onClick={() => setActiveViewId(view.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    activeViewId === view.id
                      ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-gray-100',
                  )}
                >
                  <Icon size={16} />
                  {view.label}
                </button>
              );
            })}
          </nav>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="relative p-2 rounded-md text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-gray-100 transition-colors"
          aria-label="Settings"
        >
          <Settings size={20} />
          <StatusBadge />
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <GreetingPanel />
        {ActiveComponent && <ActiveComponent />}
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
