import type { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth';

export type SessionUser = { id: string; email: string; role?: string };

/** An Express request after AuthGuard has attached the signed-in user. */
export type AuthenticatedRequest = Request & { user?: SessionUser };

/**
 * Resolve the better-auth session user for endpoints that serve both guests
 * and logged-in users. Returns null for guests or on any auth error (never
 * throws), so callers must treat "no user" as "guest", never as "admin".
 */
export async function getOptionalUser(req: Request): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) return null;
    const user = session.user as { id: string; email: string; role?: string };
    return { id: user.id, email: user.email, role: user.role };
  } catch {
    return null;
  }
}
