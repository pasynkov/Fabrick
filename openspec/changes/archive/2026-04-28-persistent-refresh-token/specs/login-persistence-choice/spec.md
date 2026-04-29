# Login Persistence Choice

## Overview

Provides UI components and user experience for choosing between session-based and persistent authentication through a "Save Login" checkbox in login and register forms.

## Requirements

### Functional Requirements

#### UI Components
- Add "Save Login" checkbox to login form
- Add "Save Login" checkbox to register form
- Checkbox defaults to unchecked (session-based authentication)
- Clear labeling to explain persistence behavior
- Accessible form controls with proper ARIA attributes

#### User Experience
- Intuitive checkbox placement within form layout
- Consistent styling with existing form elements
- Clear indication of security implications
- Responsive design for mobile devices

#### State Management
- Track checkbox state in form component
- **Persist checkbox state in localStorage** (key: `saveLogin`) across browser sessions
- Initialize checkbox from localStorage on component mount
- Pass persistent preference to authentication API

### UI/UX Requirements

#### Checkbox Design
- Use existing design system checkbox component
- Position below password field, above submit button
- Include descriptive label text
- Use appropriate spacing and alignment

#### Labeling
- Primary label: "Save Login" or "Keep me signed in"
- Optional subtitle: "Stay signed in across browser sessions"
- Clear, concise language explaining behavior

#### Accessibility
- Proper label association with checkbox
- Keyboard navigation support
- Screen reader compatibility
- Appropriate ARIA attributes

## Implementation

### Login Form Component

```typescript
// Login.tsx
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
    () => localStorage.getItem('saveLogin') === 'true' // Restore from localStorage
  );
  const [error, setError] = useState('');

  function handlePersistentChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPersistent(e.target.checked);
    localStorage.setItem('saveLogin', String(e.target.checked)); // Persist preference
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.login(email, password, persistent); // Pass persistent flag
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
          
          {/* New persistent login checkbox */}
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
          <p className="text-xs text-gray-500">
            Stay signed in across browser sessions
          </p>
          
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
```

### Register Form Component

```typescript
// Register.tsx
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
    () => localStorage.getItem('saveLogin') === 'true' // Restore from localStorage
  );
  const [error, setError] = useState('');

  function handlePersistentChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPersistent(e.target.checked);
    localStorage.setItem('saveLogin', String(e.target.checked)); // Persist preference
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.register(email, password, persistent); // Pass persistent flag
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
          
          {/* New persistent login checkbox */}
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
          <p className="text-xs text-gray-500">
            Stay signed in across browser sessions
          </p>
          
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
```

### API Client Updates

```typescript
// api.ts - Update authentication methods
class ApiClient {
  // ... existing methods

  async login(email: string, password: string, persistent?: boolean) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({ email, password, persistent }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }

  async register(email: string, password: string, persistent?: boolean) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({ email, password, persistent }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }

  // ... other methods
}
```

## Styling

### CSS Classes
```css
/* Checkbox styling to match existing form elements */
.persistent-checkbox {
  @apply h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded;
}

.persistent-label {
  @apply ml-2 block text-sm text-gray-700;
}

.persistent-description {
  @apply text-xs text-gray-500 mt-1;
}

/* Container for checkbox and label */
.persistent-choice {
  @apply flex items-center space-x-2;
}
```

### Responsive Design
```css
/* Mobile-first responsive adjustments */
@media (max-width: 640px) {
  .persistent-choice {
    @apply flex-col items-start space-x-0 space-y-1;
  }
  
  .persistent-description {
    @apply text-left ml-0;
  }
}
```

## Testing

### Component Tests
```typescript
// Login.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';

describe('Login Component', () => {
  it('renders save login checkbox', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    expect(screen.getByLabelText('Save Login')).toBeInTheDocument();
    expect(screen.getByText('Stay signed in across browser sessions')).toBeInTheDocument();
  });

  it('checkbox is unchecked by default', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const checkbox = screen.getByLabelText('Save Login') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('toggles checkbox state', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const checkbox = screen.getByLabelText('Save Login') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  // Test form submission with persistent flag
  // Test API integration
});
```

### Accessibility Tests
```typescript
// Accessibility tests
describe('Login Accessibility', () => {
  it('has proper label association', () => {
    render(<Login />);
    const checkbox = screen.getByRole('checkbox', { name: 'Save Login' });
    expect(checkbox).toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    render(<Login />);
    const checkbox = screen.getByLabelText('Save Login');
    checkbox.focus();
    fireEvent.keyDown(checkbox, { key: ' ' });
    expect(checkbox).toBeChecked();
  });
});
```

## User Experience Flow

### First Time User
1. User visits login page
2. Checkbox is unchecked by default
3. User can optionally check "Save Login"
4. Form submission includes persistence preference
5. Authentication behaves according to choice

### Returning User (Persistent)
1. User opens browser after session ended
2. Application detects persistent refresh token
3. Automatically refreshes authentication
4. User is logged in without manual intervention

### Returning User (Session)
1. User opens browser after session ended
2. No persistent tokens found
3. User is redirected to login page
4. Normal login flow required

## Security Considerations

### User Education
- Clear labeling explains security implications
- Optional tooltip or help text for security-conscious users
- Default to more secure option (session-based)

### Visual Indicators
- Use standard checkbox design patterns
- Maintain consistency with security best practices
- Avoid encouraging risky behavior through design