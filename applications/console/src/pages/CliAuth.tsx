import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

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

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center text-gray-500">
        {status === 'pending' ? 'Authorizing CLI...' : 'Done. You can close this tab.'}
      </div>
    </div>
  );
}
