# Access Request Workflow Portal

## Backend / Frontend Development Onboarding Project

A full-stack application for managing employee access to internal applications: request submission, role-based approvals through three stages, requests for additional information, and a complete workflow audit history.

## Tech stack

| Area | Choice |
| --- | --- |
| Backend language | Java 21 |
| Framework | Spring Boot 3.5.6 (Web, JDBC, Security, Validation) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 + Lucide icons |
| Database | PostgreSQL 17 |
| Authentication | Spring Security + BCrypt + server-side sessions + CSRF |
| Database migrations | Flyway |
| API docs | springdoc OpenAPI / Swagger UI |
| Build | Maven (wrapper included) + npm |
| API testing | Postman + Newman |
| Browser testing | Playwright |
| Local hosting | Docker Compose |
| Development environment | VS Code + Codex |

## Project layout

```text
backend/
  src/main/java/com/vodafone/access/
    AccessPortalApplication.java  # entry point
    ApiController.java            # REST endpoints
    ApiModels.java                # request/response models and validation
    WorkflowService.java          # workflow, ownership, transactions, history
    SecurityConfig.java           # password verification, sessions, CSRF
    ApiErrors.java                # API error responses
    OpenApiConfig.java            # API documentation
    DevData.java                  # demo bootstrap (dev profile only)
  src/main/resources/
    application.yml               # environment-based configuration
    db/migration/                 # Flyway schema migrations
  src/test/                       # integration tests
frontend/
  src/
    pages/                        # login, dashboard, requests, approvals, help
    components/                   # shared UI and request table
    hooks/                        # data loading
    lib/                          # shared formatting
    api.ts                        # typed API client and CSRF handling
    types.ts                      # frontend data models
  e2e/                            # Playwright workflow checks
  nginx.conf                      # container API proxy and SPA fallback
postman/                          # collections, environment, Newman runner
docs/                             # data model and verification notes
.vscode/                          # recommended extensions and tasks
compose.yaml                      # PostgreSQL, Java API, React/Nginx
```

See [the data model](docs/data-model.md) for the schema diagram and service responsibilities.

## Prerequisites

For the Docker setup, install Docker Desktop and start its Linux container engine.

For local development outside the application containers:

- JDK 21.
- Node.js 22.12+ or a compatible newer release, with npm.
- PostgreSQL, supplied by Docker Compose.
- VS Code; recommended extensions and development tasks are included.

The Maven wrapper downloads Maven automatically. The local database uses port **15432**, database **access_portal**, and user **access_portal**. PostgreSQL uses port 5432 inside its container.

## Configuration

The backend reads environment variables. These defaults are for local development:

| Variable | Purpose / default |
| --- | --- |
| `DB_URL` | JDBC URL; `jdbc:postgresql://localhost:15432/access_portal` |
| `DB_USERNAME` | Database user; `access_portal` |
| `DB_PASSWORD` | Database password; `local-development-only` |
| `PORT` | Backend HTTP port; `8080` |
| `SPRING_PROFILES_ACTIVE` | Select `dev` to seed demo accounts and applications |
| `DEMO_PASSWORD` | Password for newly created demo accounts; `AccessDemo123!` |
| `COOKIE_SECURE` | Use secure cookies with HTTPS; `false` locally |
| `DB_PORT` | Compose database host port; `15432` |

Copy `.env.example` to `.env` to override Compose's database port, database password, or demo password. `.env` is ignored by Git. For locally launched Java processes, set variables in the terminal instead:

```powershell
$env:DB_PASSWORD = "your-local-db-password"
$env:SPRING_PROFILES_ACTIVE = "dev"
```

Other settings live in `backend/src/main/resources/application.yml`. Flyway creates and versions the schema; Hibernate does not manage it.

Compose sets the backend JDBC URL to its internal database service. If you change `DB_PORT` when running Java outside Docker, also update `DB_URL`. Database environment variables initialize new PostgreSQL volumes; changing `DB_PASSWORD` later also requires updating the existing database role.

## Running

From the repository root:

```powershell
docker compose up --build -d
```

- Frontend: http://localhost:5173
- API: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui.html
- OpenAPI JSON: http://localhost:8080/v3/api-docs

View logs or stop the application:

```powershell
docker compose logs -f backend
docker compose stop
```

The named PostgreSQL volume preserves data across restarts. `docker compose down` removes containers while keeping the volume.

### Local development

Start only the database:

```powershell
docker compose up -d db
```

Run the backend in one terminal:

```sh
cd backend
sh ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

On Windows:

```powershell
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

Run the frontend in another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to Java. The containerized frontend uses Nginx for the same behavior. Stop the containerized backend/frontend before starting local processes on the same ports.

## Authentication & roles

Authentication uses server-side sessions. Login sets an HTTP-only `JSESSIONID` cookie; retain it for subsequent API requests. Sessions expire after 30 minutes of inactivity and are invalidated on logout. Backend restarts require signing in again.

All writes, including login and logout, require CSRF protection:

1. Call `GET /api/auth/csrf` and retain the response cookies.
2. Send its `token` using the returned `headerName` (`X-XSRF-TOKEN`) on writes.
3. Fetch a fresh token after login because authentication rotates it.

The frontend and included Postman collections handle these steps automatically.

**Demo / test credentials — for local development only.** These dummy accounts are seeded with the `dev` profile. All initially use password **`AccessDemo123!`**; they are not real credentials.

| Email | Role |
| --- | --- |
| `employee@example.com` | `EMPLOYEE` |
| `manager@example.com` | `MANAGER` |
| `owner@example.com` | `APPLICATION_OWNER` |
| `security@example.com` | `SECURITY` |

### First-time setup

No manual SQL is needed. Start the backend with the `dev` profile, as Compose does by default. It creates the accounts, the employee's manager relationship, and four applications: Salesforce, SAP SuccessFactors, Jira, and Power BI.

`DEMO_PASSWORD` applies only when an account is first created. Existing users and passwords are preserved. The approver accounts are configured for reviewing; they do not have their own requester approval routes.

### Role and ownership rules

- `GET /api/auth/csrf` is public. Login is public but requires CSRF.
- Other API endpoints require a signed-in account.
- Submitted-request lists contain the current user's requests.
- Approval queues contain only requests currently assigned to that user.
- Only the current owner can act, subject to their role and the request state.
- The requester, current owner, and previous participants can read request details.
- Requesters cannot approve their own requests or choose their approvers.

## Approval workflow

```text
Requester -> Line manager -> Application owner -> Security team -> Approved
```

Any approver can reject a request or return it for information. Returning a request transfers ownership to the requester while keeping the stage. The requester's response sends it back to that same approval stage.

| Status | Meaning |
| --- | --- |
| `PENDING` | Waiting for the current approver |
| `NEEDS_INFORMATION` | Waiting for the requester to respond |
| `APPROVED` | All three stages approved |
| `REJECTED` | An approver rejected the request |

Stages: `LINE_MANAGER`, `APPLICATION_OWNER`, `SECURITY`, `COMPLETED`. Approved and rejected requests are terminal and have no current owner. Comments are required for rejection, information requests, and requester responses; approval comments are optional.

State updates and audit entries commit in one transaction. Row locks prevent concurrent decisions from advancing a request twice. Approval records authorization; actual account provisioning in external applications is a separate internal step.

## API overview

Base URL: `http://localhost:8080`

### Authentication — `/api/auth`

| Method | Path | Body / params | Notes |
| --- | --- | --- | --- |
| GET | `/csrf` | — | Returns token and header name |
| POST | `/login` | URL-encoded `username`, `password` | Creates session; CSRF required |
| GET | `/me` | — | Current account and role |
| POST | `/logout` | — | Invalidates session; CSRF required |

### Applications — `/api/applications`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Enabled applications, IDs, and owner names |

### Access requests — `/api/requests`

| Method | Path | Body / params | Notes |
| --- | --- | --- | --- |
| GET | `/` | `?scope=mine` | Your submitted requests; default scope |
| GET | `/` | `?scope=pending` | Approvals assigned to you |
| POST | `/` | `{ applicationId, accessLevel, justification }` | Creates request and audit entry |
| GET | `/{id}` | — | Request details and full history |
| POST | `/{id}/actions` | `{ action, comment }` | Current-owner workflow action |

Create a request:

```json
{
  "applicationId": "00000000-0000-0000-0000-000000000101",
  "accessLevel": "STANDARD",
  "justification": "I need access to manage enterprise customer accounts."
}
```

Access levels: `READ_ONLY`, `STANDARD`, `ADMIN`. Justification must contain 20–4,000 characters. Comments allow up to 4,000 characters. Actions: `APPROVE`, `REJECT`, `RETURN`, `RESUBMIT`.

```json
{
  "action": "RETURN",
  "comment": "Which customer accounts will you manage?"
}
```

Errors include a `message` field. Common codes: 400 invalid input, 401 unauthenticated, 403 unauthorized action or invalid CSRF, 404 unknown/invisible request, 409 invalid transition, 422 missing approver configuration.

## Testing the API

Ready-to-import Postman collections, a local environment, and an automated Newman suite are provided in [postman/](postman/README.md). The API Reference collection covers individual endpoints. The Workflow Tests collection covers approval, information round-trips, rejection, authentication, validation, and authorization.

Run against the local development API:

```powershell
cd postman
npm ci
npm test
```

The automated collection creates three real development requests and ends them approved/rejected. See [postman/README.md](postman/README.md) for import instructions, variables, expected error responses, and report generation.

### Backend integration tests

```powershell
cd backend
.\mvnw.cmd verify
```

On macOS/Linux use `sh ./mvnw verify`. Tests use H2 in PostgreSQL mode by default and cover sessions, CSRF, transitions, history, request visibility, invalid routes, and concurrent approvals.

To test against PostgreSQL, use a **separate disposable test database**. The suite deletes request/history rows in its configured database before each test:

```powershell
# From the repository root; create the test database once.
docker compose exec db createdb -U access_portal access_test
$env:TEST_DB_URL = 'jdbc:postgresql://localhost:15432/access_test'
$env:TEST_DB_USERNAME = 'access_portal'
$env:TEST_DB_PASSWORD = 'local-development-only'
cd backend
.\mvnw.cmd verify
```

### Frontend build and browser checks

```powershell
cd frontend
npm ci
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser checks require the running application and create real request records. On Windows, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'` to use installed Microsoft Edge instead of downloading Chromium.

GitHub Actions runs integration tests against PostgreSQL 17 and builds the frontend. See [verification notes](docs/verification.md) for checks performed during implementation.
