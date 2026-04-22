## ADDED Requirements

### Requirement: Terraform state is stored in Azure Blob Storage
Terraform SHALL use Azure Blob Storage as the remote backend for state storage. Local `terraform.tfstate` files SHALL NOT be used for production or CI environments. State locking SHALL be enabled via blob lease.

#### Scenario: terraform init configures remote backend
- **WHEN** `terraform init` is run with backend config pointing to the state storage account
- **THEN** Terraform connects to Azure Blob Storage, downloads existing state, and uses blob lease for locking

#### Scenario: Concurrent terraform runs are blocked by state lock
- **WHEN** two CI jobs run `terraform apply` simultaneously
- **THEN** the second job waits for the lock to be released or fails with a clear lock error

### Requirement: Terraform state storage account is separate from application storage
The Terraform state SHALL be stored in a dedicated storage account (`fabricktfstate`) separate from the application blob storage used for context uploads. This separates lifecycle management of infrastructure metadata from application data.

#### Scenario: State account exists independently of app resources
- **WHEN** application storage account is deleted or modified via Terraform
- **THEN** the Terraform state storage account is unaffected

### Requirement: Local terraform.tfstate files are excluded from git
The repository SHALL have `.gitignore` entries preventing `terraform.tfstate` and `terraform.tfstate.backup` from being committed. This is a security requirement — state files may contain secrets.

#### Scenario: State files not tracked
- **WHEN** `git status` is run after a local `terraform apply`
- **THEN** `terraform.tfstate` and `terraform.tfstate.backup` do not appear as untracked or modified files
