# Baia Swimwear — Domain Glossary

> This file defines the ubiquitous language for the Baia Swimwear e-commerce platform.
> It is a glossary — not a spec, not a scratch pad, not implementation detail.

## Actors

- **Customer**: A person who browses, wishlists, and purchases swimwear. May be authenticated (has an Account) or a Guest.
- **Guest**: A Customer who checks out without creating an Account. Identified only by the email address they provide at checkout.
- **Admin**: A team member who manages Products, Categories, Discounts, Orders, and site content via the admin panel. Identified by role on their Account.

## Core Domain

- **Product**: A swimwear item sold under the Baia brand (e.g., "Classic Swim Shorts"). Holds shared attributes: bilingual name (he/en), bilingual description, base price, images grouped by color, and the Category it belongs to.
- **Product Variant**: A specific purchasable combination of a Product's color and size (e.g., "Classic Swim Shorts / Black / L"). Each Variant has its own SKU, stock quantity, and optional price override. A Variant may have a Sale Price.
- **Category**: A classification for Products, organized in a two-level hierarchy. The top level represents the audience (Men, Women, Children). The second level represents the product type (Swim Shorts, Bikini Sets, etc.). A Category has a `parent_id` that references its parent Category, or null if it is top-level.
- **SKU**: Stock Keeping Unit — a unique identifier string for each Product Variant.

## Commerce Domain

- **Cart**: A temporary collection of Cart Items belonging to a Customer session. Persisted server-side for authenticated Customers; stored in a session/cookie for Guests.
- **Cart Item**: A line in a Cart — references a Product Variant and a quantity.
- **Order**: A confirmed purchase. Created when a Customer completes checkout. Contains a snapshot of the purchased items, prices at time of purchase, shipping address, and payment reference.
- **Order Item**: A line in an Order — a snapshot of the Product Variant, quantity, and unit price at the time of purchase.
- **Order Status**: The lifecycle state of an Order. Transitions: `pending_payment` → `confirmed` → `processing` → `shipped` → `delivered`. Side transitions: `cancelled`, `refunded`.
- **Shipping Address**: The physical delivery address provided by the Customer at checkout (city, street, number, apartment, zip code).
- **Shipping Cost**: A flat-rate fee charged for delivery. Waived when the Order subtotal exceeds the Free Shipping Threshold.
- **Free Shipping Threshold**: An admin-configurable monetary amount. Orders at or above this subtotal ship for free.

## Pricing & Discounts

- **Base Price**: The default price of a Product, inherited by all its Variants unless overridden.
- **Price Override**: An optional per-Variant price that replaces the Product's Base Price.
- **Sale Price**: A temporary reduced price on a Variant, active between a start date and end date. When active, the storefront displays the original price struck through alongside the Sale Price, and a visual "SALE" badge appears on the product card.
- **Coupon**: A discount code entered by the Customer at checkout. Has rules: discount type (percentage or fixed amount), minimum cart value, expiry date, and maximum usage count.
- **Effective Price**: The price a Customer actually pays for a Variant — the Sale Price if active, otherwise the Price Override if set, otherwise the Base Price.

## Identity & Access

- **Account**: A registered user in the system, managed by better-auth. Has an email, optional OAuth connections, and a Role.
- **Role**: Either `admin` or `customer`. Determines access to the admin panel.
- **Session**: An authenticated browser session managed by better-auth cookies.

## Content & Presentation

- **Hero Banner**: The full-width promotional section at the top of the homepage. Admin-configurable image, text overlay, and call-to-action button.
- **Category Card**: A visual card on the homepage linking to a top-level Category (Men / Women / Children).
- **Product Card**: The visual representation of a Product in listing pages and carousels — shows primary image, name, Effective Price, Sale badge (if applicable), and wishlist heart.
- **Wishlist**: A saved list of Products that a Customer has marked as favorites (heart icon). Requires an Account.
- **Trust Badge**: A visual element in the footer area communicating reliability (e.g., free shipping, secure payment, easy returns).

## Internationalization

- **Locale**: A language + direction pair. Supported: `he` (Hebrew, RTL) and `en` (English, LTR).
- **Default Locale**: Hebrew (`he`). Shown when no locale is specified in the URL.
- **Bilingual Content**: Product names and descriptions stored in both Hebrew and English. Admin enters both versions.
- **UI Translations**: Static interface strings (buttons, labels, navigation) stored in JSON translation files per locale.
