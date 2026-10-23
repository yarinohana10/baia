export type AdminMember = { id: string; email: string; name: string | null; isOwner: boolean; createdAt: string };
export type AdminInvitation = { id: string; email: string; invitedByEmail: string; createdAt: string };

/** GET /admin/users */
export type AdminUsersResponse = { admins: AdminMember[]; invitations: AdminInvitation[]; canManage: boolean };

/** POST /admin/users */
export type AddAdminResponse = { action: 'promoted' | 'already-admin' | 'invited'; email: string };
