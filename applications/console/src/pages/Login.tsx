import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Login() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
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
      const res = await api.login(email, password, persistent);
      setAuth(res.access_token, res.user, res.refresh_token, persistent);
      navigate(params.get('next') || '/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900">Sign in</h1>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              id="persistent-login"
              checked={persistent}
              onChange={handlePersistentChange}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="persistent-login" className="ml-2 block text-sm text-gray-700">
              Save Login
            </label>
          </div>
          <p className="text-xs text-gray-500">Stay signed in across browser sessions</p>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white rounded py-2 text-sm font-medium hover:bg-purple-700"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500 text-center">
          No account? <Link to="/register" className="text-purple-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
