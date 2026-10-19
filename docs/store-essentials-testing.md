# Store essentials: how to check everything

Branch `feat/store-essentials`. Preview stack:

| What | Where |
|---|---|
| Storefront | http://localhost:3050/he |
| Admin | http://localhost:3050/he/admin |
| API | http://localhost:8050/v1 |
| Emails (Mailpit) | http://localhost:8025 |
| Database | `baia_review` (a copy of `baia`; your real `baia` DB is untouched) |

To get admin access to the preview, sign in with your usual admin account. The preview database is a copy of yours.

---

## 1. The end-to-end flow

```
REGISTER ─▶ one "Welcome to BAIA, please verify your email" email (optional unticked marketing box → newsletter)
   │
BROWSE ──▶ category / new-arrivals / search: filters for size (in-stock only), color, price, in-stock
   │        product page: size guide (cm), fabric & care, fit, shipping & returns, related products
   │
CART ────▶ drawer + cart page: "₪X left for free shipping" bar, prices include VAT
   │
CHECKOUT ▶ email is required → courier OR pickup point (search by city) → unticked marketing box
   │        → required "I accept the terms & privacy policy" box
   │        DB: orders (deliveryMethod, pickupPointId/Name, marketingConsent) + newsletter_subscribers
   │
PAYMENT ─▶ mock provider → status CONFIRMED, paidAt set
   │        EMAIL customer: order confirmation (order number, delivery, ETA, "View order" link that works for
   │              guests too, track-order link, 48h cancellation link)
   │        EMAIL store: new paid order alert
   │
TRACK ───▶ /order-status: order number + email → order page with timeline
   │        (received → paid → processing → shipped → delivered / cancelled)
   │
CANCEL ──▶ within 48h of payment and not shipped: "Cancel order" → instant cancel + full refund + restock
   │          (cancellation_requests row AUTO_CANCELLED; customer + store emails)
   │        after 48h / shipped / prefers to talk: request form (also public /cancel-order)
   │          → REQUESTED; customer gets "we got your request"; store alert; admin badge
   │        admin approves (fee input, refund = total − fee) or rejects (note) → customer email
   │
FULFIL ──▶ admin sets SHIPPED (asks for tracking number) → "Your order is on its way" email
           admin sets DELIVERED → delivered email
```

Admin alerts: the bell and the sidebar badges (Orders, Cancellations, Messages) refresh every 60 seconds. The dashboard has a "Needs attention" card.

---

## 2. Step-by-step checks

### A. Legal and trust (storefront)
1. **Footer** (any page):
   - business name, "ח.פ. יעודכן בקרוב" (placeholder), Moshav Gilat, the placeholder phone and the email
   - the **ביטול עסקה** button in the top row
   - links to the terms, privacy policy and accessibility statement
   - the line "all prices include VAT"
2. **Legal pages**: `/he/terms`, `/he/privacy` and `/he/accessibility`. The table of contents jumps to each section. Business details, delivery prices and the 48h window come from the admin settings.
3. **Shipping and returns pages**: `/he/shipping` and `/he/returns` show courier vs pickup point prices and ETAs, the 48h free cancellation, the 14-day legal cancellation and fee, and the hygiene liner rule.
4. **Cookie banner**: open the site in a private window and the banner appears. Choose an option and reload; it doesn't come back.
5. **WhatsApp button**: bottom-right in Hebrew. It is hidden on the cart and checkout pages.
6. **Newsletter in the footer**:
   - submitting without ticking the box gives an error
   - ticking it shows a success message
   - the signup appears in **Admin → Newsletter** (CSV export available)
7. **Contact** (`/he/contact`): send a message.
   - Mailpit shows the store email (reply-to is the customer) and an auto-reply to the customer.
   - **Admin → Messages** shows it as new; mark it handled.

### B. Registration
1. Register at `/he/register` and tick the marketing box. Mailpit shows exactly **one** email: "ברוכים הבאים ל-BAIA - נשאר רק לאמת את המייל".
2. Click verify. No second welcome email is sent.
3. On `/he/account`, the "דיוור ועדכונים" switch is on. Turn it off and check that Admin → Newsletter shows the person as removed.

### C. Product pages and filters
1. **Category page** (e.g. `/he/category/men`): use Size (only in-stock sizes are listed), Color, Price and "In stock only".
   - The URL updates, chips appear, and "Clear all" resets everything.
   - On a phone the same filters open as a "סינון" sheet.
2. **Product page**: check
   - breadcrumbs and the zoomable gallery
   - "המחיר כולל מע״מ"
   - sold-out sizes crossed out, and "only X left" when stock is 3 or less
   - **מדריך מידות** (cm table and how to measure)
   - the accordions: fabric & care, size & fit, shipping & returns
   - the trust row and "You may also like"
   - on a phone, the sticky add-to-cart bar
3. **Admin → Products → edit**: fill "פרטי מוצר" (fabric, care, fit), save, and check that it shows on the product page.

### D. Checkout, emails, tracking (do this as a guest in a private window)
1. Add an item, then check the "₪X left for free shipping" bar in the drawer and on the cart page.
2. At checkout, switch between **שליח עד הבית** and **איסוף מנקודת חלוקה**: the price and ETA change. Search "באר" and pick a point.
3. The order button stays disabled until the terms box is ticked. Place the order; payment is the mock provider.
4. In Mailpit you should have:
   - the **customer confirmation**: order number, pickup point, ETA, "צפייה בהזמנה", plus track and cancel links
   - the **store alert**
5. Open "צפייה בהזמנה" from the email in a different browser. The order page opens with the timeline.
6. Go to `/he/order-status`, enter the order number and the email in a different letter case. The same page opens.

### E. Cancellation (48h)
1. On the order page click **ביטול הזמנה**, pick a reason and confirm.
   - The status becomes cancelled, with a full refund and stock returned.
   - You get two emails, customer and store.
   - **Admin → Cancellations → "בוטלה בשירות עצמי"** shows it.
2. Place another order, then go to `/he/cancel-order`. Enter the order number, email, phone and reason, and send a request instead of the instant cancel.
   - The customer gets a "we got your request" email.
   - The **Cancellations** badge appears in admin.
3. In **Admin → Cancellations**, approve with a fee, or reject with a note. The customer gets the matching email.
4. To test "after 48h": in admin **Delivery**, set the self-cancel window to 0 hours. The order page then offers only the request form.

### F. Admin
1. **Delivery** (new): set courier and pickup prices, the free-shipping threshold, ETAs and the self-cancel window; add, edit or disable pickup points. Checkout reflects the changes.
2. **Settings → פרטי העסק**: company number (ח.פ.), phone, email, WhatsApp number (format `9725XXXXXXXX`) and the accessibility coordinator. The footer and legal pages update.
3. **Orders**: delivery method and pickup point are shown.
   - Changing the status to SHIPPED asks for a tracking number, and the customer gets the shipped email.
   - Then DELIVERED sends the delivered email.
4. **Dashboard**: the "דורש טיפול" card, the sales chart (today's sales now show), and **Export**, which downloads a CSV of orders.

---

## 3. Placeholders and open items for you
- **Business details** (Admin → Settings): company number (ח.פ.), phone, WhatsApp number and accessibility coordinator are placeholders.
- **Legal texts need a lawyer's review**, especially:
  - the swimwear hygiene clause
  - who pays return shipping
  - the jurisdiction clause
  - the 4-month cancellation right for seniors, people with disabilities and new immigrants
- **Pickup points** are generic examples until a courier is chosen (Cheetah, HFD, UPS…). Carrier tracking links need `TRACKING_URL_TEMPLATE`.
- **Payments are still the mock provider.** Refunds go through the same interface, so a real provider plugs in later.
- **Size charts** are standard industry ranges, editable in `apps/client/src/lib/catalog/size-charts.ts`. Check them against BAIA's patterns.
- **Colors are free text.** "Black" and "black" show up as separate filter options; a fixed palette in admin is a good next step.
