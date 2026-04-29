import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

export default function EditOrgName() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    api.orgs.list().then((orgs) => {
      const found = orgs.find((o) => o.slug === orgSlug);
      if (!found) return;
      setOrgId(found.id);
      setName(found.name);
    }).finally(() => setInitializing(false));
  }, [orgSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name must not be empty'); return; }
    if (name.length > 128) { setError('Name must not exceed 128 characters'); return; }
    setLoading(true);
    try {
      await api.orgs.update(orgId, name.trim());
      navigate(`/orgs/${orgSlug}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update org name');
    } finally {
      setLoading(false);
    }
  }

  if (initializing) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <nav className="text-sm text-gray-500">
          <Link to="/" className="hover:underline">Orgs</Link>
          <span className="mx-2">/</span>
          <Link to={`/orgs/${orgSlug}`} className="hover:underline">{orgSlug}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">Edit Name</span>
        </nav>
      </header>
      <main className="max-w-md mx-auto py-10 px-4">
        <h2 className="text-xl font-semibold mb-6 text-gray-900">Edit Organization Name</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={128}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">{name.length}/128</p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-purple-600 text-white rounded px-4 py-2 text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <Link
              to={`/orgs/${orgSlug}`}
              className="border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
