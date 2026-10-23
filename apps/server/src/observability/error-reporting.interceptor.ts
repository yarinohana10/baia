import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, catchError, throwError } from 'rxjs';
import { Prisma } from '../generated/prisma';
import { mapPrismaError } from '../common/prisma-exception.filter';
import { getErrorReporter } from './error-reporter';

/** The HTTP status the client will actually receive for this error. */
export function responseStatus(err: unknown): number {
  if (err instanceof HttpException) return err.getStatus();
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    if (mapped) return mapped.statusCode;
  }
  return 500;
}

/**
 * Reports errors that become a 5xx response to the error reporter and
 * re-throws them untouched, so existing exception filters and error bodies
 * are unchanged. 4xx (validation, auth, not found, ...) are expected and not reported.
 */
@Injectable()
export class ErrorReportingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) => {
        try {
          const reporter = getErrorReporter();
          if (reporter.enabled && context.getType() === 'http' && responseStatus(err) >= 500) {
            const req = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
            reporter.captureException(err, {
              request: { method: req.method, url: req.originalUrl ?? req.url, headers: req.headers },
              userId: req.user?.id,
              tags: { route: req.route?.path ?? 'unknown' },
            });
          }
        } catch {
          // reporting must never change the response
        }
        return throwError(() => err);
      }),
    );
  }
}
