/** Logo bundled with the app; used when LOGO_URL is not set (e.g. tests, a fresh checkout). */
export const LOGO_FALLBACK_URL = '/logo/baia-logo.png';

/**
 * Store logo URL. In deployed environments LOGO_URL points at the logo in the
 * assets bucket (LocalStack / Cloudflare R2); upload it with
 * `apps/server/scripts/brand-assets.ts`. Read at request time on the server.
 */
export function getLogoUrl(): string {
  return process.env.LOGO_URL?.trim() || LOGO_FALLBACK_URL;
}
