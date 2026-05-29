import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { SearchRequestRow, TokenUsageRow } from '../api';

export default function ProjectAnalytics() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [searchRequests, setSearchRequests] = useState<SearchRequestRow[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.orgs.list();
        const org = orgs.find((o) => o.slug === orgSlug);
        if (!org) {
          setError('Organization not found');
          return;
        }
        const projects = await api.projects.list(org.id);
        const project = projects.find((p) => p.slug === projectSlug);
        if (!project) {
          setError('Project not found');
          return;
        }
        if (cancelled) return;
        setProjectId(project.id);
        const data = await api.analytics.usage(project.id);
        if (cancelled) return;
        setSearchRequests(data.searchRequests);
        setTokenUsage(data.tokenUsage);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug]);

  const usageBySearchId = useMemo(() => {
    const map = new Map<string, TokenUsageRow[]>();
    for (const row of tokenUsage) {
      if (!row.searchRequestId) continue;
      const arr = map.get(row.searchRequestId) ?? [];
      arr.push(row);
      map.set(row.searchRequestId, arr);
    }
    return map;
  }, [tokenUsage]);

  const isEmpty = !loading && searchRequests.length === 0 && tokenUsage.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <nav className="text-sm text-gray-500">
          <Link to="/" className="hover:underline">Orgs</Link>
          <span className="mx-2">/</span>
          <Link to={`/orgs/${orgSlug}`} className="hover:underline">{orgSlug}</Link>
          <span className="mx-2">/</span>
          <Link to={`/orgs/${orgSlug}/projects/${projectSlug}`} className="hover:underline">{projectSlug}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">Analytics</span>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto py-10 px-4 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <p className="text-gray-400">Loading analytics...</p>}

        {!loading && isEmpty && (
          <div
            className="bg-white border border-gray-200 rounded-lg px-6 py-8 text-center text-gray-500"
            data-testid="analytics-empty-state"
          >
            <p className="text-sm">No search or token usage recorded in the last 30 days.</p>
            <p className="text-xs mt-1">Run a search or synthesis to populate this view.</p>
          </div>
        )}

        {!loading && !isEmpty && (
          <>
            <section data-testid="search-requests-section">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Requests (last 30 days)</h2>
              {searchRequests.length === 0 ? (
                <p className="text-gray-400 text-sm">No search requests yet.</p>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-2"></th>
                        <th className="text-left px-4 py-2">Date</th>
                        <th className="text-left px-4 py-2">Question</th>
                        <th className="text-left px-4 py-2">Brief</th>
                        <th className="text-right px-4 py-2">Iters</th>
                        <th className="text-right px-4 py-2">Duration (ms)</th>
                        <th className="text-right px-4 py-2">Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchRequests.map((r) => {
                        const expanded = expandedId === r.id;
                        const linkedUsage = usageBySearchId.get(r.id) ?? [];
                        return (
                          <RowFragment
                            key={r.id}
                            row={r}
                            expanded={expanded}
                            linkedUsage={linkedUsage}
                            onToggle={() => setExpandedId(expanded ? null : r.id)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section data-testid="token-usage-section">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Token Usage (last 30 days)</h2>
              {tokenUsage.length === 0 ? (
                <p className="text-gray-400 text-sm">No token usage yet.</p>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-2">Date</th>
                        <th className="text-left px-4 py-2">Operation</th>
                        <th className="text-right px-4 py-2">Input Tokens</th>
                        <th className="text-right px-4 py-2">Output Tokens</th>
                        <th className="text-right px-4 py-2">Total</th>
                        <th className="text-left px-4 py-2">Provider</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsage.map((r) => (
                        <tr key={r.id} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-600">{formatDate(r.createdAt)}</td>
                          <td className="px-4 py-2">{r.operation}</td>
                          <td className="px-4 py-2 text-right">{r.inputTokens}</td>
                          <td className="px-4 py-2 text-right">{r.outputTokens}</td>
                          <td className="px-4 py-2 text-right">{r.inputTokens + r.outputTokens}</td>
                          <td className="px-4 py-2 text-gray-600">{r.provider}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {projectId && (
          <p className="text-xs text-gray-400">Project id: {projectId}</p>
        )}
      </main>
    </div>
  );
}

function RowFragment({
  row,
  expanded,
  linkedUsage,
  onToggle,
}: {
  row: SearchRequestRow;
  expanded: boolean;
  linkedUsage: TokenUsageRow[];
  onToggle: () => void;
}) {
  const total = row.totalInputTokens + row.totalOutputTokens;
  return (
    <>
      <tr className="border-t border-gray-100">
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="text-purple-600 hover:underline text-xs"
            aria-label={expanded ? 'Collapse row' : 'Expand row'}
          >
            {expanded ? '−' : '+'}
          </button>
        </td>
        <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDate(row.createdAt)}</td>
        <td className="px-4 py-2 max-w-xs truncate" title={row.question}>{row.question}</td>
        <td className="px-4 py-2 max-w-xs truncate" title={row.answerBrief}>{row.answerBrief}</td>
        <td className="px-4 py-2 text-right">{row.iters}</td>
        <td className="px-4 py-2 text-right">{row.durationMs}</td>
        <td className="px-4 py-2 text-right">{total}</td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50" data-testid={`expanded-${row.id}`}>
          <td></td>
          <td colSpan={6} className="px-4 py-3 text-sm text-gray-700 space-y-3">
            {row.answerReasoning ? (
              <div>
                <div className="font-medium text-gray-800 mb-1">Reasoning</div>
                <pre className="whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 text-xs">
                  {row.answerReasoning}
                </pre>
              </div>
            ) : (
              <div className="text-xs text-gray-500">No reasoning recorded (reasoning was not requested).</div>
            )}
            <div>
              <div className="font-medium text-gray-800 mb-1">Per-call token usage</div>
              {linkedUsage.length === 0 ? (
                <div className="text-xs text-gray-500">No linked token rows found.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="text-left py-1">Date</th>
                      <th className="text-right py-1">Input</th>
                      <th className="text-right py-1">Output</th>
                      <th className="text-right py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedUsage.map((u) => (
                      <tr key={u.id} className="border-t border-gray-200">
                        <td className="py-1 text-gray-600">{formatDate(u.createdAt)}</td>
                        <td className="py-1 text-right">{u.inputTokens}</td>
                        <td className="py-1 text-right">{u.outputTokens}</td>
                        <td className="py-1 text-right">{u.inputTokens + u.outputTokens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div className="font-medium text-gray-800 mb-1">Sources</div>
              {row.sources.length === 0 ? (
                <div className="text-xs text-gray-500">No sources recorded.</div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {row.sources.map((s) => (
                    <span key={s} className="inline-block bg-white border border-gray-200 text-gray-600 rounded px-1.5 py-0.5 text-xs font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return iso;
  }
}
