# Tickets: Baia Swimwear E-Commerce Platform

Full-stack swimwear e-commerce platform. See `docs/SPEC.md` for the complete specification.

Work the **frontier**: any ticket whose blockers are all done.

## 1. Monorepo scaffold + dev environment

**What to build:** pnpm workspace monorepo with Next.js storefront (apps/client) and NestJS API (apps/server) both running, a shared Zod types package (packages/shared), Docker Compose for Postgres, Tailwind v4 + shadcn/ui with the Baia color palette, and basic healthcheck endpoints proving the stack is wired end-to-end.

**Blocked by:** None — can start immediately.

- [ ] pnpm-workspace.yaml and root package.json with workspace scripts
- [ ] apps/client: Next.js App Router, Tailwind v4, shadcn/ui, TanStack Query, Zustand
- [ ] apps/server: NestJS with Zod validation, health endpoint
- [ ] packages/shared: Zod schemas package consumable by both apps
- [ ] docker-compose.yml with Postgres 16
- [ ] Baia color palette configured in Tailwind (ocean blue, sandy gold, white, charcoal)
- [ ] Both apps start and communicate (client fetches server health endpoint)
- [ ] .env.example files for both apps

## 2. Auth + database foundation

**What to build:** Prisma schema with User/Session/Account models, better-auth configured on the server, login and register pages on the client, admin role-based route guard, and a seed script creating the admin account (yarinohana9@gmail.com).

**Blocked by:** 1. Monorepo scaffold + dev environment

- [ ] Prisma schema with better-auth models + role enum (ADMIN, CUSTOMER)
- [ ] better-auth configured on server with Prisma adapter
- [ ] Auth API routes mounted and working
- [ ] Login page (email/password + Google OAuth button)
- [ ] Register page with account creation
- [ ] Admin route guard (role-based middleware)
- [ ] Seed script creating admin user
- [ ] Auth state management on client (session provider, auth hooks)

## 3. i18n shell + storefront layout

**What to build:** next-intl with locale-based routing (he default, en), full RTL support, storefront layout shell with header (nav, search bar, cart icon, language switcher, user menu), footer with trust badges, and "BAIA" text branding.

**Blocked by:** 1. Monorepo scaffold + dev environment

- [ ] next-intl configured with [locale] routing
- [ ] Translation JSON files (messages/he.json, messages/en.json) with initial UI strings
- [ ] RTL support (dir attribute, Tailwind RTL utilities)
- [ ] Storefront header: logo, category nav, search bar, cart icon, language switcher, user menu
- [ ] Storefront footer: trust badges, links, copyright
- [ ] Layout responsive across mobile/tablet/desktop

## 4. Category management (admin)

**What to build:** Full category CRUD — Prisma model with bilingual fields and parent_id for hierarchy, REST API endpoints, and admin panel pages to create, edit, delete, and reorder categories in a two-level tree.

**Blocked by:** 2. Auth + database foundation

- [ ] Category Prisma model (nameHe, nameEn, slug, parentId, sortOrder, image)
- [ ] CRUD API endpoints under /v1/admin/categories (guarded by admin role)
- [ ] Public GET /v1/categories returning the category tree
- [ ] Admin category list page with tree view
- [ ] Admin create/edit category form (bilingual name, parent selection, image)
- [ ] Delete category with confirmation

## 5. Product + variant management (admin)

**What to build:** Full product and variant CRUD — Prisma models, REST API with local image upload via StorageService abstraction, and admin pages to manage products with bilingual content, variants (color/size/stock/SKU/price), and images grouped by color.

**Blocked by:** 4. Category management (admin)

- [ ] Product, ProductVariant, ProductImage Prisma models
- [ ] StorageService interface with LocalStorageService implementation
- [ ] Static file serving route for /uploads/*
- [ ] CRUD API endpoints under /v1/admin/products
- [ ] Image upload endpoint
- [ ] Admin product list page (search, filter by category)
- [ ] Admin create/edit product form (bilingual fields, category picker, image upload)
- [ ] Admin variant management (add/edit/remove variants with color, size, stock, SKU, price)
- [ ] Low stock warnings in admin

## 6. Discount management (admin)

**What to build:** Sale price fields on variants with date ranges, coupon model with rules, and admin pages for managing time-limited sales (per-variant and bulk-by-category) and coupon codes.

**Blocked by:** 5. Product + variant management (admin)

- [ ] Sale price fields on ProductVariant (salePrice, saleStart, saleEnd)
- [ ] Coupon Prisma model (code, type, value, minCartValue, expiresAt, maxUses, currentUses)
- [ ] API for bulk-applying sale prices to a category
- [ ] CRUD API for coupons under /v1/admin/coupons
- [ ] Coupon validation endpoint (public, for checkout)
- [ ] Admin sale price management UI
- [ ] Admin coupon list and create/edit pages

## 7. Homepage

**What to build:** Storefront homepage with admin-configurable hero banner, three category cards (Men/Women/Children), featured products carousel, sale section with discount badges — all bilingual and RTL-aware.

**Blocked by:** 3. i18n shell + storefront layout, 5. Product + variant management (admin)

- [ ] SiteConfig model for hero banner and featured product settings
- [ ] API endpoint for homepage data (hero, categories, featured products, sale products)
- [ ] Hero banner section with image, text overlay, CTA button
- [ ] Category cards section linking to Men/Women/Children
- [ ] Featured products carousel (horizontally scrollable)
- [ ] Sale section showing discounted products with badges
- [ ] All sections bilingual and RTL-aware

## 8. Product listing page

**What to build:** Category browsing pages with product cards showing image/name/price/sale badge, filters (size, color, price range), sort options, load-more pagination, and a global search bar.

**Blocked by:** 7. Homepage

- [ ] Product listing API with pagination, filters (size, color, priceMin, priceMax), and sort
- [ ] Category page route (/[locale]/category/[slug])
- [ ] Product card component (image, name, effective price, sale badge, wishlist heart)
- [ ] Filter sidebar (size checkboxes, color swatches, price range slider)
- [ ] Sort dropdown (newest, price low/high, bestselling)
- [ ] Load more / infinite scroll pagination
- [ ] Global search results page
- [ ] Empty state for no results

## 9. Product detail page

**What to build:** Full PDP with image gallery, color selector (swaps images), size selector, price display with sale treatment, bilingual description, add-to-cart button (disabled when out of stock), and breadcrumbs.

**Blocked by:** 8. Product listing page

- [ ] Product detail API returning full product with variants and images
- [ ] PDP route (/[locale]/product/[slug])
- [ ] Image gallery with thumbnails and main image
- [ ] Color selector (swaps image gallery to selected color's images)
- [ ] Size selector (shows availability per size)
- [ ] Price display with sale treatment (original struck through)
- [ ] Add to cart button (disabled for out-of-stock variants)
- [ ] Breadcrumbs (Home > Category > Product)
- [ ] Bilingual content switching

## 10. Cart

**What to build:** Cart system with API (session-based for guests, user-based for authenticated), add/remove/update operations, cart page with items and totals, shipping cost display, and cart icon with badge count in header.

**Blocked by:** 9. Product detail page

- [ ] Cart and CartItem Prisma models
- [ ] Cart API (CRUD operations, session or user binding)
- [ ] Guest cart via session cookie
- [ ] Merge guest cart into user cart on login
- [ ] Cart page with item list, variant details, quantity controls, remove button
- [ ] Subtotal, shipping cost (flat-rate or free), total calculation
- [ ] Cart icon in header with item count badge
- [ ] Stock validation (can't add more than available)

## 11. Wishlist

**What to build:** Wishlist feature — toggle heart icon on product cards and PDP, dedicated wishlist page, requires an account (prompts login for guests).

**Blocked by:** 2. Auth + database foundation, 9. Product detail page

- [ ] Wishlist Prisma model (User ↔ Product join)
- [ ] Wishlist API (add/remove/list)
- [ ] Heart icon toggle on product cards and PDP
- [ ] Wishlist page listing saved products as product cards
- [ ] Prompt login when guest tries to wishlist

## 12. Checkout + order creation

**What to build:** Checkout page with shipping address form, coupon code input with live validation and discount preview, order summary, guest checkout option, order creation with pending_payment status, and order confirmation page.

**Blocked by:** 10. Cart, 6. Discount management (admin)

- [ ] Order, OrderItem, ShippingAddress Prisma models
- [ ] Checkout API (validate cart, apply coupon, create order)
- [ ] Checkout page with order summary
- [ ] Shipping address form (city, street, number, apartment, zip)
- [ ] Coupon code input with validation and discount preview
- [ ] Guest checkout (email field) or authenticated
- [ ] Inventory decrement on order creation
- [ ] Order confirmation page with order number

## 13. Payment flow

**What to build:** PaymentProvider interface with MockPaymentProvider, payment initiation after checkout, simulated redirect flow, webhook endpoint confirming payment, order status transition to confirmed.

**Blocked by:** 12. Checkout + order creation

- [ ] PaymentProvider interface (createPayment, verifyPayment, handleWebhook)
- [ ] MockPaymentProvider (auto-confirms after redirect simulation)
- [ ] Payment initiation endpoint
- [ ] Mock payment page (simulates provider redirect)
- [ ] Webhook endpoint to confirm payment
- [ ] Order status updated to confirmed on successful payment
- [ ] Error handling for failed payments

## 14. Customer account + order history

**What to build:** Customer account pages — profile management, saved addresses, order history with status tracking, and order detail view with item list and tracking info.

**Blocked by:** 13. Payment flow

- [ ] Account profile page (name, email)
- [ ] Order history page (list with status, date, total)
- [ ] Order detail page (items, prices, shipping address, status timeline, tracking number)
- [ ] User menu in header linking to account pages

## 15. Order management (admin)

**What to build:** Admin order dashboard — order list with filters, order detail with status workflow (confirmed → processing → shipped → delivered), tracking number entry, cancel/refund, and email notifications to customer on status change and to admin on new orders.

**Blocked by:** 13. Payment flow

- [ ] Admin order list page (filter by status, date, search by email/order number)
- [ ] Admin order detail page with full information
- [ ] Status update workflow with confirmation dialogs
- [ ] Tracking number input on ship action
- [ ] Cancel and refund actions
- [ ] Email notifications: order confirmation, status updates (to customer)
- [ ] Email notification: new order alert (to admin)

## 16. SEO + PostHog analytics

**What to build:** Next.js metadata on all pages, JSON-LD structured data on product pages (Google Shopping ready), auto-generated sitemap.xml, Open Graph images, PostHog integration tracking the e-commerce funnel.

**Blocked by:** 9. Product detail page

- [ ] Next.js metadata exports on all page routes
- [ ] JSON-LD Product structured data on PDP
- [ ] Auto-generated sitemap.xml (categories + products)
- [ ] Open Graph meta tags with product images
- [ ] PostHog provider setup
- [ ] E-commerce event tracking (page view, add to cart, checkout started, purchase completed)

## 17. Docker production deployment

**What to build:** Production-ready Docker setup — multi-stage Dockerfiles for client and server, production docker-compose.yml with Postgres + API + Web + uploads volume, environment variable docs, ready to deploy on a VPS or Railway.

**Blocked by:** 15. Order management (admin), 16. SEO + PostHog analytics

- [ ] Multi-stage Dockerfile for apps/client (standalone Next.js)
- [ ] Multi-stage Dockerfile for apps/server (NestJS)
- [ ] Production docker-compose.yml
- [ ] Uploads volume for persistent image storage
- [ ] Environment variable documentation
- [ ] Health check configurations
- [ ] Nginx reverse proxy config (optional, for VPS)
