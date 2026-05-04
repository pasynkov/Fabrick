## MODIFIED Requirements

### Requirement: Project creation within an org
The system SHALL expose `POST /orgs/:orgId/projects` (JWT-authenticated, org members only) accepting `{ name }`. It SHALL derive a slug from the name and validate uniqueness within the org.

#### Scenario: Successful project creation
- **WHEN** an org member sends `POST /orgs/:orgId/projects` with `{ name: "Backend" }`
- **THEN** the system creates a project with slug `backend` under the org, returns HTTP 201 with `{ id, name, slug, orgId }`

#### Scenario: Duplicate project slug within org
- **WHEN** a project with the derived slug already exists in the org
- **THEN** the system returns HTTP 409

#### Scenario: Non-member attempt
- **WHEN** a user not in the org sends `POST /orgs/:orgId/projects`
- **THEN** the system returns HTTP 403

### Requirement: List org projects
The system SHALL expose `GET /orgs/:orgId/projects` returning all projects in the org for any org member.

#### Scenario: List projects
- **WHEN** an org member sends `GET /orgs/:orgId/projects`
- **THEN** the system returns HTTP 200 with array of `{ id, name, slug }`

### Requirement: Repository creation within a project
The system SHALL expose `POST /projects/:projectId/repos` (JWT-authenticated, org members only) accepting `{ name, gitRemote }`. It SHALL normalize `gitRemote` (strip protocol, strip `.git` suffix) and validate uniqueness globally by normalized git remote. Repo slug is derived from the last path segment of the normalized remote.

#### Scenario: Successful repo creation
- **WHEN** a member sends `POST /projects/:projectId/repos` with `{ name: "api", gitRemote: "https://github.com/acme/api.git" }`
- **THEN** the system creates repo with `git_remote: "github.com/acme/api"`, slug `api`, returns HTTP 201 with `{ id, name, slug, gitRemote, projectId }`

#### Scenario: Duplicate git remote
- **WHEN** a repo with the same normalized git remote already exists
- **THEN** the system returns HTTP 409

### Requirement: Find or create repository by git remote (used by CLI)
The system SHALL expose `POST /repos/find-or-create` (CLI-token-authenticated) accepting `{ gitRemote, projectId }`. It SHALL normalize the remote, find existing repo or create one, and return the repo record. The requesting user must be a member of the project's org.

#### Scenario: Repo exists — returns it
- **WHEN** CLI sends `POST /repos/find-or-create` with a git remote that matches an existing repo in an org the user belongs to
- **THEN** the system returns HTTP 200 with `{ id, name, slug, gitRemote, projectId }`

#### Scenario: Repo does not exist — creates it
- **WHEN** CLI sends `POST /repos/find-or-create` with a new git remote and valid `projectId`
- **THEN** the system creates the repo and returns HTTP 201

#### Scenario: User not in org
- **WHEN** CLI sends `POST /repos/find-or-create` for a project whose org the user doesn't belong to
- **THEN** the system returns HTTP 403

### Requirement: List project repos
The system SHALL expose `GET /projects/:projectId/repos` returning all repos in a project for any org member.

#### Scenario: List repos
- **WHEN** an org member sends `GET /projects/:projectId/repos`
- **THEN** the system returns HTTP 200 with array of `{ id, name, slug, gitRemote }`
