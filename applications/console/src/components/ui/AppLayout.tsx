import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './Button';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <header className="bg-surface-1 border-b border-border px-6 py-3 flex justify-between items-center">
        <Link to="/" className="font-semibold text-text-primary hover:text-accent-indigo transition-colors duration-200">
          Fabrick
        </Link>
        <div className="flex items-center gap-3">
          {user?.isPlatformAdmin && (
            <a
              href="/admin"
              className="text-sm text-accent-indigo hover:text-accent-indigo-dim transition-colors duration-200"
            >
              Admin
            </a>
          )}
          <span className="text-sm text-text-muted">{user?.email}</span>
          <ThemeToggle />
          <Button variant="danger" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-10">
        {children}
      </main>
    </div>
  );
}
