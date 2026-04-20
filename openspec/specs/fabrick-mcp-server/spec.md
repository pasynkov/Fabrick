## ADDED Requirements

### Requirement: SSE endpoint accepts CLI token auth
The MCP server SHALL accept connections only when a valid CLI token is provided as `?token=` query param. Invalid or missing token SHALL return HTTP 401 before the SSE stream opens.

#### Scenario: Valid token accepted
- **WHEN** client connects to `GET /sse?token={validToken}&org=myorg&project=myproject`
- **THEN** SSE stream opens and MCP handshake completes

#### Scenario: Invalid token rejected
- **WHEN** client connects with an invalid or missing token
- **THEN** server returns HTTP 401 and closes connection

### Requirement: get_synthesis_index tool returns index.md
The MCP server SHALL expose a tool `get_synthesis_index` that reads `{projectSlug}/synthesis/index.md` from MinIO and returns its content.

#### Scenario: Synthesis exists
- **WHEN** `get_synthesis_index` is called and synthesis files exist in MinIO
- **THEN** tool returns the full text content of `index.md`

#### Scenario: Synthesis not found
- **WHEN** `get_synthesis_index` is called and no synthesis files exist
- **THEN** tool returns an error string: `"Synthesis not available for project '{slug}'. Run synthesis first."`

### Requirement: get_synthesis_file tool returns any synthesis file
The MCP server SHALL expose a tool `get_synthesis_file(path: string)` that reads any file under `{projectSlug}/synthesis/{path}` from MinIO and returns its content.

#### Scenario: File exists
- **WHEN** `get_synthesis_file("cross-cutting/envs.md")` is called and file exists
- **THEN** tool returns the full text content of the file

#### Scenario: File not found
- **WHEN** `get_synthesis_file` is called with a path that does not exist
- **THEN** tool returns an error string: `"File '{path}' not found in synthesis for project '{slug}'."`

### Requirement: Token is not logged
The MCP server SHALL strip the `token` query parameter from all access logs.

#### Scenario: Request logged without token
- **WHEN** a request arrives with `?token=secret&org=x&project=y`
- **THEN** logs show the request URL without the token value
