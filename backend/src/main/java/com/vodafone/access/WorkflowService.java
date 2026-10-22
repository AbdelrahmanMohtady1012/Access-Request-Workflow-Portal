package com.vodafone.access;

import static com.vodafone.access.ApiModels.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowService {
    private final JdbcTemplate jdbc;
    private static final String SELECT = """
        SELECT r.*, u.name requester_name, a.name application_name, o.name owner_name
        FROM access_requests r JOIN portal_users u ON u.id = r.requester_id
        JOIN applications a ON a.id = r.application_id
        LEFT JOIN portal_users o ON o.id = r.current_owner_id
        """;
    public WorkflowService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public User user(String email) {
        return jdbc.query("SELECT id, email, name, role FROM portal_users WHERE email = ? AND enabled = TRUE",
            (rs, n) -> new User(rs.getObject("id", UUID.class), rs.getString("email"), rs.getString("name"), rs.getString("role")), email)
            .stream().findFirst().orElseThrow(() -> error(HttpStatus.UNAUTHORIZED, "Account unavailable."));
    }

    public List<Application> applications() {
        return jdbc.query("SELECT a.*, u.name owner_name FROM applications a JOIN portal_users u ON u.id = a.owner_id WHERE a.enabled = TRUE ORDER BY a.name",
            (rs, n) -> new Application(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"), rs.getString("category"), rs.getString("owner_name")));
    }

    public List<RequestView> list(User actor, boolean pending) {
        return jdbc.query(SELECT + (pending ? " WHERE r.current_owner_id = ? AND r.status = 'PENDING'" : " WHERE r.requester_id = ?")
            + " ORDER BY r.created_at DESC, r.reference_number DESC", this::map, actor.id());
    }

    @Transactional(readOnly = true)
    public RequestDetail detail(UUID id, User actor) {
        RequestView request = find(id);
        boolean participated = Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT COUNT(*) > 0 FROM workflow_history WHERE request_id = ? AND actor_id = ?", Boolean.class, id, actor.id()));
        if (!actor.id().equals(request.requesterId()) && !actor.id().equals(request.currentOwnerId()) && !participated)
            throw error(HttpStatus.NOT_FOUND, "Request not found.");
        List<History> history = jdbc.query("""
            SELECT h.*, u.name actor_name FROM workflow_history h JOIN portal_users u ON u.id = h.actor_id
            WHERE h.request_id = ? ORDER BY h.created_at, h.id
            """, (rs, n) -> new History(rs.getObject("id", UUID.class), rs.getObject("actor_id", UUID.class),
                rs.getString("actor_name"), rs.getString("action"), rs.getString("from_stage"),
                rs.getString("to_stage"), rs.getString("comment"), rs.getObject("created_at", OffsetDateTime.class)), id);
        return new RequestDetail(request, history);
    }

    @Transactional
    public RequestDetail create(CreateRequest input, User actor) {
        if (input.justification().trim().length() < 20)
            throw error(HttpStatus.BAD_REQUEST, "Please provide at least 20 characters of business justification.");
        UUID id = UUID.randomUUID();
        // Validate the full route before accepting a request; every approver must be active and distinct from the requester.
        for (Stage stage : List.of(Stage.LINE_MANAGER, Stage.APPLICATION_OWNER, Stage.SECURITY))
            approver(input.applicationId(), actor.id(), stage);
        UUID owner = approver(input.applicationId(), actor.id(), Stage.LINE_MANAGER);
        jdbc.update("""
            INSERT INTO access_requests (id, requester_id, application_id, access_level, justification, status, stage, current_owner_id)
            VALUES (?, ?, ?, ?, ?, 'PENDING', 'LINE_MANAGER', ?)
            """, id, actor.id(), input.applicationId(), input.accessLevel().name(), input.justification().trim(), owner);
        history(id, actor.id(), "SUBMITTED", null, Stage.LINE_MANAGER, "Request submitted for approval.");
        return detail(id, actor);
    }

    @Transactional
    public RequestDetail decide(UUID id, Decision input, User actor) {
        // Serialize all transitions so a request can never advance twice from the same stage.
        var locked = jdbc.query("SELECT id FROM access_requests WHERE id = ? FOR UPDATE", (rs, n) -> rs.getObject(1, UUID.class), id);
        if (locked.isEmpty()) throw error(HttpStatus.NOT_FOUND, "Request not found.");
        RequestView request = find(id);
        if (!actor.id().equals(request.currentOwnerId())) throw error(HttpStatus.FORBIDDEN, "Only the current owner can act on this request.");
        String comment = input.comment() == null ? "" : input.comment().trim();
        if (input.action() != Action.APPROVE && comment.isBlank())
            throw error(HttpStatus.BAD_REQUEST, "A comment is required for this action.");
        Stage next = request.stage();
        Status status;
        UUID owner;
        if (input.action() == Action.RESUBMIT) {
            if (request.status() != Status.NEEDS_INFORMATION || !actor.id().equals(request.requesterId()))
                throw error(HttpStatus.CONFLICT, "Only the requester can respond when information is requested.");
            status = Status.PENDING;
            owner = approver(request.applicationId(), request.requesterId(), next);
        } else {
            if (request.status() != Status.PENDING || actor.id().equals(request.requesterId()))
                throw error(HttpStatus.CONFLICT, "This request is not awaiting your approval.");
            String expectedRole = switch (request.stage()) {
                case LINE_MANAGER -> "MANAGER";
                case APPLICATION_OWNER -> "APPLICATION_OWNER";
                case SECURITY -> "SECURITY";
                default -> "";
            };
            if (!expectedRole.equals(actor.role())) throw error(HttpStatus.FORBIDDEN, "Your role cannot approve this stage.");
            switch (input.action()) {
                case APPROVE -> {
                    next = switch (request.stage()) {
                        case LINE_MANAGER -> Stage.APPLICATION_OWNER;
                        case APPLICATION_OWNER -> Stage.SECURITY;
                        case SECURITY -> Stage.COMPLETED;
                        default -> throw error(HttpStatus.CONFLICT, "Request is already complete.");
                    };
                    status = next == Stage.COMPLETED ? Status.APPROVED : Status.PENDING;
                    owner = next == Stage.COMPLETED ? null : approver(request.applicationId(), request.requesterId(), next);
                }
                case REJECT -> { next = Stage.COMPLETED; status = Status.REJECTED; owner = null; }
                case RETURN -> { status = Status.NEEDS_INFORMATION; owner = request.requesterId(); }
                default -> throw error(HttpStatus.CONFLICT, "Invalid action.");
            }
        }
        jdbc.update("UPDATE access_requests SET status = ?, stage = ?, current_owner_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            status.name(), next.name(), owner, id);
        history(id, actor.id(), input.action().name(), request.stage(), next, comment);
        return detail(id, actor);
    }

    private UUID approver(UUID appId, UUID requesterId, Stage stage) {
        String column = switch (stage) { case LINE_MANAGER -> "u.manager_id"; case APPLICATION_OWNER -> "a.owner_id"; case SECURITY -> "a.security_id"; default -> throw error(HttpStatus.CONFLICT, "Invalid stage."); };
        String role = switch (stage) { case LINE_MANAGER -> "MANAGER"; case APPLICATION_OWNER -> "APPLICATION_OWNER"; case SECURITY -> "SECURITY"; default -> ""; };
        var ids = jdbc.query("SELECT p.id FROM applications a CROSS JOIN portal_users u JOIN portal_users p ON p.id = " + column
            + " WHERE a.id = ? AND u.id = ? AND a.enabled = TRUE AND p.enabled = TRUE AND p.role = ? AND p.id <> u.id",
            (rs, n) -> rs.getObject(1, UUID.class), appId, requesterId, role);
        return ids.stream().findFirst().orElseThrow(() -> error(HttpStatus.UNPROCESSABLE_ENTITY,
            "No eligible approver configured for " + stage.name().toLowerCase(Locale.ROOT).replace('_', ' ') + ". Contact your administrator."));
    }

    private RequestView find(UUID id) {
        return jdbc.query(SELECT + " WHERE r.id = ?", this::map, id).stream().findFirst()
            .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Request not found."));
    }

    private RequestView map(ResultSet rs, int row) throws SQLException {
        return new RequestView(rs.getObject("id", UUID.class), "AR-%05d".formatted(rs.getLong("reference_number")),
            rs.getObject("requester_id", UUID.class), rs.getString("requester_name"), rs.getObject("application_id", UUID.class),
            rs.getString("application_name"), AccessLevel.valueOf(rs.getString("access_level")), rs.getString("justification"),
            Status.valueOf(rs.getString("status")), Stage.valueOf(rs.getString("stage")), rs.getObject("current_owner_id", UUID.class),
            rs.getString("owner_name"), rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));
    }

    private void history(UUID id, UUID actor, String action, Stage from, Stage to, String comment) {
        jdbc.update("INSERT INTO workflow_history (id, request_id, actor_id, action, from_stage, to_stage, comment) VALUES (?, ?, ?, ?, ?, ?, ?)",
            UUID.randomUUID(), id, actor, action, from == null ? null : from.name(), to.name(), comment);
    }
    private ResponseStatusException error(HttpStatus status, String message) { return new ResponseStatusException(status, message); }
}
