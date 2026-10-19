import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthResponse } from '@baia/shared';
import { PrismaService } from '../prisma/prisma.service';

export type HealthCheckResponse = HealthResponse & {
  checks: { database: 'ok' | 'error' };
};

const DB_TIMEOUT_MS = 3000;

/**
 * Liveness + readiness for the platform healthcheck (Railway: /v1/health).
 * Returns 503 when Postgres is unreachable so a deploy that can't reach its
 * database never receives traffic.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResponse> {
    const database = await this.checkDatabase();
    const ok = database === 'ok';
    res.status(ok ? 200 : 503);
    res.setHeader('Cache-Control', 'no-store');
    return {
      status: ok ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      service: 'baia-api',
      checks: { database },
    };
  }

  private async checkDatabase(): Promise<'ok' | 'error'> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS);
        }),
      ]);
      return 'ok';
    } catch {
      return 'error';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
