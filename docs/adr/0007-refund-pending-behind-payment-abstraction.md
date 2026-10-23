# Refunds are manual (Refund Pending) behind the payment abstraction

Cancelling a paid Order moves it to **Refund Pending**; an Admin returns the money in the payment provider's own dashboard and then confirms it in the admin panel, which records the refund and notifies the Customer. The decision is recorded per Order with a status history, and no money moves automatically.

`PaymentProvider.refund()` exists in the abstraction (ADR-0002) but the mock moves no money and no real provider is integrated yet; calling a real refund API automatically is deferred until one is, and would then replace only the "settle" step, not the state model. Rejected: auto-refunding on cancel (cannot be done safely without a provider, and partial/failed refunds need a human decision anyway).
