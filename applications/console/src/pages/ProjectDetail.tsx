import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { ProjectKeyResolutionChain } from '../components/ProjectKeyResolutionChain';
import { ApiKeyAuditLogs } from '../components/ApiKeyAuditLogs';

interface Repo { id: string; name: string; slug: string; gitRemote: string }
interface Project { id: string; name: string; slug: string }
interface OrgInfo { id: string; role: string }

export default function ProjectDetail() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasEffectiveApiKey, setHasEffectiveApiKey] = useState<boolean | null>(null);

  const [synthStatus, setSynthStatus] = useState<string>('idle');
  const [synthError, setSynthError] = useState<string | undefined>();
  const [synthFiles, setSynthFiles] = useState<Record<string, string> | null>(null);
  const [synthTriggering, setSynthTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.orgs.list().then((orgs) => {
      const org = orgs.find((o) => o.slug === orgSlug);
      if (!org) return;
      setOrgInfo({ id: org.id, role: org.role });
      api.projects.list(org.id).then((projects) => {
        const p = projects.find((pr) => pr.slug === projectSlug);
        if (!p) return;
        setProject(p);
        api.repos.list(p.id).then(setRepos).finally(() => setLoading(false));
        api.synthesis.status(p.id).then((s) => {
          setSynthStatus(s.status);
          setSynthError(s.error);
          if (s.status === 'running') startPolling(p.id);
          if (s.status === 'done') loadFiles(p.id);
        }).catch(() => {});
        api.projects.apiKey.status(p.id).then((s) => {
          setHasEffectiveApiKey(s.effectiveSource !== 'none');
        }).catch(() => {
          setHasEffectiveApiKey(false);
        });
      });
    });
    return () => stopPolling();
  }, [orgSlug, projectSlug]);

  function startPolling(projectId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.synthesis.status(projectId);
        setSynthStatus(s.status);
        setSynthError(s.error);
        if (s.status !== 'running') {
          stopPolling();
          if (s.status === 'done') loadFiles(projectId);
        }
      } catch {}
    }, 3000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function loadFiles(projectId: string) {
    try {
      const files = await api.synthesis.files(projectId);
      setSynthFiles(files);
    } catch {}
  }

  async function handleRunSynthesis() {
    if (!project) return;
    setSynthTriggering(true);
    try {
      await api.synthesis.trigger(project.id);
      setSynthStatus('running');
      setSynthError(undefined);
      setSynthFiles(null);
      startPolling(project.id);
    } catch (e: any) {
      setSynthError(e.message);
    } finally {
      setSynthTriggering(false);
    }
  }

  if (!project) return <div className="p-8 text-gray-400">Loading...</div>;

  const noApiKey = hasEffectiveApiKey === false;
  const synthButtonDisabled = synthTriggering || synthStatus === 'running' || noApiKey;

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
      <main className="max-w-2xl mx-auto py-10 px-4 space-y-8">
        <section>
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
        </section>

        {orgInfo && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">API Key</h2>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-4 space-y-3">
              <ProjectKeyResolutionChain
                orgId={orgInfo.id}
                projectId={project.id}
                isAdmin={orgInfo.role === 'admin'}
              />
              {orgInfo.role === 'admin' && (
                <ApiKeyAuditLogs type="project" resourceId={project.id} />
              )}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Synthesis</h2>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleRunSynthesis}
                disabled={synthButtonDisabled}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {synthStatus === 'running' ? 'Running...' : 'Run Synthesis'}
              </button>
              {noApiKey && (
                <p className="text-xs text-gray-500">
                  <Link
                    to={`/orgs/${orgSlug}/projects/${projectSlug}/settings`}
                    className="text-purple-600 hover:underline"
                  >
                    Add API key to enable synthesis
                  </Link>
                </p>
              )}
            </div>
          </div>

          {synthStatus === 'idle' && (
            <p className="text-gray-400 text-sm">No synthesis yet. Push context and run synthesis.</p>
          )}

          {synthStatus === 'running' && (
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Synthesis running...
            </div>
          )}

          {synthStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <span className="font-medium">Error:</span> {synthError || 'Unknown error'}
            </div>
          )}

          {synthStatus === 'done' && synthFiles && (
            <div className="space-y-3">
              {Object.entries(synthFiles).map(([path, content]) => (
                <details key={path} className="bg-white border border-gray-200 rounded-lg">
                  <summary className="px-4 py-3 cursor-pointer font-mono text-sm text-gray-700 hover:bg-gray-50 select-none">
                    {path}
                  </summary>
                  <pre className="px-4 py-3 text-xs text-gray-600 whitespace-pre-wrap border-t border-gray-100 overflow-auto max-h-64">
                    {content}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
