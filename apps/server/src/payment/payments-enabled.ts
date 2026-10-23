import { CanActivate, Injectable } from '@nestjs/common';
import { shopForbidden } from '../common/error-codes';

/**
 * PAYMENTS_ENABLED, read at request time (not boot) so the owner can flip it
 * with a Railway variable. Defaults to off in production and on elsewhere.
 */
export function paymentsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.PAYMENTS_ENABLED?.trim().toLowerCase();
  if (raw && ['true', '1', 'yes', 'on'].includes(raw)) return true;
  if (raw && ['false', '0', 'no', 'off'].includes(raw)) return false;
  return env.NODE_ENV !== 'production';
}

export function assertPaymentsEnabled() {
  if (!paymentsEnabled()) {
    throw shopForbidden('PAYMENTS_DISABLED', 'Payments are not enabled yet. Orders cannot be placed right now.');
  }
}

/** Refuses order creation and payment endpoints (403 PAYMENTS_DISABLED) while the flag is off. */
@Injectable()
export class PaymentsEnabledGuard implements CanActivate {
  canActivate(): boolean {
    assertPaymentsEnabled();
    return true;
  }
}
