import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900">Create account</h1>
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
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              id="persistent-register"
              checked={persistent}
              onChange={handlePersistentChange}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="persistent-register" className="ml-2 block text-sm text-gray-700">
              Save Login
            </label>
          </div>
          <p className="text-xs text-gray-500">Stay signed in across browser sessions</p>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white rounded py-2 text-sm font-medium hover:bg-purple-700"
          >
            Create account
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500 text-center">
          Already have an account? <Link to="/login" className="text-purple-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
