package com.vodafone.access;

import static com.vodafone.access.ApiModels.*;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final WorkflowService workflow;
    public ApiController(WorkflowService workflow) { this.workflow = workflow; }

    @GetMapping("/auth/csrf")
    @Operation(summary = "Get a CSRF token; send it as X-XSRF-TOKEN on mutations, including login and logout")
    public Map<String, String> csrf(CsrfToken token) { return Map.of("token", token.getToken(), "headerName", token.getHeaderName()); }

    @GetMapping("/auth/me")
    public User me(Principal principal) { return workflow.user(principal.getName()); }

    @GetMapping("/applications")
    public List<Application> applications() { return workflow.applications(); }

    @GetMapping("/requests")
    @Operation(summary = "List your submitted requests, or your pending approvals using scope=pending")
    public List<RequestView> requests(@RequestParam(defaultValue = "mine") String scope, Principal principal) {
        if (!Set.of("mine", "pending").contains(scope)) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope must be mine or pending.");
        return workflow.list(me(principal), scope.equals("pending"));
    }

    @PostMapping("/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public RequestDetail create(@Valid @RequestBody CreateRequest input, Principal principal) { return workflow.create(input, me(principal)); }

    @GetMapping("/requests/{id}")
    public RequestDetail detail(@PathVariable UUID id, Principal principal) { return workflow.detail(id, me(principal)); }

    @PostMapping("/requests/{id}/actions")
    @Operation(summary = "Approve, reject, return for information, or resubmit; restricted to the current owner")
    public RequestDetail decide(@PathVariable UUID id, @Valid @RequestBody Decision input, Principal principal) { return workflow.decide(id, input, me(principal)); }
}
