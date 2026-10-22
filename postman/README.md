# AccessHub Postman collections

Two importable collections cover the Access Request Workflow Portal:

| File | Purpose |
| --- | --- |
| [AccessHub.API.postman_collection.json](AccessHub.API.postman_collection.json) | Individual requests for exploring every API endpoint |
| [AccessHub.WorkflowTests.postman_collection.json](AccessHub.WorkflowTests.postman_collection.json) | Ordered automated workflow, security, and validation checks |
| [AccessHub.Local.postman_environment.json](AccessHub.Local.postman_environment.json) | Local URL and demo accounts |

## Prerequisites

Start the application from the project root:

```powershell
docker compose up --build -d
```

The backend must run with the `dev` profile, as it does in Compose, to create the demo accounts and application assignments. The API's default address is `http://localhost:8080`. You can also use `http://localhost:5173` through the frontend proxy. Use one consistent hostname so session cookies work correctly.

The environment contains **dummy local development credentials**, all initially using `AccessDemo123!`:

| Variable | Default account |
| --- | --- |
| `employeeEmail` | `employee@example.com` |
| `managerEmail` | `manager@example.com` |
| `ownerEmail` | `owner@example.com` |
| `securityEmail` | `security@example.com` |

Each account has a matching password variable, such as `employeePassword`. Update the values if you changed `DEMO_PASSWORD` before the accounts were first created. Password fields are marked secret for display masking; the exported environment still contains their plaintext values. Keep real credentials in local values and do not commit exports containing them.

## Import into Postman

1. Open Postman and select **Import**.
2. Import the two collection JSON files and the environment JSON file from this directory.
3. Select **AccessHub Local** in the environment selector.
4. Check `baseUrl` and the account credentials. Keep automatic cookie handling enabled.

No bearer token is needed. The backend uses Spring Security sessions and a `JSESSIONID` cookie. A collection pre-request script fetches the current CSRF token before each write, including login and logout, and adds the `X-XSRF-TOKEN` header. This also handles token rotation after login. Postman's cookie jar retains the session and CSRF cookies; you do not need to paste them into request headers.

The requests and tests run locally when you press Send or use the Collection Runner. Importing these files does not call the API.

## Explore individual endpoints

Use **AccessHub - API Reference**:

1. In the environment, set `loginEmail` and `loginPassword` to the account you want to use.
2. Send **01 Authentication / Login**, then **Current account**.
3. As the employee, send **02 Applications / List applications**, then **03 Access requests / Create request**.
4. The responses save `applicationId` and `requestId` as collection variables. Send **Request details and audit history** to inspect the new request.
5. Change `loginEmail` to `manager@example.com` and send **Login** again. Send **My pending approvals**, then **Approve current stage**.
6. Repeat as the application owner and security reviewer to finish approval.
7. Send **Logout** when finished.

The workflow actions are alternatives. Choose **Return for information** to hand ownership to the requester. Log in as the employee and send **Respond and resubmit as requester**, then log in as the same approver to continue. **Reject request** ends the workflow immediately.

Do not run the API Reference collection as an ordered test: its authentication folder includes logout, and its workflow folder contains mutually exclusive actions. Use the separate Workflow Tests collection for automated runs.

Access levels: `READ_ONLY`, `STANDARD`, `ADMIN`. Justification must contain 20–4,000 characters. Comments are required for `RETURN`, `RESUBMIT`, and `REJECT`; they are optional for `APPROVE`.

## Run the automated collection in Postman

Select **AccessHub - Workflow Tests**, choose **Run collection**, include all three folders in their existing order, and run one iteration with the **AccessHub Local** environment.

| Folder | Checks |
| --- | --- |
| Approval and information round-trip | Submission, self-approval prevention, pending queues, manager approval, owner question, requester response, owner approval, final security approval, complete audit history |
| Rejection and terminal-state protection | Required rejection comment, unchanged state after invalid action, rejection, blocked later action |
| Authentication, validation, and authorization | Login/logout, wrong password, missing CSRF, malformed input, invalid access level, unknown IDs, request visibility, blocked out-of-order approval |

Expected error responses such as 400, 401, 403, 404, 409, and 422 are asserted as passing security/validation checks. Do not treat every 4xx response in this collection as a failure; inspect its tests.

Each run creates **three real access requests** in the configured database: one approved request and two rejected requests. It preserves existing data, resets its own generated IDs at the start, and logs out at the end. Use a local development database. Do not run multiple copies against the same collection variable scope simultaneously.

The complete collection runs the prerequisite folders first. Individual folders may depend on account IDs or application IDs captured earlier.

## Run from the command line with Newman

Node.js and npm are required. From this directory:

```powershell
npm ci
npm test
```

The test command uses the checked-in collections, environment, and pinned Newman dependency. It stops on the first failure and exits with a nonzero code if a check fails.

Equivalent command from the repository root, after installing dependencies:

```powershell
npx --prefix postman newman run postman/AccessHub.WorkflowTests.postman_collection.json -e postman/AccessHub.Local.postman_environment.json --bail
```

To override the server address, run from this directory:

```powershell
npx newman run AccessHub.WorkflowTests.postman_collection.json -e AccessHub.Local.postman_environment.json --env-var "baseUrl=http://localhost:5173" --bail
```

To write a machine-readable report locally:

```powershell
npx newman run AccessHub.WorkflowTests.postman_collection.json -e AccessHub.Local.postman_environment.json --reporters cli,json --reporter-json-export reports/workflow.json --bail
```

Reports can contain cookies, request bodies, and credentials. `reports/` is excluded from Git. Review exports before sharing them.

## Troubleshooting

- **Connection refused:** start the API and check `baseUrl`. Wait for Spring Boot startup to finish.
- **Login returns 401:** verify the `dev` profile and credentials. Changing `DEMO_PASSWORD` does not reset passwords for already-created users.
- **Unexpected 403:** keep cookie handling enabled and use one hostname. The pre-request script supplies CSRF automatically. The `[NO CSRF]` test intentionally omits that header.
- **Missing request or variable:** run the full Workflow Tests collection from the beginning, or create a request in API Reference first. Variables belong to their respective collections.
- **Existing browser session changes:** Postman has its own cookie jar. Within Postman, these collections share cookies for the same host, so run them sequentially.

## Maintaining the collections

The JSON files are ready to import. Their source is [generate-collections.mjs](generate-collections.mjs). After changing that file, regenerate the JSON with:

```powershell
npm run generate
```

Postman references: [sending requests from scripts](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-send-request/), [installing and running Newman](https://learning.postman.com/docs/collections/using-newman-cli/installing-running-newman).
