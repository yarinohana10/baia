# BAIA — Storefront design direction

**Mood:** a Mediterranean beach club at golden hour. Calm, sun-washed, editorial — closer to a
resort catalogue than a discount marketplace. The product photography does the talking; the UI
recedes into warm paper, deep sea ink and a single sun-baked accent.

## Principles

1. **Editorial, not template.** Large imagery, generous whitespace, a serif display face for
   headlines and the wordmark, small-caps labels. No drop shadows on cards — depth comes from
   imagery and hairline rules.
2. **One accent, used sparingly.** Terracotta is reserved for sale prices/badges and the primary
   action hover; everything else is ink on shell.
3. **Bilingual by construction.** Every typeface carries Hebrew + Latin glyphs. Layout uses logical
   properties (`ps-`, `me-`, `start-`, `end-`) so Hebrew (RTL, default) and English mirror
   correctly. Wordmark stays LTR in both locales.
4. **Fast first paint.** Catalogue pages render on the server (ISR + cache tags). Skeletons only
   where data genuinely streams; images reserve their aspect ratio so nothing shifts.
5. **Accessible by default.** All text pairs meet WCAG AA; every interactive element has a visible
   `:focus-visible` ring (2px sea, 2px offset); motion respects `prefers-reduced-motion`.

## Palette (Tailwind tokens in `apps/client/src/app/globals.css`)

| Token | Hex | Use |
| --- | --- | --- |
| `ink` | `#0F2A36` | Primary text, header/footer background, primary buttons |
| `ocean-700` | `#1B4965` | Links, active states, focus ring (`ocean-600` `#25607F`) |
| `foam` | `#DCEBE8` | Soft section background, tags |
| `shell` | `#FAF6EF` | Page background (warm paper) |
| `sand-200` | `#EBDDC4` | Hairlines on shell, image placeholders |
| `coral` | `#B5452D` | Sale price, sale badge, primary hover (5.3:1 on white) |
| `sun` | `#E8B04B` | "New" badge background (ink text on top) |
| `stone` | `#5E6B70` | Secondary text (5.6:1 on shell) |

The existing `ocean-*` / `sand-*` scales are kept (and lightly re-tuned) so admin and auth screens
keep working with the new palette.

## Type

- **Display:** Frank Ruhl Libre (Hebrew + Latin serif) — `font-display`; headlines, wordmark,
  prices on PDP. Weights 400/500/700.
- **Body/UI:** Assistant (Hebrew + Latin humanist sans) — `font-sans`; body, navigation, buttons.
  Weights 400/600/700.
- Labels: Assistant 600, 12px, `tracking-[0.18em]` uppercase (Latin) — Hebrew ignores case.
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 / 64 (clamp on hero).

Both loaded via `next/font/google` with `display: swap` and the `hebrew` + `latin` subsets.

## Spacing, shape & motion

- 4px base grid; section rhythm `py-16 sm:py-24`; page gutter `px-4 sm:px-6 lg:px-10`, max width 1440px.
- Radii: 2px on buttons/inputs (crisp, tailored), 0 on imagery, full on swatches/badges.
- Motion: 200–700ms `cubic-bezier(.2,.7,.2,1)` ("tide"); card image swap is a cross-fade, imagery
  scales subtly on hover. Hero text is never animated in (it is an LCP candidate). All motion is
  disabled under `prefers-reduced-motion`.
