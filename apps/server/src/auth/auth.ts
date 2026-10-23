import '../config/load-env';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../generated/prisma';
import { emailService } from '../email/email.service';
import { createAuth } from './auth.config';
import { applyGrantsForUserId } from './verified-email-grants';

const prisma = new PrismaClient();

export const auth = createAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  email: emailService,
  applyGrants: (userId) => applyGrantsForUserId(prisma, userId),
});

export type { Auth } from './auth.config';
