import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Generate ordinary Collection v2.1 JSON; importing the JSON requires no Node.js.
const directory = new URL('./', import.meta.url);
const write = (name, value) => writeFileSync(new URL(name, directory), JSON.stringify(value, null, 2) + '\n');
const event = (listen, source) => ({ listen, script: { type: 'text/javascript', exec: source.trim().split('\n') } });
const csrfScript = `
// Spring Security rotates CSRF tokens on authentication. Fetch the current
// token immediately before every write, retaining Postman's session cookies.
const baseUrl = pm.variables.get('baseUrl');
if (!baseUrl || !/^https?:\\/\\//.test(baseUrl)) {
  throw new Error('Select the AccessHub Local environment and set baseUrl.');
}
if (!['GET', 'HEAD', 'OPTIONS'].includes(pm.request.method)) {
  pm.request.headers.remove('X-XSRF-TOKEN');
  if (!pm.info.requestName.startsWith('[NO CSRF]')) {
    pm.sendRequest(baseUrl.replace(/\\/$/, '') + '/api/auth/csrf', function (error, response) {
      if (error || response.code !== 200) {
        throw new Error('Unable to fetch CSRF token. Check baseUrl and start the API.');
      }
      const csrf = response.json();
      if (!csrf.token || !csrf.headerName) throw new Error('Invalid CSRF response.');
      pm.request.headers.upsert({ key: csrf.headerName, value: csrf.token });
    });
  }
}
`;
const status = code => `pm.test('HTTP ${code}', () => pm.response.to.have.status(${code}));`;
const message = code => `${status(code)}
pm.test('Error includes a useful message', () => {
  pm.expect(pm.response.json().message).to.be.a('string').and.not.empty;
});`;
const saveDetail = key => `
if (pm.response.code === 201) {
  pm.collectionVariables.set('${key}', pm.response.json().request.id);
}
`;
function detailChecks(expectedStatus, expectedStage, actions, ownerKey) {
  return `${status(200)}
pm.test('Workflow status and stage are correct', () => {
  const body = pm.response.json();
  pm.expect(body.request.status).to.equal('${expectedStatus}');
  pm.expect(body.request.stage).to.equal('${expectedStage}');
  ${ownerKey ? `pm.expect(body.request.currentOwnerId).to.equal(pm.collectionVariables.get('${ownerKey}'));` : ''}
  ${expectedStage === 'COMPLETED' ? 'pm.expect(body.request.currentOwnerId).to.equal(null);' : ''}
});
${actions ? `pm.test('Audit history records exactly the expected actions', () => {
  pm.expect(pm.response.json().history.map(entry => entry.action)).to.eql(${JSON.stringify(actions)});
});` : ''}`;
}
function request(name, method, path, { body, form, tests = status(200), description = '', pre = '' } = {}) {
  const result = {
    name,
    request: {
      method,
      header: [{ key: 'Accept', value: 'application/json' }],
      url: '{{baseUrl}}' + path,
      description,
    },
    event: [event('test', tests)],
  };
  if (body !== undefined) {
    result.request.header.push({ key: 'Content-Type', value: 'application/json' });
    result.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  }
  if (form) {
    result.request.body = { mode: 'urlencoded', urlencoded: Object.entries(form).map(([key, value]) => ({ key, value, type: 'text' })) };
  }
  if (pre) result.event.unshift(event('prerequest', pre));
  return result;
}
const folder = (name, description, item) => ({ name, description, item });
const vars = [
  { key: 'requestId', value: '', type: 'string' },
  { key: 'rejectedRequestId', value: '', type: 'string' },
  { key: 'securityRequestId', value: '', type: 'string' },
  { key: 'applicationId', value: '00000000-0000-0000-0000-000000000101', type: 'string' },
];
function collection(id, name, description, items) {
  return {
    info: { _postman_id: id, name, description, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    auth: { type: 'noauth' },
    variable: vars.map(variable => ({ ...variable })),
    event: [event('prerequest', csrfScript)],
    item: items,
  };
}
function login(role, { wrongPassword = false } = {}) {
  return request(`Sign in as ${role}${wrongPassword ? ' with invalid password' : ''}`, 'POST', '/api/auth/login', {
    form: { username: `{{${role}Email}}`, password: wrongPassword ? 'deliberately-invalid-password' : `{{${role}Password}}` },
    tests: wrongPassword ? message(401) : `${status(200)}
pm.test('Authentication succeeded', () => pm.expect(pm.response.json().authenticated).to.equal(true));`,
    description: 'URL-encoded Spring Security login. The collection fetches CSRF automatically. Session cookies stay in the Postman cookie jar.',
  });
}
const roleNames = { employee: 'EMPLOYEE', manager: 'MANAGER', owner: 'APPLICATION_OWNER', security: 'SECURITY' };
function me(role) {
  return request(`Verify ${role} account`, 'GET', '/api/auth/me', {
    tests: `${status(200)}
pm.test('Correct account and role', () => {
  const user = pm.response.json();
  pm.expect(user.email).to.equal(pm.variables.get('${role}Email'));
  pm.expect(user.role).to.equal('${roleNames[role]}');
  pm.collectionVariables.set('${role}Id', user.id);
});`,
  });
}
const createBody = {
  applicationId: '{{applicationId}}', accessLevel: 'STANDARD',
  justification: 'Postman workflow check: access needed to manage enterprise customer accounts.',
};
function create(key = 'requestId') {
  return request(`Create request (${key})`, 'POST', '/api/requests', {
    body: createBody,
    tests: `${status(201)}${saveDetail(key)}
pm.test('Request starts with the line manager', () => {
  const body = pm.response.json();
  pm.expect(body.request.id).to.match(/^[0-9a-f-]{36}$/);
  pm.expect(body.request.reference).to.match(/^AR-\\d+$/);
  pm.expect(body.request.status).to.equal('PENDING');
  pm.expect(body.request.stage).to.equal('LINE_MANAGER');
  pm.expect(body.request.currentOwnerId).to.be.a('string').and.not.empty;
  pm.expect(body.history.map(h => h.action)).to.eql(['SUBMITTED']);
});`,
  });
}
function action(name, actionValue, comment, tests, key = 'requestId') {
  return request(name, 'POST', `/api/requests/{{${key}}}/actions`, {
    body: { action: actionValue, comment }, tests,
    description: 'Only the current owner can act. REJECT, RETURN, and RESUBMIT require a nonblank comment.',
  });
}
function pending(key = 'requestId') {
  return request('Pending approvals include this request', 'GET', '/api/requests?scope=pending', {
    tests: `${status(200)}
pm.test('Request is assigned to the signed-in approver', () => {
  const items = pm.response.json();
  pm.expect(items).to.be.an('array');
  pm.expect(items.some(item => item.id === pm.collectionVariables.get('${key}'))).to.equal(true);
});`,
  });
}

write('AccessHub.API.postman_collection.json', collection(
  '293a91d6-8aad-4ab8-b73d-719771c76aec',
  'AccessHub - API Reference',
  'Manual API requests for the Access Request Workflow Portal. Select AccessHub Local. Sign in, list applications, create a request, and use the returned requestId. For automated execution use the separate Workflow Tests collection. This API uses session cookies and CSRF, not bearer tokens. Every write automatically obtains a fresh CSRF token.',
  [
    folder('01 Authentication', 'Set loginEmail/loginPassword to choose an account. Cookies are retained automatically. Run logout when finished.', [
      request('Get CSRF token', 'GET', '/api/auth/csrf', { tests: `${status(200)}
pm.test('CSRF token and header name are present', () => {
  pm.expect(pm.response.json().token).to.be.a('string').and.not.empty;
  pm.expect(pm.response.json().headerName).to.equal('X-XSRF-TOKEN');
});` }),
      request('Login', 'POST', '/api/auth/login', { form: { username: '{{loginEmail}}', password: '{{loginPassword}}' }, tests: `${status(200)}
pm.test('Authentication succeeded', () => pm.expect(pm.response.json().authenticated).to.equal(true));` }),
      request('Current account', 'GET', '/api/auth/me'),
      request('Logout', 'POST', '/api/auth/logout', { tests: status(204) }),
    ]),
    folder('02 Applications', 'Available internal applications and their IDs.', [
      request('List applications', 'GET', '/api/applications', { tests: `${status(200)}
pm.test('Application catalog returned', () => pm.expect(pm.response.json()).to.be.an('array'));
const apps = pm.response.json();
if (apps.length) pm.collectionVariables.set('applicationId', (apps.find(app => app.name === 'Salesforce') || apps[0]).id);` }),
    ]),
    folder('03 Access requests', 'Create as employee. Creating a request saves requestId for details and actions.', [
      request('My submitted requests', 'GET', '/api/requests?scope=mine'),
      request('My pending approvals', 'GET', '/api/requests?scope=pending'),
      create(),
      request('Request details and audit history', 'GET', '/api/requests/{{requestId}}'),
    ]),
    folder('04 Workflow actions', 'These are alternative actions, not a sequential test. Sign in as the current owner and select the action matching the request state.', [
      action('Approve current stage', 'APPROVE', 'Business need confirmed.', status(200)),
      action('Return for information', 'RETURN', 'Which customer accounts will you manage?', status(200)),
      action('Respond and resubmit as requester', 'RESUBMIT', 'I manage the Cairo enterprise accounts.', status(200)),
      action('Reject request', 'REJECT', 'The requested access is outside current job responsibilities.', status(200)),
    ]),
  ],
));

const approvedActions = ['SUBMITTED', 'APPROVE', 'RETURN', 'RESUBMIT', 'APPROVE', 'APPROVE'];
const workflow = [
  request('Reset run state and get CSRF token', 'GET', '/api/auth/csrf', {
    pre: `['requestId', 'rejectedRequestId', 'securityRequestId', 'employeeId', 'managerId', 'ownerId', 'securityId'].forEach(key => pm.collectionVariables.unset(key));`,
    tests: status(200),
  }),
  login('employee'), me('employee'),
  request('Select Salesforce from application catalog', 'GET', '/api/applications', {
    tests: `${status(200)}
pm.test('Seeded application is available', () => {
  const app = pm.response.json().find(item => item.name === 'Salesforce');
  pm.expect(app, 'Enable the dev profile to seed Salesforce and demo accounts').to.exist;
  pm.collectionVariables.set('applicationId', app.id);
});`,
  }),
  create(),
  action('Requester cannot approve their own request', 'APPROVE', '', message(403)),
  login('manager'), me('manager'), pending(),
  action('Manager approves', 'APPROVE', 'Business need confirmed.', detailChecks('PENDING', 'APPLICATION_OWNER', ['SUBMITTED', 'APPROVE'])),
  login('owner'), me('owner'), pending(),
  action('Application owner asks for information', 'RETURN', 'Which customer accounts will you manage?', detailChecks('NEEDS_INFORMATION', 'APPLICATION_OWNER', ['SUBMITTED', 'APPROVE', 'RETURN'], 'employeeId')),
  login('employee'),
  request('Requester sees returned request in My requests', 'GET', '/api/requests?scope=mine', {
    tests: `${status(200)}
pm.test('Returned request is visible to its requester', () => {
  const item = pm.response.json().find(item => item.id === pm.collectionVariables.get('requestId'));
  pm.expect(item).to.exist;
  pm.expect(item.status).to.equal('NEEDS_INFORMATION');
});`,
  }),
  action('Requester cannot skip the information response', 'APPROVE', '', message(409)),
  action('Requester responds and resumes the same stage', 'RESUBMIT', 'I manage the Cairo enterprise accounts for the commercial sales team.', detailChecks('PENDING', 'APPLICATION_OWNER', ['SUBMITTED', 'APPROVE', 'RETURN', 'RESUBMIT'], 'ownerId')),
  login('owner'), pending(),
  action('Application owner approves', 'APPROVE', 'Standard access is appropriate.', detailChecks('PENDING', 'SECURITY', ['SUBMITTED', 'APPROVE', 'RETURN', 'RESUBMIT', 'APPROVE'])),
  login('security'), me('security'), pending(),
  action('Security approves the final stage', 'APPROVE', 'Security checks passed.', detailChecks('APPROVED', 'COMPLETED', approvedActions)),
  login('employee'),
  request('Requester verifies final status and full audit trail', 'GET', '/api/requests/{{requestId}}', {
    tests: detailChecks('APPROVED', 'COMPLETED', approvedActions) + `
pm.test('All information exchange comments are retained', () => {
  const history = pm.response.json().history;
  pm.expect(history[2].comment).to.equal('Which customer accounts will you manage?');
  pm.expect(history[3].comment).to.include('Cairo enterprise accounts');
});`,
  }),
];
const rejection = [
  login('employee'), create('rejectedRequestId'), login('manager'),
  action('Rejection requires a comment', 'REJECT', ' ', message(400), 'rejectedRequestId'),
  request('Invalid rejection leaves state and history unchanged', 'GET', '/api/requests/{{rejectedRequestId}}', {
    tests: detailChecks('PENDING', 'LINE_MANAGER', ['SUBMITTED'], 'managerId'),
  }),
  action('Manager rejects with a reason', 'REJECT', 'Access is outside current job responsibilities.', detailChecks('REJECTED', 'COMPLETED', ['SUBMITTED', 'REJECT']), 'rejectedRequestId'),
  action('Completed request cannot be acted on again', 'APPROVE', '', message(403), 'rejectedRequestId'),
  login('employee'),
  request('Requester can read the rejected request', 'GET', '/api/requests/{{rejectedRequestId}}', { tests: detailChecks('REJECTED', 'COMPLETED', ['SUBMITTED', 'REJECT']) }),
];
const validation = [
  request('Logout before unauthenticated checks', 'POST', '/api/auth/logout', { tests: status(204) }),
  request('Protected endpoint rejects an unauthenticated client', 'GET', '/api/auth/me', { tests: message(401) }),
  login('employee', { wrongPassword: true }), login('employee'),
  request('[NO CSRF] Missing header is rejected', 'POST', '/api/requests', { body: createBody, tests: message(403) }),
  request('Missing required fields are rejected', 'POST', '/api/requests', { body: {}, tests: message(400) }),
  request('Unknown access level is rejected', 'POST', '/api/requests', { body: { ...createBody, accessLevel: 'SUPERUSER' }, tests: message(400) }),
  request('Whitespace cannot satisfy business justification', 'POST', '/api/requests', { body: { ...createBody, justification: '   x                         ' }, tests: message(400) }),
  request('Unknown application cannot create a workflow', 'POST', '/api/requests', { body: { ...createBody, applicationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }, tests: message(422) }),
  request('Unknown list scope is rejected', 'GET', '/api/requests?scope=all', { tests: message(400) }),
  request('Malformed request ID is rejected', 'GET', '/api/requests/not-a-uuid', { tests: message(400) }),
  request('Unknown request ID returns not found', 'GET', '/api/requests/ffffffff-ffff-4fff-8fff-ffffffffffff', { tests: message(404) }),
  create('securityRequestId'), login('security'),
  request('Future reviewer cannot see an unrelated active request', 'GET', '/api/requests/{{securityRequestId}}', { tests: message(404) }),
  action('Future reviewer cannot skip approval stages', 'APPROVE', '', message(403), 'securityRequestId'),
  login('manager'),
  action('Finish the authorization fixture by rejecting it', 'REJECT', 'Postman authorization check complete; no access should be granted.', detailChecks('REJECTED', 'COMPLETED', ['SUBMITTED', 'REJECT']), 'securityRequestId'),
  request('Logout invalidates the session', 'POST', '/api/auth/logout', { tests: status(204) }),
  request('Session is no longer authenticated', 'GET', '/api/auth/me', { tests: message(401) }),
];
write('AccessHub.WorkflowTests.postman_collection.json', collection(
  'c4da2aa4-187c-49c8-a46c-335dc668dc9a',
  'AccessHub - Workflow Tests',
  'Run all folders in order with the AccessHub Local environment. Covers approval, return/resubmission, rejection, validation, CSRF, login/logout, and access control. Automatically switches demo accounts using explicit login requests and refreshes CSRF before each write. Creates three real requests and ends them approved/rejected. Re-running creates new records; existing requests are never deleted. Requires the dev profile and seeded demo accounts. Keep Postman cookie handling enabled.',
  [
    folder('01 Approval and information round-trip', 'Employee -> manager -> owner -> employee response -> owner -> security -> approved.', workflow),
    folder('02 Rejection and terminal-state protection', 'Independent request rejected by its manager. Comment validation must leave the original state intact.', rejection),
    folder('03 Authentication, validation, and authorization', 'Expected 4xx responses are successful tests. A new fixture verifies that reviewers cannot act ahead of their stage.', validation),
  ],
));

const env = (key, value, type = 'default') => ({ key, value, type, enabled: true });
write('AccessHub.Local.postman_environment.json', {
  id: '3c30a37f-81bb-4bc7-adce-dab9063d1513',
  name: 'AccessHub Local',
  values: [
    env('baseUrl', 'http://localhost:8080'),
    env('loginEmail', 'employee@example.com'), env('loginPassword', 'AccessDemo123!', 'secret'),
    ...Object.keys(roleNames).flatMap(role => [env(`${role}Email`, `${role}@example.com`), env(`${role}Password`, 'AccessDemo123!', 'secret')]),
  ],
  _postman_variable_scope: 'environment',
});
console.log(`Generated collections and environment in ${fileURLToPath(directory)}`);
