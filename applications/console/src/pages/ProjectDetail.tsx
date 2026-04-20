import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

interface Repo { id: string; name: string; slug: string; gitRemote: string }
interface Project { id: string; name: string; slug: string }

export default function ProjectDetail() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.orgs.list().then((orgs) => {
      const org = orgs.find((o) => o.slug === orgSlug);
      if (!org) return;
      api.projects.list(org.id).then((projects) => {
        const p = projects.find((pr) => pr.slug === projectSlug);
        if (!p) return;
        setProject(p);
        api.repos.list(p.id).then(setRepos).finally(() => setLoading(false));
      });
    });
  }, [orgSlug, projectSlug]);

  if (!project) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <nav className="text-sm text-gray-500">
          <Link to="/" className="hover:underline">Orgs</Link>
          <span className="mx-2">/</span>
          <Link to={`/orgs/${orgSlug}`} className="hover:underline">{orgSlug}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">{project.name}</span>
        </nav>
      </header>
      <main className="max-w-2xl mx-auto py-10 px-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Repositories</h2>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : repos.length === 0 ? (
          <p className="text-gray-400">No repositories. Run <code className="bg-gray-100 px-1 rounded">fabrick init</code> in a repo.</p>
        ) : (
          <ul className="space-y-2">
            {repos.map((r) => (
              <li key={r.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <span className="font-medium text-gray-900">{r.name}</span>
                <span className="ml-2 text-xs text-gray-400 font-mono">{r.gitRemote}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
