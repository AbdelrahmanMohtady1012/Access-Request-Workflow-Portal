package com.vodafone.access;

import static com.vodafone.access.ApiModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"dev", "test"})
class WorkflowIntegrationTest {
    @Autowired WorkflowService workflow;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    private User employee, manager, owner, security;
    private final UUID appId = UUID.fromString("00000000-0000-0000-0000-000000000101");

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM workflow_history");
        jdbc.update("DELETE FROM access_requests");
        employee = workflow.user("employee@example.com"); manager = workflow.user("manager@example.com");
        owner = workflow.user("owner@example.com"); security = workflow.user("security@example.com");
    }

    private RequestDetail create() { return workflow.create(new CreateRequest(appId, AccessLevel.STANDARD, "Access needed to manage our enterprise customer accounts."), employee); }
    private RequestDetail act(UUID id, Action action, String comment, User actor) { return workflow.decide(id, new Decision(action, comment), actor); }

    @Test void allThreeStagesAreRequiredAndHistoryIsPreserved() {
        var request = create().request();
        assertThat(request.currentOwnerId()).isEqualTo(manager.id());
        assertThat(workflow.list(manager, true)).hasSize(1);
        var one = act(request.id(), Action.APPROVE, "Business need confirmed", manager).request();
        assertThat(one.stage()).isEqualTo(Stage.APPLICATION_OWNER);
        assertThat(one.currentOwnerId()).isEqualTo(owner.id());
        var two = act(request.id(), Action.APPROVE, "Standard access is appropriate", owner).request();
        assertThat(two.stage()).isEqualTo(Stage.SECURITY);
        var done = act(request.id(), Action.APPROVE, "Security checks passed", security);
        assertThat(done.request().status()).isEqualTo(Status.APPROVED);
        assertThat(done.request().stage()).isEqualTo(Stage.COMPLETED);
        assertThat(done.request().currentOwnerId()).isNull();
        assertThat(done.history()).extracting(History::action).containsExactly("SUBMITTED", "APPROVE", "APPROVE", "APPROVE");
        assertThat(workflow.list(security, true)).isEmpty();
        assertThat(workflow.detail(request.id(), manager).history()).hasSize(4);
        assertThatThrownBy(() -> act(request.id(), Action.REJECT, "Too late", security)).isInstanceOf(ResponseStatusException.class);
    }

    @Test void informationResponseReturnsToTheSameStage() {
        UUID id = create().request().id();
        act(id, Action.APPROVE, "", manager);
        var returned = act(id, Action.RETURN, "Which customer accounts will you manage?", owner);
        assertThat(returned.request().status()).isEqualTo(Status.NEEDS_INFORMATION);
        assertThat(returned.request().stage()).isEqualTo(Stage.APPLICATION_OWNER);
        assertThat(returned.request().currentOwnerId()).isEqualTo(employee.id());
        assertThat(workflow.list(owner, true)).isEmpty();
        assertThat(workflow.list(employee, true)).isEmpty();
        assertThatThrownBy(() -> act(id, Action.APPROVE, "", employee)).isInstanceOf(ResponseStatusException.class);
        var resumed = act(id, Action.RESUBMIT, "I manage the Cairo enterprise accounts.", employee);
        assertThat(resumed.request().currentOwnerId()).isEqualTo(owner.id());
        assertThat(resumed.request().stage()).isEqualTo(Stage.APPLICATION_OWNER);
        assertThat(resumed.request().status()).isEqualTo(Status.PENDING);
        assertThat(resumed.history()).extracting(History::action).containsExactly("SUBMITTED", "APPROVE", "RETURN", "RESUBMIT");
    }

    @Test void rejectionIsTerminalAndCommentIsRequired() {
        UUID id = create().request().id();
        assertThatThrownBy(() -> act(id, Action.REJECT, "  ", manager)).isInstanceOf(ResponseStatusException.class);
        assertThat(workflow.detail(id, employee).history()).hasSize(1);
        var rejected = act(id, Action.REJECT, "Access is outside the current job responsibilities.", manager);
        assertThat(rejected.request().status()).isEqualTo(Status.REJECTED);
        assertThat(rejected.request().stage()).isEqualTo(Stage.COMPLETED);
        assertThat(rejected.request().currentOwnerId()).isNull();
        assertThatThrownBy(() -> act(id, Action.RESUBMIT, "Try again", employee)).isInstanceOf(ResponseStatusException.class);
    }

    @Test void ownershipAndVisibilityAreEnforced() {
        UUID id = create().request().id();
        assertThatThrownBy(() -> act(id, Action.APPROVE, "", employee)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> act(id, Action.APPROVE, "", owner)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> workflow.detail(id, security)).isInstanceOf(ResponseStatusException.class);
        assertThat(workflow.list(owner, false)).isEmpty();
        assertThat(workflow.detail(id, employee).history()).hasSize(1);
    }

    @Test void unconfiguredOrSelfApprovalRoutesAreRejectedWithoutCreatingRequests() {
        assertThatThrownBy(() -> workflow.create(new CreateRequest(appId, AccessLevel.ADMIN, "Administrative access required for work."), manager)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> workflow.create(new CreateRequest(UUID.randomUUID(), AccessLevel.STANDARD, "Unknown application access requested."), employee)).isInstanceOf(ResponseStatusException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM access_requests", Integer.class)).isZero();
    }

    @Test void concurrentApprovalsCannotAdvanceTheWorkflowTwice() throws Exception {
        UUID id = create().request().id();
        CountDownLatch start = new CountDownLatch(1);
        Callable<Boolean> approve = () -> { start.await(); try { act(id, Action.APPROVE, "", manager); return true; } catch (ResponseStatusException e) { return false; } };
        try (var pool = Executors.newFixedThreadPool(2)) {
            Future<Boolean> first = pool.submit(approve), second = pool.submit(approve);
            start.countDown();
            assertThat(List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
        }
        assertThat(workflow.detail(id, employee).request().stage()).isEqualTo(Stage.APPLICATION_OWNER);
        assertThat(workflow.detail(id, employee).history()).hasSize(2);
    }

    @Test void httpSecurityValidationAndErrorResponses() throws Exception {
        mvc.perform(get("/api/requests")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(post("/api/requests").with(user(employee.email()).roles("EMPLOYEE")).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/requests").with(user(employee.email()).roles("EMPLOYEE")).with(csrf()).contentType("application/json").content("{}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isNotEmpty());
        mvc.perform(post("/api/requests").with(user(employee.email()).roles("EMPLOYEE")).with(csrf()).contentType("application/json")
            .content(json.writeValueAsString(new CreateRequest(appId, AccessLevel.STANDARD, "Access needed for customer account management."))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.request.status").value("PENDING"));
        UUID id = workflow.list(employee, false).getFirst().id();
        mvc.perform(get("/api/requests/" + id).with(user(security.email()).roles("SECURITY"))).andExpect(status().isNotFound());
        mvc.perform(post("/api/requests/" + id + "/actions").with(user(owner.email()).roles("APPLICATION_OWNER")).with(csrf()).contentType("application/json")
            .content("{\"action\":\"APPROVE\"}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/requests/not-a-uuid").with(user(employee.email()))).andExpect(status().isBadRequest());
    }

    @Test void realPasswordLoginCreatesSessionAndLogoutInvalidatesIt() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", employee.email()).param("password", "wrong"))
            .andExpect(status().isUnauthorized());
        var result = mvc.perform(post("/api/auth/login").with(csrf()).param("username", employee.email()).param("password", System.getenv().getOrDefault("DEMO_PASSWORD", "AccessDemo123!")))
            .andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(employee.email()));
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
    }
}
