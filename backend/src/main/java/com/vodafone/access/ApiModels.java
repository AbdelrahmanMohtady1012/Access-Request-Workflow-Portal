package com.vodafone.access;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class ApiModels {
    private ApiModels() {}
    public enum Stage { LINE_MANAGER, APPLICATION_OWNER, SECURITY, COMPLETED }
    public enum Status { PENDING, NEEDS_INFORMATION, APPROVED, REJECTED }
    public enum Action { APPROVE, REJECT, RETURN, RESUBMIT }
    public enum AccessLevel { READ_ONLY, STANDARD, ADMIN }
    public record User(UUID id, String email, String name, String role) {}
    public record Application(UUID id, String name, String description, String category, String ownerName) {}
    public record CreateRequest(@NotNull UUID applicationId, @NotNull AccessLevel accessLevel,
            @NotBlank @Size(min = 20, max = 4000) String justification) {}
    public record Decision(@NotNull Action action, @Size(max = 4000) String comment) {}
    public record RequestView(UUID id, String reference, UUID requesterId, String requesterName,
            UUID applicationId, String applicationName, AccessLevel accessLevel, String justification,
            Status status, Stage stage, UUID currentOwnerId, String currentOwnerName,
            OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    public record History(UUID id, UUID actorId, String actorName, String action, String fromStage,
            String toStage, String comment, OffsetDateTime createdAt) {}
    public record RequestDetail(RequestView request, List<History> history) {}
}
