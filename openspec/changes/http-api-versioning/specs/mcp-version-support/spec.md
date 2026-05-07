# MCP Version Support Specification

## Overview
Update the Fabrick MCP (Model Context Protocol) server to support versioned API endpoints, ensuring compatibility with the new `/v1` API structure.

## Requirements

### Functional Requirements
- All synthesis API calls must use `/v1` prefix
- Support for version parameter in API client functions
- Maintain existing MCP tool functionality
- Error handling for version compatibility issues

### Non-Functional Requirements
- No breaking changes to MCP tool interfaces
- Preserve existing Claude integration functionality
- Minimal performance impact from versioned endpoints
- Clean error reporting for version-related issues

## Implementation Details

### API Client Updates
```typescript
// api-client.ts modifications
export async function getSynthesisFile(
  apiUrl: string,
  org: string,
  project: string,
  path: string,
  token: string,
  version: string = 'v1', // Add version parameter with default
): Promise<string> {
  const versionPrefix = `/v${version}`;
  const url = `${apiUrl}${versionPrefix}/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/synthesis/file?path=${encodeURIComponent(path)}`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) {
    if (res.status === 404) {
      const body = await res.json().catch(() => ({}));
      if (body.message?.includes('version')) {
        throw new Error(`API version ${version} not supported`);
      }
    }
    throw new Error(`API returned ${res.status}`);
  }
  
  return res.text();
}
```

### Additional API Functions
```typescript
// Add version support to other API functions as needed
export async function triggerSynthesis(
  apiUrl: string,
  org: string,
  project: string,
  token: string,
  version: string = 'v1',
): Promise<void> {
  const versionPrefix = `/v${version}`;
  const url = `${apiUrl}${versionPrefix}/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/synthesis`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) {
    throw new Error(`Synthesis trigger failed: ${res.status}`);
  }
}

export async function getSynthesisStatus(
  apiUrl: string,
  org: string,
  project: string,
  token: string,
  version: string = 'v1',
): Promise<{ status: string; error?: string }> {
  const versionPrefix = `/v${version}`;
  const url = `${apiUrl}${versionPrefix}/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/synthesis/status`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) {
    throw new Error(`Status check failed: ${res.status}`);
  }
  
  return res.json();
}
```

### MCP Tool Handler Updates
```typescript
// index.ts - Update tool handlers to use versioned API
import { getSynthesisFile, triggerSynthesis, getSynthesisStatus } from './api-client.js';

// Tool handlers use versioned API functions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_synthesis_file',
        description: 'Get a specific file from the synthesis output',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            version: { type: 'string', default: 'v1' }, // Add version parameter
          },
          required: ['path'],
        },
      },
      // ... other tools
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'get_synthesis_file') {
    const { path, version = 'v1' } = args as { path: string; version?: string };
    
    try {
      const content = await getSynthesisFile(
        apiUrl,
        organization,
        project,
        path,
        token,
        version
      );
      
      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }],
        isError: true,
      };
    }
  }
  
  // ... other tool handlers
});
```

## Configuration Management

### Environment Configuration
```typescript
// Support for API version configuration
const apiVersion = process.env.FABRICK_API_VERSION || 'v1';

// Use in API client calls
const content = await getSynthesisFile(
  apiUrl,
  organization,
  project,
  path,
  token,
  apiVersion
);
```

### MCP Server Configuration
```json
{
  "mcpServers": {
    "fabrick": {
      "command": "npx",
      "args": ["@fabrick/mcp-server"],
      "env": {
        "FABRICK_API_URL": "https://api.fabrick.me",
        "FABRICK_API_VERSION": "v1",
        "FABRICK_ORGANIZATION": "your-org",
        "FABRICK_PROJECT": "your-project",
        "FABRICK_TOKEN": "your-token"
      }
    }
  }
}
```

## Tool Interface Updates

### Tool Definitions
- Add optional version parameter to tool schemas
- Maintain backward compatibility with existing tools
- Default to v1 for all version-aware operations

### Error Handling
```typescript
// Enhanced error handling for version issues
try {
  const result = await getSynthesisFile(apiUrl, org, project, path, token, version);
  return { content: [{ type: 'text', text: result }] };
} catch (error) {
  if (error instanceof Error && error.message.includes('version')) {
    return {
      content: [{ 
        type: 'text', 
        text: `API version error: ${error.message}. Try using version 'v1' or check with your administrator.` 
      }],
      isError: true,
    };
  }
  
  return {
    content: [{ 
      type: 'text', 
      text: `API error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }],
    isError: true,
  };
}
```

## Testing Requirements

### Unit Tests
```typescript
// api-client.test.ts updates
describe('getSynthesisFile', () => {
  it('should use correct versioned URL', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('file content'),
    });
    global.fetch = mockFetch;

    await getSynthesisFile('https://api.test.com', 'org', 'project', 'file.txt', 'token', 'v1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/orgs/org/projects/project/synthesis/file?path=file.txt',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      })
    );
  });

  it('should handle version-related errors', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'API version v2 not supported' }),
    });
    global.fetch = mockFetch;

    await expect(
      getSynthesisFile('https://api.test.com', 'org', 'project', 'file.txt', 'token', 'v2')
    ).rejects.toThrow('API version v2 not supported');
  });
});
```

### Integration Tests
- Test MCP tools with versioned API endpoints
- Verify error handling for invalid versions
- Test tool parameter validation including version

### E2E Tests
- Test full MCP workflow with versioned backend
- Verify Claude integration works correctly
- Test error scenarios and recovery

## Documentation Updates

### Tool Documentation
- Update tool descriptions to mention version support
- Document version parameter usage
- Provide examples with different API versions

### Configuration Documentation
- Document environment variable for API version
- Provide configuration examples for different setups
- Update troubleshooting guides for version issues

### MCP Server Setup
- Update installation and configuration guides
- Document version compatibility matrix
- Provide migration instructions for existing setups

## Backward Compatibility

### Existing Installations
- Default to v1 for existing MCP server configurations
- No breaking changes to tool interfaces
- Graceful handling of missing version parameters

### Migration Path
- Existing tools continue to work without modification
- Optional version parameter for future compatibility
- Clear upgrade path documentation

## Security Considerations

### Token Security
- Ensure authentication works correctly with versioned endpoints
- Verify token validation and refresh mechanisms
- Maintain existing security practices

### Error Information
- Avoid exposing sensitive information in version-related errors
- Maintain secure error handling practices
- Log appropriate information for debugging without exposing credentials