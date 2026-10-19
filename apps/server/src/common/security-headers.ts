import type { NextFunction, Request, Response } from 'express';

/**
 * Helmet-equivalent response headers for a JSON API (no extra dependency).
 * CSP is intentionally not set: the API serves no HTML. Static uploads (local
 * storage only) are explicitly embeddable cross-origin so the storefront can
 * show them when it lives on another site.
 */
export function securityHeaders(options: { hsts: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader(
      'Cross-Origin-Resource-Policy',
      req.path.startsWith('/uploads/') ? 'cross-origin' : 'same-site',
    );
    if (options.hsts) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}
