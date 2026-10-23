/**
 * Operator bootstrap: create or promote an admin account directly in the database
 * (e.g. a fresh local DB). In production the Owner is pinned by OWNER_EMAIL and
 * other Admins are managed by the Owner in the admin screen (Admin Invitations);
 * this CLI is the break-glass path and is never run on deploy.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' pnpm --filter @baia/server admin:create
 *   pnpm --filter @baia/server admin:create --email you@example.com [--name "You"] [--reset-password]
 *
 * Prefer ADMIN_PASSWORD from the environment: a --password argument ends up in
 * shell history and the process list.
 *
 * - Existing user: promoted to ADMIN (never deleted/recreated). Their password
 *   is only changed with --reset-password.
 * - New user: created with a verified email; requires a password.
 */
import '../config/load-env';
import { PrismaClient } from '../generated/prisma';
import { ensureAdmin, EnsureAdminError } from '../admin-users/ensure-admin';

export interface CreateAdminArgs {
  email?: string;
  password?: string;
  name?: string;
  resetPassword: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): CreateAdminArgs {
  const args: CreateAdminArgs = { resetPassword: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.split(/=(.*)/s, 2);
    const value = () => (inline !== undefined ? inline : argv[++i]);
    switch (flag) {
      case '--email':
        args.email = value();
        break;
      case '--password':
        args.password = value();
        break;
      case '--name':
        args.name = value();
        break;
      case '--reset-password':
        args.resetPassword = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '--':
        break;
      default:
        throw new EnsureAdminError(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

const USAGE =
  'Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @baia/server admin:create [--email <email>] [--name <name>] [--reset-password]';

export async function runCreateAdmin(
  argv: string[],
  env: NodeJS.ProcessEnv,
  prisma: Pick<PrismaClient, 'user' | 'account'>,
  log: (msg: string) => void = console.log,
): Promise<number> {
  let args: CreateAdminArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    log(`${(err as Error).message}\n${USAGE}`);
    return 1;
  }
  if (args.help) {
    log(USAGE);
    return 0;
  }

  const email = args.email ?? env.ADMIN_EMAIL;
  const password = args.password ?? env.ADMIN_PASSWORD;
  if (!email) {
    log(`Missing admin email.\n${USAGE}`);
    return 1;
  }
  if (args.password) {
    log('Warning: passing --password on the command line exposes it in shell history; prefer ADMIN_PASSWORD.');
  }

  try {
    const result = await ensureAdmin(prisma, {
      email,
      password: password || undefined,
      name: args.name ?? env.ADMIN_NAME,
      resetPassword: args.resetPassword,
    });
    const pw = 'passwordSet' in result && result.passwordSet ? ' (password set)' : '';
    if (result.action === 'created') log(`Created admin ${email.trim().toLowerCase()}`);
    else if (result.action === 'promoted') log(`Promoted ${email.trim().toLowerCase()} to ADMIN${pw}`);
    else log(`${email.trim().toLowerCase()} is already an ADMIN${pw}`);
    return 0;
  } catch (err) {
    if (err instanceof EnsureAdminError) {
      log(`Error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  runCreateAdmin(process.argv.slice(2), process.env, prisma)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
