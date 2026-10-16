import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyPassword } from 'better-auth/crypto';

const getSession = jest.fn();
jest.mock('../src/auth/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } } }));

import { AuthGuard } from '../src/auth/auth.guard';
import { AdminUsersController } from '../src/admin-users/admin-users.controller';
import { AdminUsersService } from '../src/admin-users/admin-users.service';
import { ensureAdmin } from '../src/admin-users/ensure-admin';
import { seedAdminFromEnv } from '../src/admin-users/seed-admin';
import { runCreateAdmin } from '../src/cli/create-admin';

/** Minimal in-memory stand-in for the Prisma `user`/`account` delegates used by admin code. */
function createUserStore(initial: Array<{ id: string; email: string; role: 'ADMIN' | 'CUSTOMER'; credential?: boolean }> = []) {
  const users = initial.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.email,
    emailVerified: true,
    role: u.role,
    createdAt: new Date('2026-01-01'),
  }));
  const accounts: any[] = initial
    .filter((u) => u.credential)
    .map((u) => ({ id: `acc-${u.id}`, userId: u.id, providerId: 'credential', password: 'existing-hash' }));

  const matches = (u: any, where: any = {}) => Object.entries(where).every(([k, v]) => u[k] === v);

  const user = {
    findUnique: jest.fn(async ({ where }: any) => users.find((u) => matches(u, where)) ?? null),
    findMany: jest.fn(async ({ where }: any) => users.filter((u) => matches(u, where))),
    count: jest.fn(async ({ where }: any) => users.filter((u) => matches(u, where)).length),
    create: jest.fn(async ({ data }: any) => {
      const { accounts: nested, ...rest } = data;
      const created = { createdAt: new Date(), ...rest };
      users.push(created);
      if (nested?.create) accounts.push({ ...nested.create, userId: created.id });
      return created;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const u = users.find((x) => matches(x, where));
      Object.assign(u!, data);
      return u;
    }),
    delete: jest.fn(),
  };
  const account = {
    findFirst: jest.fn(async ({ where }: any) => accounts.find((a) => matches(a, where)) ?? null),
    create: jest.fn(async ({ data }: any) => {
      accounts.push(data);
      return data;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const a = accounts.find((x) => x.id === where.id);
      Object.assign(a, data);
      return a;
    }),
  };
  const prisma: any = { user, account };
  prisma.$transaction = jest.fn(async (fn: (tx: any) => unknown) => fn(prisma));
  return { prisma, users, accounts };
}

function httpContext(handler: (...args: any[]) => unknown, cls: unknown, headers: Record<string, string> = {}) {
  const request: any = { headers };
  return {
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => cls,
    } as any,
  };
}

describe('Admin users API', () => {
  describe('AuthGuard on AdminUsersController', () => {
    const guard = new AuthGuard(new Reflector());
    const handler = AdminUsersController.prototype.create;

    beforeEach(() => getSession.mockReset());

    it('rejects unauthenticated requests with 401', async () => {
      getSession.mockResolvedValue(null);
      const { ctx } = httpContext(handler, AdminUsersController);
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects customers with 403', async () => {
      getSession.mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' }, session: {} });
      const { ctx } = httpContext(handler, AdminUsersController);
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows admins and bypasses the session cookie cache for role checks', async () => {
      getSession.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' }, session: {} });
      const { ctx, request } = httpContext(handler, AdminUsersController);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(request.user.id).toBe('a1');
      expect(getSession).toHaveBeenCalledWith(expect.objectContaining({ query: { disableCookieCache: true } }));
    });
  });

  describe('AdminUsersController + AdminUsersService', () => {
    it('lists admins only', async () => {
      const { prisma } = createUserStore([
        { id: 'a1', email: 'admin@x.co', role: 'ADMIN' },
        { id: 'c1', email: 'cust@x.co', role: 'CUSTOMER' },
      ]);
      const controller = new AdminUsersController(new AdminUsersService(prisma));
      const list = await controller.list();
      expect(list.map((u: any) => u.email)).toEqual(['admin@x.co']);
    });

    it('promotes an existing customer by email without touching their password', async () => {
      const { prisma, users, accounts } = createUserStore([
        { id: 'a1', email: 'admin@x.co', role: 'ADMIN' },
        { id: 'c1', email: 'cust@x.co', role: 'CUSTOMER', credential: true },
      ]);
      const controller = new AdminUsersController(new AdminUsersService(prisma));
      const res = await controller.create({ email: ' Cust@X.co ', password: 'ignored-password' });
      expect(res.action).toBe('promoted');
      expect(users.find((u) => u.id === 'c1')!.role).toBe('ADMIN');
      expect(accounts.find((a) => a.userId === 'c1').password).toBe('existing-hash');
    });

    it('creates a new admin with a hashed password', async () => {
      const { prisma, users, accounts } = createUserStore([{ id: 'a1', email: 'admin@x.co', role: 'ADMIN' }]);
      const controller = new AdminUsersController(new AdminUsersService(prisma));
      const res = await controller.create({ email: 'new@x.co', password: 'super-secret-1', name: 'New' });
      expect(res.action).toBe('created');
      const created = users.find((u) => u.email === 'new@x.co')!;
      expect(created).toMatchObject({ role: 'ADMIN', emailVerified: true });
      const hash = accounts.find((a) => a.userId === created.id).password;
      expect(hash).not.toContain('super-secret-1');
      expect(await verifyPassword({ hash, password: 'super-secret-1' })).toBe(true);
    });

    it('validates the body', async () => {
      const { prisma } = createUserStore();
      const controller = new AdminUsersController(new AdminUsersService(prisma));
      expect(() => controller.create({ email: 'not-an-email' })).toThrow(BadRequestException);
      expect(() => controller.create({ email: 'a@b.co', password: 'short' })).toThrow(BadRequestException);
      await expect(controller.create({ email: 'missing@x.co' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses to demote the last admin', async () => {
      const { prisma, users } = createUserStore([{ id: 'a1', email: 'admin@x.co', role: 'ADMIN' }]);
      const controller = new AdminUsersController(new AdminUsersService(prisma));
      await expect(controller.revoke('a1')).rejects.toBeInstanceOf(ConflictException);
      expect(users[0].role).toBe('ADMIN');
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('demotes an admin when another admin remains', async () => {
      const { prisma, users } = createUserStore([
        { id: 'a1', email: 'admin@x.co', role: 'ADMIN' },
        { id: 'a2', email: 'second@x.co', role: 'ADMIN' },
      ]);
      const controller = new AdminUsersController(new AdminUsersService(prisma));
      const res = await controller.revoke('a2');
      expect(res.role).toBe('CUSTOMER');
      expect(users).toHaveLength(2);
    });
  });

  describe('ensureAdmin', () => {
    it('never deletes or recreates an existing admin and keeps the password', async () => {
      const { prisma, accounts } = createUserStore([
        { id: 'a1', email: 'admin@x.co', role: 'ADMIN', credential: true },
      ]);
      const res = await ensureAdmin(prisma, { email: 'admin@x.co', password: 'some-new-password' });
      expect(res).toEqual({ action: 'unchanged', userId: 'a1', passwordSet: false });
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(accounts[0].password).toBe('existing-hash');
    });

    it('adds a credential account to a Google-only admin when a password is given', async () => {
      const { prisma, accounts } = createUserStore([{ id: 'a1', email: 'admin@x.co', role: 'ADMIN' }]);
      const res = await ensureAdmin(prisma, { email: 'admin@x.co', password: 'some-new-password' });
      expect(res).toMatchObject({ action: 'unchanged', passwordSet: true });
      expect(accounts).toHaveLength(1);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('resets the password only when asked', async () => {
      const { prisma, accounts } = createUserStore([
        { id: 'a1', email: 'admin@x.co', role: 'ADMIN', credential: true },
      ]);
      await ensureAdmin(prisma, { email: 'admin@x.co', password: 'some-new-password', resetPassword: true });
      expect(await verifyPassword({ hash: accounts[0].password, password: 'some-new-password' })).toBe(true);
    });
  });

  describe('seedAdminFromEnv', () => {
    it('skips when ADMIN_EMAIL/ADMIN_PASSWORD are not set', async () => {
      const { prisma } = createUserStore();
      const log = jest.fn();
      expect(await seedAdminFromEnv(prisma, {} as NodeJS.ProcessEnv, log)).toBeNull();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates the admin from env and never logs the password', async () => {
      const { prisma, users } = createUserStore();
      const log = jest.fn();
      const env = { ADMIN_EMAIL: 'boss@x.co', ADMIN_PASSWORD: 'env-secret-pass' } as NodeJS.ProcessEnv;
      const res = await seedAdminFromEnv(prisma, env, log);
      expect(res?.action).toBe('created');
      expect(users[0]).toMatchObject({ email: 'boss@x.co', role: 'ADMIN' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('env-secret-pass');

      // Re-running is idempotent.
      expect((await seedAdminFromEnv(prisma, env, log))?.action).toBe('unchanged');
      expect(users).toHaveLength(1);
    });
  });

  describe('admin:create CLI', () => {
    it('reads ADMIN_EMAIL/ADMIN_PASSWORD from env', async () => {
      const { prisma, users } = createUserStore();
      const log = jest.fn();
      const code = await runCreateAdmin([], { ADMIN_EMAIL: 'cli@x.co', ADMIN_PASSWORD: 'cli-secret-pass' } as any, prisma, log);
      expect(code).toBe(0);
      expect(users[0]).toMatchObject({ email: 'cli@x.co', role: 'ADMIN' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('cli-secret-pass');
    });

    it('promotes an existing user given --email', async () => {
      const { prisma, users } = createUserStore([{ id: 'c1', email: 'cust@x.co', role: 'CUSTOMER' }]);
      const code = await runCreateAdmin(['--email', 'cust@x.co'], {} as any, prisma, jest.fn());
      expect(code).toBe(0);
      expect(users[0].role).toBe('ADMIN');
    });

    it('fails without an email, on unknown args, and when creating without a password', async () => {
      const { prisma } = createUserStore();
      expect(await runCreateAdmin([], {} as any, prisma, jest.fn())).toBe(1);
      expect(await runCreateAdmin(['--bogus'], {} as any, prisma, jest.fn())).toBe(1);
      expect(await runCreateAdmin(['--email=new@x.co'], {} as any, prisma, jest.fn())).toBe(1);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
});
