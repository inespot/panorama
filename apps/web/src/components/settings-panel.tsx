import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { cn } from '../lib/utils.js';
import type { ConnectionsResponse, SettingsResponse, SyncStatusResponse } from '@panorama/shared';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [connections, setConnections] = useState<ConnectionsResponse['connections']>([]);
  const [settings, setSettings] = useState<SettingsResponse['settings'] | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [githubOrgs, setGithubOrgs] = useState('');
  const [llmEndpoint, setLlmEndpoint] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = () => {
    apiFetch<ConnectionsResponse>('/connections').then((d) => setConnections(d.connections)).catch(console.error);
    apiFetch<SettingsResponse>('/settings').then((d) => {
      setSettings(d.settings);
      setDisplayName(d.settings.displayName ?? '');
      setGithubOrgs((d.settings.githubOrgs ?? []).join(', '));
      setLlmEndpoint(d.settings.llmEndpoint ?? '');
      setLlmModel(d.settings.llmModel ?? '');
    }).catch(console.error);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          displayName: displayName || null,
          githubOrgs: githubOrgs.split(',').map((s) => s.trim()).filter(Boolean),
          llmEndpoint: llmEndpoint || null,
          llmModel: llmModel || null,
        }),
      });
      setSaving(false);
      onClose();
      return;
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    setSaving(false);
  };

  const connect = async (source: string) => {
    try {
      const { url } = await apiFetch<{ url: string }>(`/connections/${source}/auth-url`);
      window.location.href = url;
    } catch (err) {
      console.error('Failed to get auth URL:', err);
    }
  };

  const disconnect = async (source: string) => {
    try {
      await apiFetch(`/connections/${source}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl border-l border-[var(--color-border)] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-3">Connected Sources</h3>
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.source} className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)]">
                  <div>
                    <div className="font-medium text-sm">{conn.displayName}</div>
                    {conn.connected && (
                      <div className="text-xs text-[var(--color-muted)]">
                        Connected as {conn.userIdentity}
                        {conn.lastError && <span className="text-[var(--color-danger)] ml-1">· Error</span>}
                      </div>
                    )}
                    {!conn.configured && (
                      <div className="text-xs text-[var(--color-warning)]">Not configured</div>
                    )}
                    {conn.lastError && (
                      <div className="text-xs text-[var(--color-danger)] mt-1">{conn.lastError}</div>
                    )}
                    {conn.lastSyncAt && (
                      <div className="text-xs text-[var(--color-muted)] mt-0.5">
                        Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  {conn.connected ? (
                    <button onClick={() => disconnect(conn.source)} className="text-xs text-[var(--color-danger)] hover:underline">
                      Disconnect
                    </button>
                  ) : conn.configured ? (
                    <button onClick={() => connect(conn.source)} className="text-xs text-[var(--color-accent)] hover:underline">
                      Connect
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-3">Profile</h3>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-3">GitHub Organizations</h3>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Organization names (comma-separated)</label>
            <input
              type="text"
              value={githubOrgs}
              onChange={(e) => setGithubOrgs(e.target.value)}
              placeholder="e.g. elastic, facebook"
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-3">AI / LLM</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-[var(--color-muted)] mb-1">Endpoint URL</label>
                <input
                  type="text"
                  value={llmEndpoint}
                  onChange={(e) => setLlmEndpoint(e.target.value)}
                  placeholder="https://api.openai.com/v1/chat/completions"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-muted)] mb-1">Model</label>
                <input
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>
          </section>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
