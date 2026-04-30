# UI Components for API Key Management

## Overview
React components for managing Anthropic API keys in the console application, integrated into existing organization and project detail pages with secure input handling and validation feedback.

## Organization API Key Management

### ApiKeySection Component
```typescript
// applications/console/src/components/ApiKeySection.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface ApiKeyStatus {
  hasApiKey: boolean;
  source: 'organization' | 'global';
  lastUpdated?: string;
  keyHash?: string;
}

interface Props {
  organizationId: string;
  level: 'organization' | 'project';
  resourceId: string;
}

export const ApiKeySection: React.FC<Props> = ({ organizationId, level, resourceId }) => {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeyStatus();
  }, [resourceId]);

  const loadApiKeyStatus = async () => {
    try {
      setLoading(true);
      const endpoint = level === 'organization' 
        ? `/orgs/${resourceId}/api-key/status`
        : `/projects/${resourceId}/api-key/status`;
      const response = await api.get(endpoint);
      setStatus(response.data);
    } catch (err: any) {
      setError('Failed to load API key status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium">Anthropic API Key</h3>
          <p className="text-sm text-gray-600 mt-1">
            {level === 'organization' 
              ? 'Configure your organization\'s Anthropic API key for synthesis operations.'
              : 'Override the organization API key for this specific project.'}
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {status?.hasApiKey ? 'Update Key' : 'Set API Key'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {!isEditing ? (
        <ApiKeyStatusDisplay status={status} level={level} />
      ) : (
        <ApiKeyForm
          level={level}
          resourceId={resourceId}
          onSave={() => {
            setIsEditing(false);
            loadApiKeyStatus();
          }}
          onCancel={() => setIsEditing(false)}
        />
      )}
    </div>
  );
};
```

### ApiKeyStatusDisplay Component
```typescript
// applications/console/src/components/ApiKeyStatusDisplay.tsx
import React from 'react';

interface Props {
  status: ApiKeyStatus | null;
  level: 'organization' | 'project';
}

export const ApiKeyStatusDisplay: React.FC<Props> = ({ status, level }) => {
  if (!status) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${
          status.hasApiKey ? 'bg-green-500' : 'bg-yellow-500'
        }`} />
        <span className="text-sm font-medium">
          {status.hasApiKey 
            ? `${level === 'organization' ? 'Organization' : 'Project'} API key configured`
            : 'Using global API key'}
        </span>
      </div>

      {status.hasApiKey && (
        <div className="text-sm text-gray-600 space-y-1">
          {status.lastUpdated && (
            <div>Last updated: {new Date(status.lastUpdated).toLocaleDateString()}</div>
          )}
          {status.keyHash && (
            <div className="font-mono text-xs">
              Key ID: {status.keyHash}
            </div>
          )}
        </div>
      )}

      {level === 'project' && status && (
        <ProjectKeyResolutionChain resourceId={resourceId} />
      )}
    </div>
  );
};
```

### ApiKeyForm Component
```typescript
// applications/console/src/components/ApiKeyForm.tsx
import React, { useState } from 'react';
import { api } from '../api';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface Props {
  level: 'organization' | 'project';
  resourceId: string;
  onSave: () => void;
  onCancel: () => void;
}

export const ApiKeyForm: React.FC<Props> = ({ level, resourceId, onSave, onCancel }) => {
  const [apiKey, setApiKey] = useState('');
  const [validateConnectivity, setValidateConnectivity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setValidation({
        isValid: false,
        errors: ['API key is required'],
        warnings: []
      });
      return;
    }

    try {
      setLoading(true);
      setValidation(null);

      const endpoint = level === 'organization' 
        ? `/orgs/${resourceId}/api-key`
        : `/projects/${resourceId}/api-key`;

      const response = await api.put(endpoint, {
        apiKey: apiKey.trim(),
        validateConnectivity
      });

      if (response.data.validation?.warnings.length > 0) {
        setValidation({
          isValid: true,
          errors: [],
          warnings: response.data.validation.warnings
        });
      }

      // Show success message briefly, then close
      setTimeout(onSave, 1000);
    } catch (err: any) {
      if (err.response?.data?.details) {
        setValidation({
          isValid: false,
          errors: err.response.data.details.validationErrors || [],
          warnings: err.response.data.details.validationWarnings || []
        });
      } else {
        setValidation({
          isValid: false,
          errors: ['Failed to save API key. Please try again.'],
          warnings: []
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove the ${level} API key? This will fall back to ${
      level === 'project' ? 'organization or global' : 'global'
    } API key.`)) {
      return;
    }

    try {
      setLoading(true);
      const endpoint = level === 'organization' 
        ? `/orgs/${resourceId}/api-key`
        : `/projects/${resourceId}/api-key`;
      
      await api.delete(endpoint);
      onSave();
    } catch (err) {
      setValidation({
        isValid: false,
        errors: ['Failed to delete API key. Please try again.'],
        warnings: []
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
          Anthropic API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-2 text-gray-500 hover:text-gray-700"
            disabled={loading}
          >
            {showKey ? '🙈' : '👁️'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Your API key will be encrypted and stored securely. Only the key hash will be visible for audit purposes.
        </p>
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={validateConnectivity}
            onChange={(e) => setValidateConnectivity(e.target.checked)}
            disabled={loading}
            className="mr-2"
          />
          <span className="text-sm text-gray-700">
            Test API key connectivity (recommended)
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          This will make a test API call to verify your key works. May incur minimal API usage.
        </p>
      </div>

      {validation && (
        <div className={`p-3 rounded border text-sm ${
          validation.isValid 
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {validation.errors.length > 0 && (
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <div className="mt-2 text-yellow-600">
              <strong>Warnings:</strong>
              <ul className="list-disc list-inside space-y-1 mt-1">
                {validation.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={handleDelete}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-600 rounded hover:bg-red-50"
          disabled={loading}
        >
          Remove API Key
        </button>
        
        <div className="space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
      </div>
    </form>
  );
};
```

## Project-Specific Components

### ProjectKeyResolutionChain Component
```typescript
// applications/console/src/components/ProjectKeyResolutionChain.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface ProjectApiKeyStatus {
  hasProjectApiKey: boolean;
  hasOrgApiKey: boolean;
  effectiveSource: 'project' | 'organization' | 'global';
  projectKeyLastUpdated?: string;
  orgKeyLastUpdated?: string;
}

interface Props {
  resourceId: string;
}

export const ProjectKeyResolutionChain: React.FC<Props> = ({ resourceId }) => {
  const [status, setStatus] = useState<ProjectApiKeyStatus | null>(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await api.get(`/projects/${resourceId}/api-key/status`);
        setStatus(response.data);
      } catch (err) {
        console.error('Failed to load project API key status:', err);
      }
    };
    loadStatus();
  }, [resourceId]);

  if (!status) return null;

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded border">
      <h4 className="text-sm font-medium text-gray-700 mb-2">API Key Resolution</h4>
      <div className="space-y-2 text-xs">
        <div className={`flex items-center space-x-2 ${
          status.effectiveSource === 'project' ? 'text-blue-600 font-medium' : 'text-gray-500'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            status.hasProjectApiKey ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          <span>Project API Key</span>
          {status.effectiveSource === 'project' && (
            <span className="bg-blue-100 text-blue-800 px-1 rounded">ACTIVE</span>
          )}
        </div>
        
        <div className={`flex items-center space-x-2 ${
          status.effectiveSource === 'organization' ? 'text-blue-600 font-medium' : 'text-gray-500'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            status.hasOrgApiKey ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          <span>Organization API Key</span>
          {status.effectiveSource === 'organization' && (
            <span className="bg-blue-100 text-blue-800 px-1 rounded">ACTIVE</span>
          )}
        </div>
        
        <div className={`flex items-center space-x-2 ${
          status.effectiveSource === 'global' ? 'text-blue-600 font-medium' : 'text-gray-500'
        }`}>
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Global API Key</span>
          {status.effectiveSource === 'global' && (
            <span className="bg-blue-100 text-blue-800 px-1 rounded">ACTIVE</span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-2">
        The effective API key is determined by the first available key in this priority order.
      </p>
    </div>
  );
};
```

## Integration with Existing Pages

### Organization Detail Page Updates
```typescript
// applications/console/src/pages/OrgDetail.tsx
import { ApiKeySection } from '../components/ApiKeySection';

// Add to existing OrgDetail component after organization name section:
export const OrgDetail: React.FC = () => {
  // ... existing code

  return (
    <div className="container mx-auto px-4 py-6">
      {/* ... existing organization header and name editing */}
      
      {/* Add API Key Management Section */}
      <div className="mt-8">
        <ApiKeySection
          organizationId={org.id}
          level="organization"
          resourceId={org.id}
        />
      </div>

      {/* ... existing projects list */}
    </div>
  );
};
```

### Project Detail Page Updates
```typescript
// applications/console/src/pages/ProjectDetail.tsx
import { ApiKeySection } from '../components/ApiKeySection';

// Add to existing ProjectDetail component:
export const ProjectDetail: React.FC = () => {
  // ... existing code

  return (
    <div className="container mx-auto px-4 py-6">
      {/* ... existing project header and details */}
      
      {/* Add API Key Management Section */}
      <div className="mt-8">
        <ApiKeySection
          organizationId={project.orgId}
          level="project"
          resourceId={project.id}
        />
      </div>

      {/* ... existing synthesis section */}
    </div>
  );
};
```

## Audit Logs Component

### ApiKeyAuditLogs Component
```typescript
// applications/console/src/components/ApiKeyAuditLogs.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface AuditLog {
  id: string;
  action: string;
  timestamp: string;
  userId: string;
  keyHash: string;
  details?: any;
  ipAddress?: string;
}

interface Props {
  level: 'organization' | 'project';
  resourceId: string;
}

export const ApiKeyAuditLogs: React.FC<Props> = ({ level, resourceId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) {
      loadAuditLogs();
    }
  }, [expanded, resourceId]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const endpoint = level === 'organization' 
        ? `/orgs/${resourceId}/api-key/audit-logs`
        : `/projects/${resourceId}/api-key/audit-logs`;
      const response = await api.get(endpoint, {
        params: { limit: 20 }
      });
      setLogs(response.data.logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-sm text-blue-600 hover:text-blue-800 mt-4"
      >
        View API Key Activity Log
      </button>
    );
  }

  return (
    <div className="mt-6 border-t pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium text-gray-900">API Key Activity</h4>
        <button
          onClick={() => setExpanded(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Hide
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-gray-200 rounded w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No activity recorded</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="text-xs border-b pb-2">
              <div className="flex justify-between items-start">
                <span className="font-medium capitalize">{log.action}</span>
                <span className="text-gray-500">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="text-gray-600 mt-1">
                Key ID: <span className="font-mono">{log.keyHash}</span>
                {log.ipAddress && (
                  <span className="ml-2">from {log.ipAddress}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Responsive Design Considerations

### Mobile-Friendly Layout
```css
/* Additional Tailwind classes for mobile responsiveness */
@media (max-width: 640px) {
  .api-key-form {
    @apply space-y-3;
  }
  
  .api-key-form .form-actions {
    @apply flex-col space-x-0 space-y-2;
  }
  
  .resolution-chain {
    @apply text-xs;
  }
}
```

## Security Considerations for UI

### Input Security
- Password-style input fields with show/hide toggle
- No autocomplete on API key fields
- Client-side format validation before submission
- Clear form data on component unmount

### State Management
- No API keys stored in component state longer than necessary
- Immediate clearing of sensitive data after successful submission
- No sensitive data in localStorage or sessionStorage

### Error Handling
- Generic error messages that don't expose system internals
- Validation feedback that guides users without revealing security details
- Graceful handling of network errors and timeouts