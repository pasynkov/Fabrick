import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { ApiKeySection } from '../components/ApiKeySection';
import { ApiKeyAuditLogs } from '../components/ApiKeyAuditLogs';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

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

  if (!org) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-text-muted">Loading...</p>
    </div>
  );

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <nav className="text-sm text-text-muted">
          <Link to="/" className="hover:text-text-primary transition-colors">Orgs</Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary font-medium">{org.name}</span>
        </nav>
        {org.role === 'admin' && (
          <Link
            to={`/orgs/${orgSlug}/settings`}
            className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 border border-border bg-surface-1/50 text-text-primary hover:bg-surface-2 px-3 py-1.5 text-xs"
          >
            Edit Settings
          </Link>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Projects</h2>
          <ul className="space-y-2 mb-4">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Card interactive as={Link} to={`/orgs/${orgSlug}/projects/${p.slug}`} className="flex-1 block px-4 py-3">
                  <span className="font-medium text-text-primary">{p.name}</span>
                  <span className="ml-2 text-xs text-text-muted">{p.slug}</span>
                </Card>
                {org.role === 'admin' && (
                  <Link
                    to={`/orgs/${orgSlug}/projects/${p.slug}/settings`}
                    className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 border border-border bg-surface-1/50 text-text-primary hover:bg-surface-2 px-3 py-1.5 text-xs"
                  >
                    Settings
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={createProject} className="flex gap-2">
            <Input
              type="text"
              placeholder="New project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Button type="submit" variant="primary" size="sm">Add</Button>
          </form>
        </section>

        {org.role === 'admin' && (
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">API Key</h2>
            <Card className="px-4 py-4 space-y-3">
              <p className="text-xs text-text-muted">Configure the Anthropic API key used for synthesis. Projects can override this with their own key.</p>
              <ApiKeySection orgId={org.id} isAdmin={org.role === 'admin'} />
              <ApiKeyAuditLogs type="org" resourceId={org.id} />
            </Card>
          </section>
        )}

        {org.role === 'admin' && (
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Members</h2>
            <ul className="space-y-2 mb-4">
              {members.map((m) => (
                <li key={m.userId}>
                  <Card className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-text-primary">{m.email}</span>
                    <span className="text-xs text-accent-indigo">{m.role}</span>
                  </Card>
                </li>
              ))}
            </ul>
            {shownPassword && (
              <div className="bg-surface-2 border border-border rounded-lg p-3 text-sm mb-4">
                <strong className="text-text-primary">Generated password (shown once):</strong>{' '}
                <code className="font-mono text-accent-indigo">{shownPassword}</code>
              </div>
            )}
            <form onSubmit={addMember} className="flex gap-2">
              <Input
                type="email"
                placeholder="Member email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <Button type="submit" variant="primary" size="sm">Add member</Button>
            </form>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
