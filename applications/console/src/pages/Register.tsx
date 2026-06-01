import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export default function Register() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [persistent, setPersistent] = useState(
    () => localStorage.getItem('saveLogin') === 'true',
  );
  const [error, setError] = useState('');

  function handlePersistentChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPersistent(e.target.checked);
    localStorage.setItem('saveLogin', String(e.target.checked));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.register(email, password, persistent);
      setAuth(res.access_token, res.user, res.refresh_token, persistent);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center relative overflow-hidden">
      {/* Glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-indigo/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none" />

      {/* Theme toggle top-right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm p-8 relative z-10">
        <h1 className="text-2xl font-semibold mb-6 text-text-primary animate-fade-up">Create account</h1>
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              id="persistent-register"
              checked={persistent}
              onChange={handlePersistentChange}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="persistent-register" className="ml-2 block text-sm text-text-muted">
              Save Login
            </label>
          </div>
          <p className="text-xs text-text-muted">Stay signed in across browser sessions</p>
          <Button type="submit" variant="primary" className="w-full animate-fade-up animate-delay-100">
            Create account
          </Button>
        </form>
        <p className="mt-4 text-sm text-text-muted text-center">
          Already have an account? <Link to="/login" className="text-accent-indigo hover:text-accent-indigo-dim">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
