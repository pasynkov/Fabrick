import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

interface Org { id: string; name: string; slug: string; role: string }

export default function OrgList() {
  const { user, logout } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.orgs.list().then(setOrgs).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <span className="font-semibold text-gray-900">Fabrick</span>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{user?.email}</span>
          <button onClick={logout} className="text-red-500 hover:underline">Sign out</button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto py-10 px-4">
        <h2 className="text-xl font-semibold mb-6 text-gray-900">Organizations</h2>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : orgs.length === 0 ? (
          <p className="text-gray-400">No organizations yet.</p>
        ) : (
          <ul className="space-y-2">
            {orgs.map((org) => (
              <li key={org.id} className="flex items-center gap-2">
                <Link
                  to={`/orgs/${org.slug}`}
                  className="flex-1 block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-purple-400 transition"
                >
                  <span className="font-medium text-gray-900">{org.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{org.slug}</span>
                  <span className="ml-2 text-xs text-purple-500">{org.role}</span>
                </Link>
                {org.role === 'admin' && (
                  <Link
                    to={`/orgs/${org.slug}/edit`}
                    className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:border-purple-400 hover:text-purple-600 transition"
                  >
                    Edit
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
