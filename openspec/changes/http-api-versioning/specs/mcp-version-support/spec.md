# MCP Version Support Specification

## Overview
Update the Fabrick MCP (Model Context Protocol) server to support versioned API endpoints, ensuring compatibility with the new `/v1` API structure.

## Requirements

### Functional Requirements
- All synthesis API calls must use `/v1` prefix
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
): Promise<string> {
  const url = `${apiUrl}/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/synthesis/file?path=${encodeURIComponent(path)}`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  
  return res.text();
}
```

### MCP Tool Handler Updates
```typescript
// index.ts - Update tool handlers to use versioned API
import { getSynthesisFile } from './api-client.js';

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
    const { path } = args as { path: string };
    
    try {
      const content = await getSynthesisFile(
        apiUrl,
        organization,
        project,
        path,
        token,
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

### MCP Server Configuration
```json
{
  "mcpServers": {
    "fabrick": {
      "command": "npx",
      "args": ["@fabrick/mcp-server"],
      "env": {
        "FABRICK_API_URL": "https://api.fabrick.me",
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
- Maintain existing tool schemas unchanged
- All API calls use `/v1` prefix internally

### Error Handling
```typescript
// Error handling for API issues
try {
  const result = await getSynthesisFile(apiUrl, org, project, path, token);
  return { content: [{ type: 'text', text: result }] };
} catch (error) {
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

    await getSynthesisFile('https://api.test.com', 'org', 'project', 'file.txt', 'token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/orgs/org/projects/project/synthesis/file?path=file.txt',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      })
    );
  });
});
```

### Integration Tests
- Test MCP tools with versioned API endpoints
- Verify error handling for API errors

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

## Security Considerations

### Token Security
- Ensure authentication works correctly with versioned endpoints
- Verify token validation and refresh mechanisms
- Maintain existing security practices

### Error Information
- Avoid exposing sensitive information in version-related errors
- Maintain secure error handling practices
- Log appropriate information for debugging without exposing credentials