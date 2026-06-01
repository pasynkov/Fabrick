import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type AdminOrgDetail } from '../api';

export default function OrgDetail() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<AdminOrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.admin.orgs.detail(id)
      .then(setOrg)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!org) return null;

  return (
    <div className="p-6">
      <Link to="/admin/orgs" className="text-purple-600 hover:underline text-sm mb-4 block">&larr; Back to Orgs</Link>
      <h2 className="text-lg font-semibold mb-2">Org: {org.name}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm mb-6 max-w-lg">
        <dt className="text-gray-500">ID</dt>
        <dd className="font-mono text-xs">{org.id}</dd>
        <dt className="text-gray-500">Slug</dt>
        <dd>{org.slug}</dd>
        <dt className="text-gray-500">Created At</dt>
        <dd>{new Date(org.createdAt).toLocaleString()}</dd>
      </dl>

      <h3 className="text-base font-medium mb-2">Members</h3>
      {org.members.length === 0 ? (
        <p className="text-sm text-gray-400 mb-6">No members.</p>
      ) : (
        <table className="w-full text-sm border-collapse max-w-2xl mb-6">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 border border-gray-200">User ID</th>
              <th className="p-2 border border-gray-200">Email</th>
              <th className="p-2 border border-gray-200">Role</th>
            </tr>
          </thead>
          <tbody>
            {org.members.map((m) => (
              <tr key={m.userId} className="hover:bg-gray-50">
                <td className="p-2 border border-gray-200">
                  <Link to={`/admin/users/${m.userId}`} className="text-purple-600 hover:underline font-mono text-xs">
                    {m.userId}
                  </Link>
                </td>
                <td className="p-2 border border-gray-200">{m.email}</td>
                <td className="p-2 border border-gray-200">{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="text-base font-medium mb-2">Projects</h3>
      {org.projects.length === 0 ? (
        <p className="text-sm text-gray-400">No projects.</p>
      ) : (
        <table className="w-full text-sm border-collapse max-w-2xl">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 border border-gray-200">ID</th>
              <th className="p-2 border border-gray-200">Name</th>
              <th className="p-2 border border-gray-200">Slug</th>
              <th className="p-2 border border-gray-200">Created At</th>
            </tr>
          </thead>
          <tbody>
            {org.projects.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="p-2 border border-gray-200 font-mono text-xs">{p.id}</td>
                <td className="p-2 border border-gray-200">
                  <Link to={`/admin/projects/${p.id}`} className="text-purple-600 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="p-2 border border-gray-200">{p.slug}</td>
                <td className="p-2 border border-gray-200">{new Date(p.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
