import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export default function CliAuth() {
  const { token, logout } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending');
  const [errorMsg, setErrorMsg] = useState('');

  const port = params.get('port');
  const state = params.get('state');

  useEffect(() => {
    if (!token) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!port || !state) {
      setStatus('error');
      setErrorMsg('Missing port or state parameters');
      return;
    }

    api.cliToken().then(({ token: cliToken }) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      window.location.href = `http://localhost:${port}/callback?token=${encodeURIComponent(cliToken)}&api_url=${encodeURIComponent(apiUrl)}`;
      setStatus('done');
    }).catch((err) => {
      if (err.status === 401) {
        logout();
        navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      setStatus('error');
      setErrorMsg(err.message || 'Failed to issue CLI token');
    });
  }, [token, port, state]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center relative overflow-hidden">
      {/* Glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-indigo/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none" />

      {/* Theme toggle top-right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm p-8 relative z-10 text-center">
        {status === 'error' ? (
          <>
            <h1 className="text-xl font-semibold mb-4 text-text-primary animate-fade-up">Authorization Error</h1>
            <p className="text-danger text-sm mb-6">{errorMsg}</p>
            <Button variant="secondary" onClick={() => navigate('/')}>
              Go to dashboard
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold mb-4 text-text-primary animate-fade-up">CLI Authorization</h1>
            <p className="text-text-muted text-sm animate-fade-up animate-delay-100">
              {status === 'pending' ? 'Authorizing CLI...' : 'Done. You can close this tab.'}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
