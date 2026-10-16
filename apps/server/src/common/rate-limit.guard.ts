import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

export type RateLimitOptions = {
  /** Max requests per window per client IP for this route. */
  limit: number;
  windowMs: number;
  /** Bucket name; defaults to controller#handler. */
  key?: string;
};

export const RATE_LIMIT_KEY = 'baia:rate-limit';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window, in-memory, per-IP rate limiter.
 *
 * Deliberately dependency-free. Limitations (documented in the PR):
 *  - per-process: with N API instances the effective limit is N x limit; move
 *    the store to Redis before horizontal scaling.
 *  - keyed on req.ip: behind a reverse proxy, enable express "trust proxy"
 *    for the proxy hop so req.ip is the client, not the proxy.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static buckets = new Map<string, Bucket>();
  private static lastSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  /** Test helper: clear all counters. */
  static reset() {
    RateLimitGuard.buckets.clear();
  }

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions | undefined>(RATE_LIMIT_KEY, context.getHandler());
    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    this.sweep(now);

    const routeKey = options.key ?? `${context.getClass().name}#${context.getHandler().name}`;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${routeKey}|${ip}`;

    let bucket = RateLimitGuard.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      RateLimitGuard.buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, options.limit - bucket.count);
    res.setHeader?.('RateLimit-Limit', String(options.limit));
    res.setHeader?.('RateLimit-Remaining', String(remaining));

    if (bucket.count > options.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader?.('Retry-After', String(retryAfter));
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private sweep(now: number) {
    if (now - RateLimitGuard.lastSweep < 60_000) return;
    RateLimitGuard.lastSweep = now;
    for (const [key, bucket] of RateLimitGuard.buckets) {
      if (bucket.resetAt <= now) RateLimitGuard.buckets.delete(key);
    }
  }
}
