import { useContext } from 'react';
import { UserContext } from '../providers/index.js';

export type WorkspaceRole =
  | 'business_owner'
  | 'accountant'
  | 'employee'
  | 'viewer'
  | 'scraper'
  | string;

const ROLE_LABELS: Record<string, string> = {
  business_owner: 'Admin',
  accountant: 'Member',
  employee: 'Member',
  viewer: 'Observer',
  scraper: 'Scraper',
};

/** Returns the current user's workspace role id, or null if not authenticated. */
export function useRole(): WorkspaceRole | null {
  const { userContext } = useContext(UserContext);
  return userContext?.context.roleId ?? null;
}

/** True if the current user is a workspace admin (business_owner). */
export function useIsAdmin(): boolean {
  return useRole() === 'business_owner';
}

/** True if the current user is a read-only observer and cannot perform writes. */
export function useIsReadOnly(): boolean {
  return useRole() === 'viewer';
}

/** Human-readable label for a role id. */
export function roleLabel(roleId: string): string {
  return ROLE_LABELS[roleId] ?? roleId;
}
