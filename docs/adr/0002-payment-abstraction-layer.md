# ADR-0002: Payment Abstraction Layer

## Status

Accepted

## Context

Baia Swimwear needs to process credit card payments through an Israeli clearing company. The specific provider has not been chosen yet (candidates: Tranzila, PayMe, Meshulam, CardCom, Stripe).

We need to build the checkout flow and order lifecycle now, without being blocked on the provider decision. Once chosen, integration should require minimal changes.

### Alternatives considered

1. **Wait for provider decision** — block checkout development until a clearing company is chosen. Wastes time; the order lifecycle, cart, and checkout UX can all be built independently.

2. **Hard-code a specific provider** — pick one now and integrate directly. Risks expensive rework if the choice changes after comparing terms/fees.

3. **Abstract the payment interface** — define a `PaymentProvider` contract, build a mock implementation for development, swap in the real provider later.

## Decision

Build a **PaymentProvider abstraction** in NestJS (`apps/server/src/payment/payment.interface.ts`):

```typescript
interface PaymentProvider {
  readonly name: string;
  readonly testMode?: boolean;
  charge(params: PaymentChargeParams): Promise<PaymentResult>;
  refund(transactionId: string, amount?: number): Promise<PaymentResult>;
}
```

Real providers also supply a `WebhookVerifier` that authenticates and parses their callbacks. The amount always comes from the server-side order total, and `idempotencyKey` (the PaymentAttempt id) must be forwarded so a retried call cannot double-charge. Raw card data never reaches the server; real integrations pass an opaque `cardToken`.

The initial implementation is `MockPaymentProvider`, which confirms payments without moving money (`testMode`).

Provider selection is a runtime configuration via environment variable (`PAYMENT_PROVIDER=mock|tranzila|payme|...`). Whether checkout is open at all is a separate flag: see ADR-0008.

## Consequences

- Checkout flow and order lifecycle can be developed and tested end-to-end without a real payment provider.
- Adding a new provider requires implementing one interface — no changes to checkout, orders, or frontend.
- The mock provider means the full user journey is testable in development and staging.
- Integration testing of real payment flows requires the actual provider SDK, which is deferred.
