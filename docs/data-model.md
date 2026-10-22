# Database and service design

```mermaid
erDiagram
    PORTAL_USERS ||--o{ PORTAL_USERS : manages
    PORTAL_USERS ||--o{ APPLICATIONS : owns
    PORTAL_USERS ||--o{ APPLICATIONS : reviews_security
    PORTAL_USERS ||--o{ ACCESS_REQUESTS : requests
    PORTAL_USERS o|--o{ ACCESS_REQUESTS : current_owner
    APPLICATIONS ||--o{ ACCESS_REQUESTS : requested_for
    ACCESS_REQUESTS ||--o{ WORKFLOW_HISTORY : records
    PORTAL_USERS ||--o{ WORKFLOW_HISTORY : acts
    PORTAL_USERS {
        uuid id PK
        string email UK
        string name
        string password_hash
        string role
        uuid manager_id FK
        boolean enabled
    }
    APPLICATIONS {
        uuid id PK
        string name UK
        string description
        string category
        uuid owner_id FK
        uuid security_id FK
        boolean enabled
    }
    ACCESS_REQUESTS {
        uuid id PK
        bigint reference_number UK
        uuid requester_id FK
        uuid application_id FK
        string access_level
        string justification
        string status
        string stage
        uuid current_owner_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    WORKFLOW_HISTORY {
        uuid id PK
        uuid request_id FK
        uuid actor_id FK
        string action
        string from_stage
        string to_stage
        string comment
        timestamptz created_at
    }
```

Flyway owns schema creation. Foreign keys prevent orphaned assignments, requests, and actions. Check constraints restrict role, access level, action, status, and stage values. A terminal-state constraint requires completed requests to have no current owner and active requests to retain an owner. Indexes support requester lists, approval queues, and request history.

`ApiController` validates HTTP inputs and resolves the signed-in account. `WorkflowService` owns route selection, participant visibility, transitions, and audit writes. `SecurityConfig` handles password verification, sessions, CSRF, and unauthenticated responses. The frontend never chooses an approver or sends a requester ID: both are resolved on the server.

For each transition, the service obtains a row lock, reloads the current state, validates ownership and the action, updates status/stage/owner, and inserts a history row. A single transaction commits both writes. This prevents duplicate concurrent approvals and partial workflow changes. Client-provided stages, owners, and statuses are never accepted.

Roles are stored per account for this onboarding project. Assignments come from the employee's manager relationship and the application's owner/security reviewer. Route configuration must identify active reviewers with the expected roles. User and application administration can later be added behind explicit administrative authorization; no such mutation endpoints are exposed today.
