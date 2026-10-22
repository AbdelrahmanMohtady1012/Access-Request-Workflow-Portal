export type Status = 'PENDING' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED';
export type Stage = 'LINE_MANAGER' | 'APPLICATION_OWNER' | 'SECURITY' | 'COMPLETED';
export type Action = 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT';
export type AccessLevel = 'READ_ONLY' | 'STANDARD' | 'ADMIN';
export interface User { id: string; email: string; name: string; role: string }
export interface Application { id: string; name: string; description: string; category: string; ownerName: string }
export interface AccessRequest {
  id: string; reference: string; requesterId: string; requesterName: string; applicationId: string;
  applicationName: string; accessLevel: AccessLevel; justification: string; status: Status; stage: Stage;
  currentOwnerId: string | null; currentOwnerName: string | null; createdAt: string; updatedAt: string;
}
export interface History { id: string; actorId: string; actorName: string; action: string; fromStage: Stage | null; toStage: Stage; comment: string; createdAt: string }
export interface Detail { request: AccessRequest; history: History[] }
