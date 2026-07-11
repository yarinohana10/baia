# Baia Swimwear — Product Specification

> Swimwear e-commerce platform for men, women, and children.
> Built as a pnpm monorepo with Next.js (storefront + admin) and NestJS (API).

---

## Problem Statement

Baia Swimwear needs a direct-to-consumer online store to sell swimwear across three audience segments (men, women, children). The store must support browsing by category, filtering by size/color/price, adding items to a cart, and completing purchases with credit card payment through an Israeli clearing company.

There is no existing platform — the product, inventory, and order management must all be built from scratch. The owner (admin) needs an interface to manage the catalog, pricing, discounts, and order fulfillment without touching the database directly.

The site must be bilingual (Hebrew + English), fully RTL-aware, and designed with premium UI/UX to position Baia as a quality swimwear brand. It will be deployed on a single VPS via Docker Compose (or Railway) to keep costs minimal for a personal project.

---

## Solution

A full-stack e-commerce platform consisting of:

1. **Public Storefront** — a Next.js App Router application with a homepage, category pages, product detail pages, cart, checkout, and account management. Bilingual (he/en) with full RTL support.

2. **Admin Panel** — a protected section of the same Next.js app (`/admin/...`) for managing products, categories, discounts, orders, and site content. Accessible only to users with the `admin` role.

3. **API** — a NestJS backend providing RESTful endpoints for all storefront and admin operations. Handles authentication (better-auth), payment orchestration, inventory management, and order lifecycle.

4. **Database** — PostgreSQL with Prisma ORM. Stores products, variants, categories, orders, users, coupons, and site configuration.

5. **Shared Package** — Zod schemas and TypeScript types shared between client and server for type-safe API contracts.

---

## User Stories

### Customer — Browsing

1. As a Customer, I want to see a visually appealing homepage with a hero banner and category cards, so that I immediately understand this is a swimwear store and can navigate to what I'm looking for.
2. As a Customer, I want to browse products by category (Men / Women / Children and sub-categories), so that I can find swimwear relevant to me.
3. As a Customer, I want to see a product listing page with product cards showing the image, name, price, and sale badge, so that I can quickly scan available options.
4. As a Customer, I want to filter products by size, color, and price range, so that I only see items that match my preferences.
5. As a Customer, I want to sort products by newest, price (low-to-high and high-to-low), and bestselling, so that I can find what I want faster.
6. As a Customer, I want to use a search bar to find products by name or description, so that I can go directly to a specific item.
7. As a Customer, I want to see a "SALE" badge on discounted products with the original price struck through, so that I can spot deals.
8. As a Customer, I want to view a product detail page with an image gallery, color selector, size selector, price, and description, so that I can make an informed purchase decision.
9. As a Customer, I want to switch between Hebrew and English on any page, so that I can use the site in my preferred language.
10. As a Customer, I want the site to display correctly in RTL when I'm viewing in Hebrew, so that the reading experience is natural.
11. As a Customer, I want to see featured products and sale items on the homepage, so that I discover products without navigating deep into categories.
12. As a Customer, I want to load more products on a listing page (infinite scroll or load-more button), so that I don't deal with page-number pagination.

### Customer — Wishlist

13. As a Customer, I want to add a product to my wishlist by clicking a heart icon, so that I can save items I'm interested in for later.
14. As a Customer, I want to view my wishlist page with all saved products, so that I can revisit and purchase them.
15. As a Customer, I want to remove items from my wishlist, so that I can keep it curated.

### Customer — Cart & Checkout

16. As a Customer, I want to add a specific variant (color + size) to my cart with a quantity, so that I can purchase exactly what I want.
17. As a Customer, I want to view my cart with all items, quantities, variant details, and subtotal, so that I can review before checkout.
18. As a Customer, I want to update quantities or remove items from my cart, so that I can adjust my order.
19. As a Customer, I want to see the shipping cost in my cart (or "Free Shipping" if I'm above the threshold), so that I know the total before checkout.
20. As a Customer, I want to enter a coupon code at checkout and see the discount applied, so that I can save money.
21. As a Customer, I want to checkout as a guest (just email + shipping address) without creating an account, so that I can purchase quickly.
22. As a Customer, I want to optionally create an account during checkout, so that I can track orders later.
23. As a Customer, I want to enter my shipping address (city, street, number, apartment, zip) at checkout, so that my order can be delivered.
24. As a Customer, I want to be redirected to a secure payment page (or iframe) to enter my credit card details, so that I can complete the purchase.
25. As a Customer, I want to see an order confirmation page after successful payment, so that I know my order was placed.
26. As a Customer, I want to see a clear error message if payment fails, so that I can retry or use a different card.
27. As a Customer, I want to receive an email confirmation when my order is placed, so that I have a record.
28. As a Customer, I want to be prevented from adding an out-of-stock variant to my cart, so that I don't order something unavailable.

### Customer — Account & Orders

29. As a Customer, I want to create an account with email/password or Google OAuth, so that I can track orders and manage my wishlist.
30. As a Customer, I want to log in and log out, so that I can access my account securely.
31. As a Customer, I want to view my order history with status for each order, so that I can track deliveries.
32. As a Customer, I want to receive email notifications when my order status changes (confirmed, shipped, delivered), so that I stay informed.
33. As a Customer, I want to view the details of a past order (items, prices, shipping address, status, tracking number), so that I can reference it.

### Admin — Product Management

34. As an Admin, I want to create a new Product with bilingual name, description, base price, and category, so that I can expand the catalog.
35. As an Admin, I want to upload multiple images per product, grouped by color, so that customers see the right images for each color variant.
36. As an Admin, I want to create Product Variants with color, size, stock quantity, SKU, and optional price override, so that each purchasable option is defined.
37. As an Admin, I want to edit and delete Products and Variants, so that I can keep the catalog accurate.
38. As an Admin, I want to see a list of all Products with search and filter capabilities, so that I can manage a growing catalog efficiently.
39. As an Admin, I want to bulk-update stock quantities, so that I can quickly reflect inventory changes.
40. As an Admin, I want to see low-stock warnings for Variants below a threshold, so that I can reorder before running out.

### Admin — Category Management

41. As an Admin, I want to create, edit, and delete Categories with bilingual names and optional parent category, so that I can organize the product hierarchy.
42. As an Admin, I want to reorder categories, so that I control how they appear in navigation.

### Admin — Discounts

43. As an Admin, I want to set a Sale Price on a Variant with start and end dates, so that time-limited discounts are applied automatically.
44. As an Admin, I want to bulk-apply a sale to all Variants in a Category, so that I can run category-wide promotions efficiently.
45. As an Admin, I want to create Coupon codes with discount type (percentage/fixed), minimum cart value, expiry date, and usage limit, so that I can offer checkout discounts.
46. As an Admin, I want to view, edit, deactivate, and delete Coupons, so that I can manage active promotions.

### Admin — Order Management

47. As an Admin, I want to see a list of all Orders with status, date, customer email, and total, so that I can manage fulfillment.
48. As an Admin, I want to view the details of an Order (items, customer info, shipping address, payment reference), so that I can fulfill it.
49. As an Admin, I want to update an Order's status (confirmed → processing → shipped) and optionally add a tracking number, so that the customer is informed.
50. As an Admin, I want to cancel or refund an Order, so that I can handle returns and issues.
51. As an Admin, I want to receive a notification (email) when a new order is placed, so that I can process it promptly.

### Admin — Site Content

52. As an Admin, I want to configure the Hero Banner (image, text, CTA link) for the homepage, so that I can run promotions.
53. As an Admin, I want to configure shipping cost and free shipping threshold, so that I can adjust pricing strategy.
54. As an Admin, I want to mark products as "featured" or "bestseller" to control what appears on the homepage carousels, so that I can curate the storefront experience.

### SEO & Analytics

55. As a search engine crawler, I want to find structured data (JSON-LD) on product pages with price and availability, so that products appear in Google Shopping results.
56. As a search engine crawler, I want to access a sitemap.xml with all category and product URLs, so that the site is fully indexed.
57. As the store owner, I want to see e-commerce analytics (page views, add-to-cart, checkout, purchase) in PostHog, so that I can understand customer behavior and optimize conversions.

---

## Implementation Decisions

### Monorepo Structure

The project is a pnpm workspace monorepo with three packages:
- `apps/client` — Next.js App Router (storefront + admin panel)
- `apps/server` — NestJS API
- `packages/shared` — Zod schemas and TypeScript types

This mirrors the pattern used in the Rite Brain monorepo (`apps/platform`, `apps/brain-api`, `libs/rite-common`).

### Authentication

better-auth with Prisma adapter, matching the Brain project's auth setup:
- **Customer auth**: email/password + Google OAuth
- **Admin auth**: same mechanism, differentiated by `role` field on User
- **Guest checkout**: no auth required — Order is created with just an email address
- Admin account `yarinohana9@gmail.com` is seeded with `role: admin`

### Database Schema (key entities)

Prisma with PostgreSQL. Key models:
- `User` (better-auth managed) + `role` enum (`ADMIN`, `CUSTOMER`)
- `Category` (self-referencing `parentId` for hierarchy)
- `Product` (bilingual fields: `nameHe`, `nameEn`, `descriptionHe`, `descriptionEn`)
- `ProductVariant` (color, size, sku, stockQuantity, priceOverride, salePrice, saleStart, saleEnd)
- `ProductImage` (url, color grouping, sortOrder)
- `Cart` + `CartItem`
- `Order` + `OrderItem` (snapshot pricing)
- `Coupon` (code, discountType, discountValue, minCartValue, expiresAt, maxUses, currentUses)
- `Wishlist` (User ↔ Product join table)
- `SiteConfig` (singleton for shipping cost, free shipping threshold, hero banner config)

### API Design

RESTful endpoints under `/v1/` prefix:
- `/v1/auth/*` — better-auth routes
- `/v1/products`, `/v1/products/:id/variants` — public product APIs
- `/v1/categories` — public category tree
- `/v1/cart` — cart operations (session-based for guests, user-based for authenticated)
- `/v1/orders` — order creation and customer order history
- `/v1/checkout` — payment initiation and webhook handling
- `/v1/coupons/validate` — coupon validation
- `/v1/admin/*` — admin-only endpoints (product CRUD, order management, site config) protected by role guard

Validation via Zod schemas from `packages/shared`, using `nestjs-zod`.

### Payment Abstraction

A `PaymentProvider` interface in NestJS:
```typescript
interface PaymentProvider {
  createPayment(order: Order, returnUrl: string): Promise<PaymentSession>;
  verifyPayment(paymentId: string): Promise<PaymentResult>;
  handleWebhook(payload: unknown): Promise<WebhookResult>;
}
```
Initial implementation: `MockPaymentProvider` that auto-confirms (for development). Real provider plugged in when chosen.

### Storage Abstraction

A `StorageService` interface in NestJS:
```typescript
interface StorageService {
  upload(file: Buffer, key: string): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
```
Initial implementation: `LocalStorageService` that writes to `/uploads/` and serves via static file route. Future: `S3StorageService`.

### Internationalization

- next-intl with `[locale]` segment in App Router (same as Brain)
- Supported locales: `he` (default), `en`
- Translation JSON files: `messages/he.json`, `messages/en.json`
- Product content: bilingual fields on the model (`nameHe`/`nameEn`, `descriptionHe`/`descriptionEn`)
- RTL: `dir` attribute set per locale, Tailwind CSS RTL utilities

### Frontend State Management

- **Server data**: TanStack Query v5 (products, orders, categories)
- **Client state**: Zustand (cart for guests, UI state)
- **URL state**: search params for filters/sort on listing pages

### UI Framework

- Tailwind CSS v4 with custom Baia color palette
- shadcn/ui components (dialog, dropdown, tabs, form, etc.)
- Custom product cards, carousels, and e-commerce components
- Color palette: primary (#1B4965 deep ocean blue), accent (#C6A96C sandy gold), white backgrounds, charcoal text

### Deployment

Docker Compose with three services:
- `postgres` — PostgreSQL 16
- `api` — NestJS (Dockerfile, port 8000)
- `web` — Next.js standalone (Dockerfile, port 3000)
- `uploads` volume for persistent local image storage

Target: single VPS (Hetzner/DigitalOcean ~$6/month) or Railway.

---

## Testing Decisions

### What makes a good test

Tests should verify external behavior through public interfaces, not implementation details. A test should break only when the feature's behavior changes, not when internals are refactored.

### API testing (NestJS)

- Integration tests using supertest against the running NestJS app
- Test database via Testcontainers (PostgreSQL) — same pattern as Brain's `brain-api`
- Test the full request → response cycle: HTTP method, route, request body → status code, response shape
- Key flows to test: product CRUD, cart operations, order lifecycle, coupon validation, auth guards

### Frontend testing (Next.js)

- Component tests with Vitest + React Testing Library for critical UI components (product card, cart, checkout form)
- E2E tests with Playwright for critical user journeys: browse → add to cart → checkout
- Visual regression is out of scope for v1

### Shared package

- Unit tests for Zod schema validation (edge cases in pricing, discount rules)

---

## Out of Scope (v1)

- **Customer reviews and ratings** — deferred to v2 after real customers exist
- **Multiple shipping methods / pickup points** — flat-rate only for launch
- **Real payment provider integration** — abstraction built, mock provider used until clearing company is chosen
- **S3 / CloudFront** — local storage for launch, migration path built in
- **Mobile app** — responsive web only
- **Multi-currency** — NIS only for launch
- **Inventory sync with external systems** — manual stock management only
- **Advanced analytics dashboards** — PostHog standard e-commerce events only
- **Email marketing / newsletters** — out of scope
- **Returns / exchange workflow** — admin manually handles via order status
- **Size guide / fit recommendations** — can be added as static content later
- **Social login beyond Google** — only email/password and Google OAuth for v1
- **Multi-language beyond he/en** — two locales only for launch

---

## Further Notes

### Product Seed Data

18+ swimwear product images have been provided (swim shorts in various colors: brown, black, burgundy, yellow, orange, red, blue patterned, striped, green, camo, etc.). These will be used to seed the initial product catalog with realistic data during development.

### Admin Seed Account

`yarinohana9@gmail.com` will be seeded as the admin user with full access to the admin panel on first database migration.

### Inspiration Sources

- **Terminal X** (terminalx.com) — Israeli e-commerce UX patterns, navigation structure, checkout flow
- **Shopify** — product/variant data model, e-commerce best practices
- **Brain/Rite Platform** — monorepo structure, auth patterns, i18n setup, coding conventions

### Migration Paths

The architecture is designed with clear abstraction boundaries to support future growth:
- Storage: `LocalStorageService` → `S3StorageService`
- Payments: `MockPaymentProvider` → `TrianzilProvider` / `PayMeProvider` / etc.
- Deployment: Docker Compose on VPS → Railway → Kubernetes (if needed)
- Database: single Postgres → read replicas (if needed)
