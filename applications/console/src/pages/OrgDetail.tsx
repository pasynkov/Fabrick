import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { ApiKeySection } from '../components/ApiKeySection';
import { ApiKeyAuditLogs } from '../components/ApiKeyAuditLogs';

interface Project { id: string; name: string; slug: string }
interface Member { userId: string; email: string; role: string }
interface Org { id: string; name: string; slug: string; role: string }

function generatePassword(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export default function OrgDetail() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [org, setOrg] = useState<Org | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [shownPassword, setShownPassword] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    api.orgs.list().then((orgs) => {
      const found = orgs.find((o) => o.slug === orgSlug);
      if (!found) return;
      setOrg(found);
      api.projects.list(found.id).then(setProjects);
      api.orgs.members.list(found.id).then(setMembers);
    });
  }, [orgSlug]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setError('');
    const password = generatePassword();
    try {
      const m = await api.orgs.members.add(org.id, newEmail, password);
      setMembers((prev) => [...prev, m]);
      setShownPassword(password);
      setNewEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!org || !newProjectName) return;
    try {
      const p = await api.projects.create(org.id, newProjectName);
      setProjects((prev) => [...prev, p]);
      setNewProjectName('');
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    }
  }

  if (!org) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <nav className="text-sm text-gray-500">
          <Link to="/" className="hover:underline">Orgs</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">{org.name}</span>
        </nav>
        {org.role === 'admin' && (
          <Link
            to={`/orgs/${orgSlug}/edit`}
            className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:border-purple-400 hover:text-purple-600 transition"
          >
            Edit Name
          </Link>
        )}
      </header>
      <main className="max-w-2xl mx-auto py-10 px-4 space-y-10">
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Projects</h2>
          <ul className="space-y-2 mb-4">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Link
                  to={`/orgs/${orgSlug}/projects/${p.slug}`}
                  className="flex-1 block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-purple-400 transition"
                >
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{p.slug}</span>
                </Link>
                {org.role === 'admin' && (
                  <Link
                    to={`/orgs/${orgSlug}/projects/${p.slug}/edit`}
                    className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:border-purple-400 hover:text-purple-600 transition"
                  >
                    Edit
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={createProject} className="flex gap-2">
            <input
              type="text"
              placeholder="New project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button type="submit" className="bg-purple-600 text-white rounded px-4 py-1.5 text-sm hover:bg-purple-700">
              Add
            </button>
          </form>
        </section>

        {org.role === 'admin' && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">API Key</h2>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-4 space-y-3">
              <p className="text-xs text-gray-500">Configure the Anthropic API key used for synthesis. Projects can override this with their own key.</p>
              <ApiKeySection orgId={org.id} isAdmin={org.role === 'admin'} />
              <ApiKeyAuditLogs type="org" resourceId={org.id} />
            </div>
          </section>
        )}

        {org.role === 'admin' && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
            <ul className="space-y-2 mb-4">
              {members.map((m) => (
                <li key={m.userId} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex justify-between">
                  <span className="text-sm text-gray-900">{m.email}</span>
                  <span className="text-xs text-purple-500">{m.role}</span>
                </li>
              ))}
            </ul>
            {shownPassword && (
              <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm mb-4">
                <strong>Generated password (shown once):</strong>{' '}
                <code className="font-mono">{shownPassword}</code>
              </div>
            )}
            <form onSubmit={addMember} className="flex gap-2">
              <input
                type="email"
                placeholder="Member email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button type="submit" className="bg-purple-600 text-white rounded px-4 py-1.5 text-sm hover:bg-purple-700">
                Add member
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
