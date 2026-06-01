import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type AdminProjectDetail, type ProjectUsage } from '../api';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<AdminProjectDetail | null>(null);
  const [usage, setUsage] = useState<ProjectUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.admin.projects.detail(id),
      api.admin.projects.usage(id),
    ])
      .then(([proj, u]) => {
        setProject(proj);
        setUsage(u);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!project || !usage) return null;

  return (
    <div className="p-6">
      <Link to="/admin/projects" className="text-purple-600 hover:underline text-sm mb-4 block">&larr; Back to Projects</Link>
      <h2 className="text-lg font-semibold mb-2">Project: {project.name}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm mb-6 max-w-lg">
        <dt className="text-gray-500">ID</dt>
        <dd className="font-mono text-xs">{project.id}</dd>
        <dt className="text-gray-500">Slug</dt>
        <dd>{project.slug}</dd>
        <dt className="text-gray-500">Org</dt>
        <dd>
          <Link to={`/admin/orgs/${project.orgId}`} className="text-purple-600 hover:underline">
            {project.orgName}
          </Link>
        </dd>
        <dt className="text-gray-500">Created At</dt>
        <dd>{new Date(project.createdAt).toLocaleString()}</dd>
      </dl>

      <h3 className="text-base font-medium mb-2">Repositories</h3>
      {project.repositories.length === 0 ? (
        <p className="text-sm text-gray-400 mb-6">No repositories.</p>
      ) : (
        <table className="w-full text-sm border-collapse max-w-2xl mb-6">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 border border-gray-200">ID</th>
              <th className="p-2 border border-gray-200">Name</th>
              <th className="p-2 border border-gray-200">Git Remote</th>
            </tr>
          </thead>
          <tbody>
            {project.repositories.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="p-2 border border-gray-200 font-mono text-xs">{r.id}</td>
                <td className="p-2 border border-gray-200">{r.name}</td>
                <td className="p-2 border border-gray-200 text-xs">{r.gitRemote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="text-base font-medium mb-2">Search Requests</h3>
      {usage.searchRequests.length === 0 ? (
        <p className="text-sm text-gray-400 mb-6">No recent search requests.</p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 border border-gray-200">Question</th>
                <th className="p-2 border border-gray-200">Iters</th>
                <th className="p-2 border border-gray-200">Input Tokens</th>
                <th className="p-2 border border-gray-200">Output Tokens</th>
                <th className="p-2 border border-gray-200">Duration</th>
                <th className="p-2 border border-gray-200">Created At</th>
              </tr>
            </thead>
            <tbody>
              {usage.searchRequests.map((sr) => (
                <tr key={sr.id} className="hover:bg-gray-50">
                  <td className="p-2 border border-gray-200 max-w-xs truncate">{sr.question}</td>
                  <td className="p-2 border border-gray-200">{sr.iters}</td>
                  <td className="p-2 border border-gray-200">{sr.totalInputTokens}</td>
                  <td className="p-2 border border-gray-200">{sr.totalOutputTokens}</td>
                  <td className="p-2 border border-gray-200">{sr.durationMs}ms</td>
                  <td className="p-2 border border-gray-200">{new Date(sr.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="text-base font-medium mb-2">Token Usage</h3>
      {usage.tokenUsage.length === 0 ? (
        <p className="text-sm text-gray-400">No recent token usage.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 border border-gray-200">Operation</th>
                <th className="p-2 border border-gray-200">Provider</th>
                <th className="p-2 border border-gray-200">Input Tokens</th>
                <th className="p-2 border border-gray-200">Output Tokens</th>
                <th className="p-2 border border-gray-200">Created At</th>
              </tr>
            </thead>
            <tbody>
              {usage.tokenUsage.map((tu) => (
                <tr key={tu.id} className="hover:bg-gray-50">
                  <td className="p-2 border border-gray-200">{tu.operation}</td>
                  <td className="p-2 border border-gray-200">{tu.provider}</td>
                  <td className="p-2 border border-gray-200">{tu.inputTokens}</td>
                  <td className="p-2 border border-gray-200">{tu.outputTokens}</td>
                  <td className="p-2 border border-gray-200">{new Date(tu.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
