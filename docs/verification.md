# Verification

Validated on 22 October 2026 with Java 21 and PostgreSQL 17.

| Check | Result |
| --- | --- |
| TypeScript check and Vite production build | Passed |
| Maven wrapper startup | Passed, Maven 3.9.9 |
| Backend integration suite, H2 PostgreSQL mode | 8 passed |
| Backend integration suite, PostgreSQL 17 | 8 passed |
| Flyway migration against PostgreSQL | Passed |
| Desktop browser workflow | Passed |
| Mobile navigation, filtering, and page width | Passed at 390px |
| Frontend runtime dependency audit | No known vulnerabilities reported |
| Docker Compose image builds | Passed |
| Containerized frontend HTTP check | 200 |
| Containerized OpenAPI document | OpenAPI 3.1.0 returned |
| Postman workflow collection via Newman | 56 collection requests, 120 assertions passed; 91 HTTP calls including CSRF bootstrap |

The browser workflow covers real session login, employee submission, manager approval, application owner return for information, employee response, owner approval, final security approval, six audit entries, and logout. Tests use separate browser contexts for the four accounts and a real PostgreSQL-backed API. Browser tests create development request records; these are retained in the local development database.

The PostgreSQL integration suite uses `access_test`, separate from the portal's `access_portal` database. The app's three Docker Compose services are bound to loopback on ports 5173, 8080, and 15432. The existing PostgreSQL listener on port 5432 was left in place.
