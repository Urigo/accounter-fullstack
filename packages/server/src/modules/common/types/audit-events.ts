export type AuditAction =
  | 'INVITATION_CREATED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_EXPIRED_CLEANUP'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'USER_LOGIN'
  | 'USER_ROLE_CHANGED';

export interface AuditEvent {
  ownerId?: string;
  userId?: string;
  auth0UserId?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}
