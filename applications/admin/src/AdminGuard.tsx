import { useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

const CONSOLE_ORIGIN = import.meta.env.VITE_CONSOLE_URL || 'http://localhost:5173';

interface Props {
  children: ReactNode;
}

type Status = 'loading' | 'allowed' | 'redirect-login' | 'redirect-root';

export default function AdminGuard({ children }: Props) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      setStatus('redirect-login');
      return;
    }

    api.me()
      .then((me) => {
        if (me.isPlatformAdmin) {
          setStatus('allowed');
        } else {
          setStatus('redirect-root');
        }
      })
      .catch(() => {
        setStatus('redirect-login');
      });
  }, []);

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (status === 'redirect-login') {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${CONSOLE_ORIGIN}/login?return_to=${returnTo}`;
    return null;
  }

  if (status === 'redirect-root') {
    window.location.href = CONSOLE_ORIGIN;
    return null;
  }

  return <>{children}</>;
}
