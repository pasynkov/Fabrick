import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { ProjectKeyResolutionChain } from '../components/ProjectKeyResolutionChain';
import { ApiKeyAuditLogs } from '../components/ApiKeyAuditLogs';
import { WikiSearch } from '../components/WikiSearch';
import { WikiPagesTable } from '../components/WikiPagesTable';
import { WikiPageView } from '../components/WikiPageView';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

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
  const [synthTriggering, setSynthTriggering] = useState(false);
  const [selectedWikiSlug, setSelectedWikiSlug] = useState<string | null>(null);
  const [wikiKey, setWikiKey] = useState(0);
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
          if (s.status === 'done') setWikiKey((k) => k + 1);
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

  async function handleRunSynthesis() {
    if (!project) return;
    setSynthTriggering(true);
    try {
      await api.synthesis.trigger(project.id);
      setSynthStatus('running');
      setSynthError(undefined);
      startPolling(project.id);
    } catch (e: any) {
      setSynthError(e.message);
    } finally {
      setSynthTriggering(false);
    }
  }

  if (!project) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-text-muted">Loading...</p>
    </div>
  );

  const noApiKey = hasEffectiveApiKey === false;
  const synthButtonDisabled = synthTriggering || synthStatus === 'running' || noApiKey;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <nav className="text-sm text-text-muted">
          <Link to="/" className="hover:text-text-primary transition-colors">Orgs</Link>
          <span className="mx-2">/</span>
          <Link to={`/orgs/${orgSlug}`} className="hover:text-text-primary transition-colors">{orgSlug}</Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary font-medium">{project.name}</span>
        </nav>
        <div className="flex items-center gap-2">
          <Button as={Link} to={`/orgs/${orgSlug}/projects/${projectSlug}/analytics`} variant="secondary" size="sm">
            Analytics
          </Button>
          {orgInfo?.role === 'admin' && (
            <Button as={Link} to={`/orgs/${orgSlug}/projects/${projectSlug}/settings`} variant="secondary" size="sm">
              Edit Settings
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Repositories</h2>
          {loading ? (
            <p className="text-text-muted">Loading...</p>
          ) : repos.length === 0 ? (
            <p className="text-text-muted">No repositories. Run <code className="bg-surface-2 px-1 rounded text-text-primary">fabrick init</code> in a repo.</p>
          ) : (
            <ul className="space-y-2">
              {repos.map((r) => (
                <li key={r.id}>
                  <Card className="px-4 py-3">
                    <span className="font-medium text-text-primary">{r.name}</span>
                    <span className="ml-2 text-xs text-text-muted font-mono">{r.gitRemote}</span>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {orgInfo && (
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">API Key</h2>
            <Card className="px-4 py-4 space-y-3">
              <ProjectKeyResolutionChain
                orgId={orgInfo.id}
                projectId={project.id}
                isAdmin={orgInfo.role === 'admin'}
              />
              {orgInfo.role === 'admin' && (
                <ApiKeyAuditLogs type="project" resourceId={project.id} />
              )}
            </Card>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Synthesis</h2>
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={handleRunSynthesis}
                disabled={synthButtonDisabled}
                variant="primary"
                size="sm"
              >
                {synthStatus === 'running' ? 'Running...' : 'Run Synthesis'}
              </Button>
              {noApiKey && (
                <p className="text-xs text-text-muted">
                  <Link
                    to={`/orgs/${orgSlug}/projects/${projectSlug}/settings`}
                    className="text-accent-indigo hover:text-accent-indigo-dim"
                  >
                    Add API key to enable synthesis
                  </Link>
                </p>
              )}
            </div>
          </div>

          {synthStatus === 'idle' && (
            <p className="text-text-muted text-sm">No synthesis yet. Push wiki and run synthesis.</p>
          )}

          {synthStatus === 'running' && (
            <div className="flex items-center gap-2 text-accent-indigo text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Synthesis running...
            </div>
          )}

          {synthStatus === 'error' && (
            <Card className="px-4 py-3 border-danger/30">
              <span className="font-medium text-danger text-sm">Error:</span>{' '}
              <span className="text-sm text-text-primary">{synthError || 'Unknown error'}</span>
            </Card>
          )}
        </section>

        {orgSlug && projectSlug && synthStatus === 'done' && (
          <>
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Search Wiki</h2>
              <WikiSearch orgSlug={orgSlug} projectSlug={projectSlug} hasApiKey={!noApiKey} />
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Wiki Pages</h2>
              {selectedWikiSlug ? (
                <WikiPageView
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  slug={selectedWikiSlug}
                  onBack={() => setSelectedWikiSlug(null)}
                  onNavigate={setSelectedWikiSlug}
                />
              ) : (
                <WikiPagesTable
                  key={wikiKey}
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  onSelectPage={setSelectedWikiSlug}
                />
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
