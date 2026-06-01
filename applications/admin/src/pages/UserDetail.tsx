import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type AdminUserDetail } from '../api';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.admin.users.detail(id)
      .then(setUser)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!user) return null;

  return (
    <div className="p-6">
      <Link to="/users" className="text-purple-600 hover:underline text-sm mb-4 block">&larr; Back to Users</Link>
      <h2 className="text-lg font-semibold mb-2">User: {user.email}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm mb-6 max-w-lg">
        <dt className="text-gray-500">ID</dt>
        <dd className="font-mono text-xs">{user.id}</dd>
        <dt className="text-gray-500">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-gray-500">Platform Admin</dt>
        <dd>{user.isPlatformAdmin ? 'Yes' : 'No'}</dd>
        <dt className="text-gray-500">Created At</dt>
        <dd>{new Date(user.createdAt).toLocaleString()}</dd>
      </dl>

      <h3 className="text-base font-medium mb-2">Organizations</h3>
      {user.organizations.length === 0 ? (
        <p className="text-sm text-gray-400">No organizations.</p>
      ) : (
        <table className="w-full text-sm border-collapse max-w-2xl">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 border border-gray-200">Org</th>
              <th className="p-2 border border-gray-200">Slug</th>
              <th className="p-2 border border-gray-200">Role</th>
            </tr>
          </thead>
          <tbody>
            {user.organizations.map((o) => (
              <tr key={o.orgId} className="hover:bg-gray-50">
                <td className="p-2 border border-gray-200">
                  <Link to={`/orgs/${o.orgId}`} className="text-purple-600 hover:underline">
                    {o.orgName}
                  </Link>
                </td>
                <td className="p-2 border border-gray-200 font-mono text-xs">{o.orgSlug}</td>
                <td className="p-2 border border-gray-200">{o.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
