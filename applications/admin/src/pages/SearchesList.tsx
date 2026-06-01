import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type AdminOrg, type AdminProject, type AdminSearchRequest } from '../api';
import Pagination from '../Pagination';

export default function SearchesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const orgId = searchParams.get('orgId') || '';
  const projectId = searchParams.get('projectId') || '';

  const [items, setItems] = useState<AdminSearchRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.admin.orgs.list(500, 0),
      api.admin.projects.list(500, 0),
    ]).then(([orgsRes, projRes]) => {
      setOrgs(orgsRes.items);
      setProjects(projRes.items);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.admin.searchRequests.list({
      limit,
      offset,
      orgId: orgId || undefined,
      projectId: projectId || undefined,
    })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit, offset, orgId, projectId]);

  function updateParams(updates: Record<string, string>) {
    const next: Record<string, string> = {
      limit: String(limit),
      offset: '0',
    };
    if (orgId) next.orgId = orgId;
    if (projectId) next.projectId = projectId;
    Object.assign(next, updates);
    Object.keys(next).forEach((k) => { if (!next[k]) delete next[k]; });
    setSearchParams(next);
  }

  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Search Requests</h2>

      <div className="flex gap-4 mb-4">
        <div>
          <label className="text-sm text-gray-600 block mb-1">Org</label>
          <select
            value={orgId}
            onChange={(e) => updateParams({ orgId: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">All orgs</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Project</label>
          <select
            value={projectId}
            onChange={(e) => updateParams({ projectId: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.orgName} / {p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-2 border border-gray-200">Question</th>
                  <th className="p-2 border border-gray-200">Project</th>
                  <th className="p-2 border border-gray-200">Org</th>
                  <th className="p-2 border border-gray-200">Reasoning</th>
                  <th className="p-2 border border-gray-200">Iters</th>
                  <th className="p-2 border border-gray-200">Pages Read</th>
                  <th className="p-2 border border-gray-200">Input Tokens</th>
                  <th className="p-2 border border-gray-200">Output Tokens</th>
                  <th className="p-2 border border-gray-200">Duration</th>
                  <th className="p-2 border border-gray-200">Stop Reason</th>
                  <th className="p-2 border border-gray-200">Created At</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sr) => (
                  <tr key={sr.id} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-200 max-w-xs truncate">{sr.question}</td>
                    <td className="p-2 border border-gray-200">{sr.projectName ?? sr.projectId}</td>
                    <td className="p-2 border border-gray-200">{sr.orgName ?? '-'}</td>
                    <td className="p-2 border border-gray-200">{sr.reasoningRequested ? 'Yes' : 'No'}</td>
                    <td className="p-2 border border-gray-200">{sr.iters}</td>
                    <td className="p-2 border border-gray-200">{sr.pagesRead}</td>
                    <td className="p-2 border border-gray-200">{sr.totalInputTokens}</td>
                    <td className="p-2 border border-gray-200">{sr.totalOutputTokens}</td>
                    <td className="p-2 border border-gray-200">{sr.durationMs}ms</td>
                    <td className="p-2 border border-gray-200">{sr.stopReason}</td>
                    <td className="p-2 border border-gray-200">{new Date(sr.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onPrev={() => updateParams({ offset: String(Math.max(0, offset - limit)) })}
            onNext={() => updateParams({ offset: String(offset + limit) })}
          />
        </>
      )}
    </div>
  );
}
