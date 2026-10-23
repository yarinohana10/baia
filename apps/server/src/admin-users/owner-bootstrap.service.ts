import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { applyVerifiedEmailGrants, ownerEmail } from '../auth/verified-email-grants';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Re-applied on every boot/deploy: if the Owner's Account exists and its email
 * is verified, make sure it is an ADMIN. Promotion only - it never touches any
 * other user, so Admins added from the admin screen survive every deploy.
 */
@Injectable()
export class OwnerBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OwnerBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    const owner = ownerEmail();
    if (!owner) return;
    try {
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: owner, mode: 'insensitive' } },
        select: { id: true, email: true, emailVerified: true },
      });
      if (user) await applyVerifiedEmailGrants(this.prisma, user);
      else this.logger.log(`Owner ${owner} has not registered yet; will be made ADMIN when they register and verify`);
    } catch (err) {
      this.logger.error(`Owner pinning failed: ${(err as Error).message}`);
    }
  }
}
