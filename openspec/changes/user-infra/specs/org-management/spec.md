## ADDED Requirements

### Requirement: Organization creation
The system SHALL expose `POST /orgs` (JWT-authenticated) accepting `{ name }`. It SHALL derive a slug from the name (lowercase, non-alphanumeric replaced with `-`), validate slug uniqueness, create the Organization, add the requesting user as admin in OrgMember, and create the MinIO bucket named after the slug.

#### Scenario: Successful org creation
- **WHEN** an authenticated user sends `POST /orgs` with `{ name: "Acme Corp" }`
- **THEN** the system creates org with slug `acme-corp`, adds user as admin, creates MinIO bucket `acme-corp`, returns HTTP 201 with `{ id, name, slug }`

#### Scenario: Duplicate slug
- **WHEN** an org with the derived slug already exists
- **THEN** the system returns HTTP 409

#### Scenario: Invalid slug
- **WHEN** the derived slug is shorter than 3 characters or contains invalid characters
- **THEN** the system returns HTTP 400

### Requirement: List user's organizations
The system SHALL expose `GET /orgs` (JWT-authenticated) returning all organizations the requesting user is a member of.

#### Scenario: User with orgs
- **WHEN** an authenticated user sends `GET /orgs`
- **THEN** the system returns HTTP 200 with array of `{ id, name, slug, role }`

#### Scenario: User with no orgs
- **WHEN** an authenticated user has no org memberships
- **THEN** the system returns HTTP 200 with empty array

### Requirement: Add member to organization
The system SHALL expose `POST /orgs/:orgId/members` restricted to org admins. It SHALL accept `{ email, password }`, create the User if not exists (or use existing user), add them to the org as member, and return the created member.

#### Scenario: Admin adds new user as member
- **WHEN** an org admin sends `POST /orgs/:orgId/members` with `{ email, password }`
- **THEN** the system creates the user (if not exists), creates OrgMember with role `member`, returns HTTP 201 with `{ userId, email, role }`

#### Scenario: Non-admin attempt
- **WHEN** a non-admin member sends `POST /orgs/:orgId/members`
- **THEN** the system returns HTTP 403

#### Scenario: Email already member
- **WHEN** the email belongs to a user already in the org
- **THEN** the system returns HTTP 409

### Requirement: List org members
The system SHALL expose `GET /orgs/:orgId/members` accessible to all org members, returning the list of members with their roles.

#### Scenario: Member lists org members
- **WHEN** an org member sends `GET /orgs/:orgId/members`
- **THEN** the system returns HTTP 200 with array of `{ userId, email, role }`

#### Scenario: Non-member attempt
- **WHEN** a user not in the org sends `GET /orgs/:orgId/members`
- **THEN** the system returns HTTP 403
