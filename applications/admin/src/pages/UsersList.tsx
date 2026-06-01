import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type AdminUser } from '../api';
import Pagination from '../Pagination';

export default function UsersList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.admin.users.list(limit, offset)
      .then((res) => {
        setUsers(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit, offset]);

  function goToOffset(newOffset: number) {
    setSearchParams({ limit: String(limit), offset: String(newOffset) });
  }

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Users</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 border border-gray-200">ID</th>
              <th className="p-2 border border-gray-200">Email</th>
              <th className="p-2 border border-gray-200">Platform Admin</th>
              <th className="p-2 border border-gray-200">Created At</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="p-2 border border-gray-200">
                  <Link to={`/admin/users/${u.id}`} className="text-purple-600 hover:underline font-mono text-xs">
                    {u.id}
                  </Link>
                </td>
                <td className="p-2 border border-gray-200">{u.email}</td>
                <td className="p-2 border border-gray-200">{u.isPlatformAdmin ? 'Yes' : 'No'}</td>
                <td className="p-2 border border-gray-200">{new Date(u.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        total={total}
        limit={limit}
        offset={offset}
        onPrev={() => goToOffset(Math.max(0, offset - limit))}
        onNext={() => goToOffset(offset + limit)}
      />
    </div>
  );
}
