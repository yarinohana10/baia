import { getErrorReporter } from '@/lib/error-reporting';

/**
 * Next.js server-side error hook: reports errors thrown while rendering pages,
 * route handlers and middleware. No-op without NEXT_PUBLIC_SENTRY_DSN. The
 * request path is reported without its query string; cookies/headers values
 * and bodies are never sent.
 */
export function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  getErrorReporter().captureException(error, {
    request: { method: request.method, url: request.path },
    tags: { routeType: context.routeType, route: context.routePath },
  });
}
