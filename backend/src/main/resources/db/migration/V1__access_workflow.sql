CREATE TABLE portal_users (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('EMPLOYEE', 'MANAGER', 'APPLICATION_OWNER', 'SECURITY')),
    manager_id UUID REFERENCES portal_users(id),
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE applications (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(500) NOT NULL,
    category VARCHAR(80) NOT NULL,
    owner_id UUID NOT NULL REFERENCES portal_users(id),
    security_id UUID NOT NULL REFERENCES portal_users(id),
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE access_requests (
    id UUID PRIMARY KEY,
    reference_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    requester_id UUID NOT NULL REFERENCES portal_users(id),
    application_id UUID NOT NULL REFERENCES applications(id),
    access_level VARCHAR(30) NOT NULL CHECK (access_level IN ('READ_ONLY', 'STANDARD', 'ADMIN')),
    justification VARCHAR(4000) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED')),
    stage VARCHAR(30) NOT NULL CHECK (stage IN ('LINE_MANAGER', 'APPLICATION_OWNER', 'SECURITY', 'COMPLETED')),
    current_owner_id UUID REFERENCES portal_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((status IN ('APPROVED', 'REJECTED') AND stage = 'COMPLETED' AND current_owner_id IS NULL)
        OR (status IN ('PENDING', 'NEEDS_INFORMATION') AND stage <> 'COMPLETED' AND current_owner_id IS NOT NULL))
);

CREATE TABLE workflow_history (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES access_requests(id),
    actor_id UUID NOT NULL REFERENCES portal_users(id),
    action VARCHAR(30) NOT NULL CHECK (action IN ('SUBMITTED', 'APPROVE', 'REJECT', 'RETURN', 'RESUBMIT')),
    from_stage VARCHAR(30),
    to_stage VARCHAR(30) NOT NULL,
    comment VARCHAR(4000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_requests_requester ON access_requests(requester_id, created_at DESC);
CREATE INDEX idx_requests_owner_status ON access_requests(current_owner_id, status);
CREATE INDEX idx_history_request ON workflow_history(request_id, created_at);
