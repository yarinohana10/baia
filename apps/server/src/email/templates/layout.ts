import type { EmailBranding, EmailLocale } from '../email.types';
import { defaultBranding } from '../email-store';

/**
 * Email layout: table-based, inline-styled HTML that renders consistently in
 * Gmail, Outlook (incl. desktop/MSO), Apple Mail and mobile clients, plus a
 * plain-text alternative built from the same parts.
 *
 * Templates describe *content* (LayoutParts / blocks); this file owns all
 * markup. Every string is escaped here and every URL is checked, so
 * templates can pass user-controlled values (names, notes, product names)
 * as-is.
 */

// Light palette (inline) + dark overrides (<style>, for clients that honour it).
const C = {
  page: '#f3f1ee',
  card: '#ffffff',
  text: '#1a1c1c',
  muted: '#5b6468',
  faint: '#80898d',
  border: '#e6e2dc',
  brand: '#005d72',
  soft: '#f1f6f7',
  warnBg: '#fff6e5',
  warnBorder: '#f0d9a8',
  warnText: '#6b4a00',
  okBg: '#edf7f0',
  okBorder: '#bfe0c8',
  okText: '#1e5631',
};

const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s), mailto: and tel: links make it into an email. */
export function safeUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  return /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : null;
}

export function dirFor(locale: EmailLocale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

/** Why the recipient got this email (footer line). */
export type FooterReason = 'order' | 'contact' | 'account' | 'internal';

export interface LayoutContext {
  branding: EmailBranding;
  reason: FooterReason;
}

export function defaultLayoutContext(reason: FooterReason = 'account'): LayoutContext {
  return { branding: defaultBranding(), reason };
}

export type Link = { label: string; url: string };

export interface ItemRow {
  name: string;
  color?: string | null;
  size?: string | null;
  quantity: number;
  /** Formatted line total. */
  lineTotal: string;
  /** Formatted unit price (shown when quantity > 1). */
  unitPrice?: string | null;
  /** Absolute http(s) URL of a product photo. */
  imageUrl?: string | null;
}

export type InfoBox = { title: string; lines: string[]; link?: Link | null };

export type Block =
  | { type: 'paragraphs'; items: string[] }
  /** Short label/value pairs side by side (order number, date...). */
  | { type: 'facts'; items: { label: string; value: string }[] }
  /** Label/value rows stacked vertically (admin alerts, contact details). */
  | { type: 'details'; title?: string; rows: { label: string; value: string; url?: string | null }[] }
  | { type: 'items'; title?: string; items: ItemRow[] }
  | { type: 'totals'; rows: { label: string; value: string; strong?: boolean }[]; note?: string }
  /** Boxes in a 2-column grid (1 column on phones). */
  | { type: 'info'; boxes: InfoBox[] }
  | { type: 'callout'; tone: 'info' | 'warning' | 'success'; title?: string; lines: string[]; link?: Link | null }
  /** Quoted text such as the shopper's own message. */
  | { type: 'quote'; title?: string; lines: string[] };

export interface LayoutParts {
  locale: EmailLocale;
  /** Shown in inbox previews. Plain text. */
  preheader: string;
  heading: string;
  /** Intro paragraphs of plain text (escaped here). */
  paragraphs: string[];
  /** Structured content after the intro. */
  blocks?: Block[];
  /** Main button; its raw URL is printed underneath as a fallback. */
  cta?: Link;
  /** Secondary text links (track order, cancel, contact...). */
  links?: Link[];
  /** Small print at the end of the card. Plain text. */
  footnote?: string;
}

const I18N = {
  he: {
    linkFallback: 'אם הכפתור לא עובד, אפשר להעתיק את הקישור הבא לדפדפן:',
    color: 'צבע',
    size: 'מידה',
    qty: 'כמות',
    each: 'ליחידה',
    companyId: 'ח.פ.',
    comingSoon: 'יעודכן בקרוב',
    terms: 'תקנון האתר',
    privacy: 'מדיניות פרטיות',
    whatsapp: 'וואטסאפ',
    tagline: 'SWIMWEAR',
    reasons: {
      order: 'קיבלת מייל זה בעקבות הזמנה שביצעת באתר BAIA.',
      contact: 'קיבלת מייל זה בעקבות פנייה ששלחת דרך האתר BAIA.',
      account: 'קיבלת מייל זה בעקבות פעולה בחשבון שלך באתר BAIA.',
      internal: 'הודעה פנימית ממערכת החנות. לא נשלחה ללקוחות.',
    },
  },
  en: {
    linkFallback: "If the button doesn't work, copy this link into your browser:",
    color: 'Color',
    size: 'Size',
    qty: 'Qty',
    each: 'each',
    companyId: 'Company no.',
    comingSoon: 'coming soon',
    terms: 'Terms',
    privacy: 'Privacy policy',
    whatsapp: 'WhatsApp',
    tagline: 'SWIMWEAR',
    reasons: {
      order: 'You received this email because of an order you placed on the BAIA website.',
      contact: 'You received this email because you contacted us through the BAIA website.',
      account: 'You received this email because of activity on your BAIA account.',
      internal: 'Internal store notification. Not sent to customers.',
    },
  },
} as const;

const PLACEHOLDER_COMPANY_IDS = new Set(['', '0', '000000000']);

/** tel: link from a local Israeli ("050-1234567") or international number. */
export function telHref(phone: string): string | null {
  const plus = phone.trim().startsWith('+');
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (plus) return `tel:+${digits}`;
  if (digits.startsWith('0')) return `tel:+972${digits.slice(1)}`;
  return `tel:+${digits}`;
}

function whatsappHref(number: string | null): string | null {
  const digits = number?.replace(/\D/g, '') ?? '';
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

interface FooterModel {
  name: string;
  contactLine: { text: string; url?: string | null }[];
  companyLine: string;
  whatsapp: string | null;
  terms: string;
  privacy: string;
  reason: string;
}

function footerModel(locale: EmailLocale, ctx: LayoutContext): FooterModel {
  const t = I18N[locale];
  const b = ctx.branding;
  const contactLine: FooterModel['contactLine'] = [];
  if (b.businessAddress) contactLine.push({ text: b.businessAddress });
  if (b.businessPhone) contactLine.push({ text: b.businessPhone, url: telHref(b.businessPhone) });
  if (b.contactEmail) contactLine.push({ text: b.contactEmail, url: `mailto:${b.contactEmail}` });
  const companyId = b.companyId?.trim() ?? '';
  return {
    name: b.businessName,
    contactLine,
    companyLine: `${t.companyId} ${PLACEHOLDER_COMPANY_IDS.has(companyId) ? t.comingSoon : companyId}`,
    whatsapp: whatsappHref(b.whatsappNumber),
    terms: `${b.siteUrl}/${locale}/terms`,
    privacy: `${b.siteUrl}/${locale}/privacy`,
    reason: t.reasons[ctx.reason],
  };
}

// ─── HTML ──────────────────────────────────────────────────────

interface Dir {
  dir: 'rtl' | 'ltr';
  start: 'right' | 'left';
  end: 'right' | 'left';
}

const e = escapeHtml;

function anchor(link: Link, style = ''): string {
  const href = safeUrl(link.url);
  if (!href) return e(link.label);
  return `<a href="${e(href)}" target="_blank" class="em-link" style="color:${C.brand};text-decoration:underline;${style}">${e(link.label)}</a>`;
}

/** Money/number values keep their own direction inside RTL text. */
const ltr = (value: string) => `<span dir="ltr" style="unicode-bidi:embed;">${e(value)}</span>`;

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

function paragraph(text: string, d: Dir): string {
  return `<p dir="${d.dir}" class="em-muted" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.muted};text-align:${d.start};">${e(text)}</p>`;
}

function sectionTitle(text: string, d: Dir): string {
  return `<p dir="${d.dir}" class="em-text" style="margin:8px 0 8px;font-family:${FONT};font-size:13px;line-height:18px;font-weight:bold;letter-spacing:0.5px;color:${C.text};text-align:${d.start};">${e(text)}</p>`;
}

function infoBox(b: InfoBox, d: Dir): string {
  return `<table ${TABLE} width="100%" dir="${d.dir}" class="em-soft" style="background:${C.soft};border-radius:8px;">
          <tr><td style="padding:16px;text-align:${d.start};">
            <div class="em-muted" style="font-family:${FONT};font-size:12px;line-height:16px;font-weight:bold;letter-spacing:0.5px;color:${C.muted};margin:0 0 6px;">${e(b.title)}</div>
            ${b.lines.map((l) => `<div class="em-text" style="font-family:${FONT};font-size:14px;line-height:21px;color:${C.text};word-break:break-word;">${e(l)}</div>`).join('')}
            ${b.link ? `<div style="font-family:${FONT};font-size:14px;line-height:21px;margin-top:6px;">${anchor(b.link)}</div>` : ''}
          </td></tr></table>`;
}

function renderBlock(block: Block, locale: EmailLocale, d: Dir): string {
  const t = I18N[locale];
  switch (block.type) {
    case 'paragraphs':
      return block.items.map((x) => paragraph(x, d)).join('\n');

    case 'facts': {
      const cells = block.items
        .map(
          (f) => `<td class="em-stack" valign="top" style="padding:12px 16px;text-align:${d.start};">
            <div class="em-muted" style="font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted};">${e(f.label)}</div>
            <div class="em-text" style="font-family:${FONT};font-size:15px;line-height:22px;font-weight:bold;color:${C.text};">${ltr(f.value)}</div>
          </td>`,
        )
        .join('');
      return `<table ${TABLE} width="100%" dir="${d.dir}" class="em-soft" style="margin:0 0 24px;background:${C.soft};border-radius:8px;"><tr>${cells}</tr></table>`;
    }

    case 'details': {
      const rows = block.rows
        .map(
          (r) => `<tr>
            <td class="em-muted em-border" valign="top" width="34%" style="padding:8px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:20px;color:${C.muted};text-align:${d.start};">${e(r.label)}</td>
            <td class="em-text em-border" valign="top" style="padding:8px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:20px;color:${C.text};text-align:${d.start};word-break:break-word;">${r.url ? anchor({ label: r.value, url: r.url }) : e(r.value)}</td>
          </tr>`,
        )
        .join('');
      return `${block.title ? sectionTitle(block.title, d) : ''}<table ${TABLE} width="100%" dir="${d.dir}" style="margin:0 0 24px;">${rows}</table>`;
    }

    case 'items': {
      const rows = block.items
        .map((item) => {
          const img = safeUrl(item.imageUrl);
          const thumb =
            img && /^https?:/i.test(img)
              ? `<img src="${e(img)}" width="64" height="80" alt="${e(item.name)}" style="display:block;width:64px;height:80px;object-fit:cover;border:0;border-radius:6px;background:${C.soft};">`
              : `<div class="em-soft" style="width:64px;height:80px;border-radius:6px;background:${C.soft};"></div>`;
          const variant = [item.color ? `${t.color}: ${item.color}` : null, item.size ? `${t.size}: ${item.size}` : null]
            .filter(Boolean)
            .join(' · ');
          const qty = `${t.qty}: ${item.quantity}`;
          const unit = item.quantity > 1 && item.unitPrice ? ` · ${item.unitPrice} ${t.each}` : '';
          return `<tr>
            <td class="em-border" width="64" valign="top" style="padding:12px 0;border-top:1px solid ${C.border};">${thumb}</td>
            <td class="em-border" valign="top" style="padding:12px 14px;border-top:1px solid ${C.border};text-align:${d.start};">
              <div class="em-text" style="font-family:${FONT};font-size:15px;line-height:21px;font-weight:bold;color:${C.text};">${e(item.name)}</div>
              ${variant ? `<div class="em-muted" style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.muted};">${e(variant)}</div>` : ''}
              <div class="em-muted" style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.muted};">${e(qty)}${e(unit)}</div>
            </td>
            <td class="em-text em-border" valign="top" style="padding:12px 0;border-top:1px solid ${C.border};font-family:${FONT};font-size:15px;line-height:21px;color:${C.text};text-align:${d.end};white-space:nowrap;">${ltr(item.lineTotal)}</td>
          </tr>`;
        })
        .join('');
      return `${block.title ? sectionTitle(block.title, d) : ''}<table ${TABLE} width="100%" dir="${d.dir}" style="margin:0;border-collapse:collapse;">${rows}</table>`;
    }

    case 'totals': {
      const rows = block.rows
        .map((r) => {
          const size = r.strong ? 17 : 14;
          const weight = r.strong ? 'bold' : 'normal';
          const border = r.strong ? `border-top:2px solid ${C.text};` : '';
          const pad = r.strong ? '12px 0 4px' : '4px 0';
          const color = r.strong ? C.text : C.muted;
          const cls = r.strong ? 'em-text em-strong-border' : 'em-muted';
          const cell = (content: string, align: string, nowrap = '') =>
            `<td class="${cls}" style="padding:${pad};${border}font-family:${FONT};font-size:${size}px;line-height:24px;font-weight:${weight};color:${color};text-align:${align};${nowrap}">${content}</td>`;
          return `<tr>${cell(e(r.label), d.start)}${cell(ltr(r.value), d.end, 'white-space:nowrap;')}</tr>`;
        })
        .join('');
      const note = block.note
        ? `<tr><td colspan="2" class="em-muted" style="padding:2px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};text-align:${d.end};">${e(block.note)}</td></tr>`
        : '';
      return `<table ${TABLE} width="100%" dir="${d.dir}" class="em-border" style="margin:0 0 28px;border-top:1px solid ${C.border};">
        <tr><td colspan="2" style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>${rows}${note}</table>`;
    }

    case 'info': {
      const rows: string[] = [];
      for (let i = 0; i < block.boxes.length; i += 2) {
        const pair = block.boxes.slice(i, i + 2);
        if (pair.length === 1) {
          rows.push(`<tr><td class="em-stack" width="100%" valign="top" colspan="3" style="padding:0 0 12px 0;">${infoBox(pair[0], d)}</td></tr>`);
        } else {
          rows.push(
            `<tr><td class="em-stack" width="50%" valign="top" style="padding:0 0 12px 0;">${infoBox(pair[0], d)}</td>` +
              `<td class="em-gap" width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>` +
              `<td class="em-stack" width="50%" valign="top" style="padding:0 0 12px 0;">${infoBox(pair[1], d)}</td></tr>`,
          );
        }
      }
      return `<table ${TABLE} width="100%" dir="${d.dir}" style="margin:0 0 16px;">${rows.join('')}</table>`;
    }

    case 'callout': {
      const tone =
        block.tone === 'warning'
          ? { bg: C.warnBg, border: C.warnBorder, text: C.warnText, cls: 'em-warn' }
          : block.tone === 'success'
            ? { bg: C.okBg, border: C.okBorder, text: C.okText, cls: 'em-ok' }
            : { bg: C.soft, border: C.border, text: C.text, cls: 'em-soft' };
      return `<table ${TABLE} width="100%" dir="${d.dir}" class="${tone.cls}" style="margin:0 0 24px;background:${tone.bg};border:1px solid ${tone.border};border-radius:8px;">
        <tr><td style="padding:14px 16px;text-align:${d.start};">
          ${block.title ? `<div class="${tone.cls}-text" style="font-family:${FONT};font-size:14px;line-height:21px;font-weight:bold;color:${tone.text};margin:0 0 4px;">${e(block.title)}</div>` : ''}
          ${block.lines.map((l) => `<div class="${tone.cls}-text" style="font-family:${FONT};font-size:14px;line-height:21px;color:${tone.text};word-break:break-word;">${e(l)}</div>`).join('')}
          ${block.link ? `<div style="font-family:${FONT};font-size:14px;line-height:21px;margin-top:6px;">${anchor(block.link)}</div>` : ''}
        </td></tr></table>`;
    }

    case 'quote':
      return `${block.title ? sectionTitle(block.title, d) : ''}<table ${TABLE} width="100%" dir="${d.dir}" style="margin:0 0 24px;">
        <tr><td class="em-soft" style="padding:12px 16px;background:${C.soft};border-${d.start}:3px solid ${C.brand};text-align:${d.start};">
          ${block.lines.map((l) => `<div class="em-text" style="font-family:${FONT};font-size:14px;line-height:21px;color:${C.text};word-break:break-word;">${e(l)}</div>`).join('')}
        </td></tr></table>`;
  }
}

const STYLE = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
@media only screen and (max-width:620px) {
  .em-card-pad { padding:28px 20px !important; }
  .em-stack { display:block !important; width:100% !important; }
  .em-gap { display:none !important; }
  .em-h1 { font-size:22px !important; line-height:30px !important; }
}
@media (prefers-color-scheme: dark) {
  .em-page { background:#121516 !important; }
  .em-card { background:#1c2022 !important; }
  .em-text, .em-h1 { color:#eceeef !important; }
  .em-muted { color:#a9b1b5 !important; }
  .em-border { border-color:#2e3437 !important; }
  .em-strong-border { border-color:#eceeef !important; }
  .em-soft { background:#232a2d !important; border-color:#2e3437 !important; }
  .em-soft-text { color:#eceeef !important; }
  .em-link { color:#6cc3d5 !important; }
  .em-btn { background:#6cc3d5 !important; }
  .em-btn a { color:#0d1f24 !important; }
  .em-warn { background:#3a2f17 !important; border-color:#5c4a22 !important; }
  .em-warn-text { color:#f3d9a4 !important; }
  .em-ok { background:#173023 !important; border-color:#24503a !important; }
  .em-ok-text { color:#b5e3c3 !important; }
}
[data-ogsc] .em-text, [data-ogsc] .em-h1, [data-ogsc] .em-soft-text { color:#eceeef !important; }
[data-ogsc] .em-muted { color:#a9b1b5 !important; }
[data-ogsc] .em-link { color:#6cc3d5 !important; }
`;

/** Hosted logo: the storefront serves /email/baia-logo.png; EMAIL_LOGO_URL overrides (e.g. a CDN). */
export function logoUrl(siteUrl: string): string {
  return process.env.EMAIL_LOGO_URL || `${siteUrl.replace(/\/$/, '')}/email/baia-logo.png`;
}

export function renderLayout(parts: LayoutParts, ctx: LayoutContext = defaultLayoutContext()): string {
  const dirName = dirFor(parts.locale);
  const d: Dir = { dir: dirName, start: dirName === 'rtl' ? 'right' : 'left', end: dirName === 'rtl' ? 'left' : 'right' };
  const t = I18N[parts.locale];
  const f = footerModel(parts.locale, ctx);
  const ctaHref = parts.cta ? safeUrl(parts.cta.url) : null;

  const cta =
    parts.cta && ctaHref
      ? `<table ${TABLE} style="margin:8px 0 16px;" align="${d.start}">
        <tr><td class="em-btn" style="border-radius:6px;background:${C.brand};" bgcolor="${C.brand}">
          <a href="${e(ctaHref)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:bold;letter-spacing:0.5px;color:#ffffff;text-decoration:none;border-radius:6px;">${e(parts.cta.label)}</a>
        </td></tr>
      </table>
      <div style="clear:both;line-height:0;font-size:0;">&nbsp;</div>
      <p dir="${d.dir}" class="em-muted" style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};text-align:${d.start};">${e(t.linkFallback)}</p>
      <p dir="ltr" style="margin:0 0 24px;font-family:${FONT};font-size:12px;line-height:18px;word-break:break-all;text-align:${d.start};"><a href="${e(ctaHref)}" target="_blank" class="em-link" style="color:${C.brand};">${e(ctaHref)}</a></p>`
      : '';

  const validLinks = (parts.links ?? []).filter((l) => safeUrl(l.url));
  const links = validLinks.length
    ? `<p dir="${d.dir}" style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:26px;text-align:${d.start};">${validLinks
        .map((l) => anchor(l, 'white-space:nowrap;'))
        .join(`<span class="em-muted" style="color:${C.faint};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)}</p>`
    : '';

  const footnote = parts.footnote
    ? `<p dir="${d.dir}" class="em-muted em-border" style="margin:16px 0 0;padding-top:16px;border-top:1px solid ${C.border};font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};text-align:${d.start};">${e(parts.footnote)}</p>`
    : '';

  const footerLink = (label: string, url: string | null | undefined) =>
    url && safeUrl(url)
      ? `<a href="${e(url)}" target="_blank" class="em-muted" style="color:${C.muted};text-decoration:underline;">${e(label)}</a>`
      : e(label);
  const sep = '&nbsp;·&nbsp;';
  const footerLines = [
    `<strong class="em-text" style="color:${C.text};">${e(f.name)}</strong>`,
    f.contactLine.map((c) => (c.url ? footerLink(c.text, c.url) : e(c.text))).join(sep),
    [e(f.companyLine), f.whatsapp ? footerLink(t.whatsapp, f.whatsapp) : null].filter(Boolean).join(sep),
    [footerLink(t.terms, f.terms), footerLink(t.privacy, f.privacy)].join(sep),
    e(f.reason),
  ].filter(Boolean);

  const blocks = (parts.blocks ?? []).map((b) => renderBlock(b, parts.locale, d)).join('\n');

  return `<!DOCTYPE html>
<html lang="${parts.locale}" dir="${d.dir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(parts.heading)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>${STYLE}</style>
</head>
<body dir="${d.dir}" class="em-page" style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;">${e(parts.preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
<table ${TABLE} width="100%" class="em-page" style="background:${C.page};" bgcolor="${C.page}">
  <tr><td align="center" style="padding:24px 12px 32px;">
    <!--[if mso]><table ${TABLE} width="600" align="center"><tr><td><![endif]-->
    <table ${TABLE} width="100%" dir="${d.dir}" style="max-width:600px;margin:0 auto;">
      <tr><td align="center" style="padding:8px 0 20px;">
        <!-- Logo PNG (SVG isn't supported by Gmail/Outlook). Light pill keeps it legible in dark mode; alt text shows when images are blocked. -->
        <table ${TABLE} align="center"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:10px;padding:10px 18px;">
          <img src="${e(logoUrl(ctx.branding.siteUrl))}" width="110" height="90" alt="BAIA SWIMWEAR" style="display:block;width:110px;height:90px;border:0;outline:none;text-decoration:none;font-family:${SERIF};font-size:22px;letter-spacing:6px;color:#1B4965;">
        </td></tr></table>
      </td></tr>
      <tr><td class="em-card em-card-pad" dir="${d.dir}" bgcolor="${C.card}" style="background:${C.card};border-radius:12px;padding:36px 32px;text-align:${d.start};">
        <h1 dir="${d.dir}" class="em-h1" style="margin:0 0 20px;font-family:${SERIF};font-size:26px;line-height:34px;font-weight:normal;color:${C.text};text-align:${d.start};">${e(parts.heading)}</h1>
        ${parts.paragraphs.map((x) => paragraph(x, d)).join('\n        ')}
        ${blocks}
        ${cta}
        ${links}
        ${footnote}
      </td></tr>
      <tr><td dir="${d.dir}" style="padding:24px 16px 0;text-align:center;">
        ${footerLines
          .map((line, i) => {
            const last = i === footerLines.length - 1;
            return `<p dir="${d.dir}" class="em-muted" style="margin:0 0 ${last ? 0 : 6}px;font-family:${FONT};font-size:12px;line-height:18px;color:${last ? C.faint : C.muted};text-align:center;">${line}</p>`;
          })
          .join('\n        ')}
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Plain text ────────────────────────────────────────────────

const linkLine = (link: Link | null | undefined) => (link && safeUrl(link.url) ? [`${link.label}: ${link.url}`] : []);

function blockText(block: Block, locale: EmailLocale): string[] {
  const t = I18N[locale];
  switch (block.type) {
    case 'paragraphs':
      return block.items.flatMap((x) => [x, '']);
    case 'facts':
      return [...block.items.map((f) => `${f.label}: ${f.value}`), ''];
    case 'details':
      return [
        ...(block.title ? [block.title] : []),
        ...block.rows.map((r) => `${r.label}: ${r.value}${r.url && r.url !== r.value && safeUrl(r.url) ? ` (${r.url})` : ''}`),
        '',
      ];
    case 'items':
      return [
        ...(block.title ? [block.title] : []),
        ...block.items.map((i) => {
          const variant = [i.color ? `${t.color}: ${i.color}` : null, i.size ? `${t.size}: ${i.size}` : null]
            .filter(Boolean)
            .join(', ');
          return `- ${i.quantity} × ${i.name}${variant ? ` (${variant})` : ''}: ${i.lineTotal}`;
        }),
        '',
      ];
    case 'totals':
      return [...block.rows.map((r) => `${r.label}: ${r.value}`), ...(block.note ? [block.note] : []), ''];
    case 'info':
      return block.boxes.flatMap((b) => [`${b.title}:`, ...b.lines, ...linkLine(b.link), '']);
    case 'callout':
      return [...(block.title ? [block.title] : []), ...block.lines, ...linkLine(block.link), ''];
    case 'quote':
      return [...(block.title ? [block.title] : []), ...block.lines.map((l) => `> ${l}`), ''];
  }
}

/** Plain-text alternative built from the same parts as the HTML. */
export function renderText(parts: LayoutParts, ctx: LayoutContext = defaultLayoutContext()): string {
  const f = footerModel(parts.locale, ctx);
  const t = I18N[parts.locale];
  const lines = [parts.heading, '', ...parts.paragraphs.flatMap((x) => [x, ''])];
  for (const block of parts.blocks ?? []) lines.push(...blockText(block, parts.locale));
  if (parts.cta && safeUrl(parts.cta.url)) lines.push(`${parts.cta.label}:`, parts.cta.url, '');
  const validLinks = (parts.links ?? []).filter((l) => safeUrl(l.url));
  if (validLinks.length) lines.push(...validLinks.map((l) => `${l.label}: ${l.url}`), '');
  if (parts.footnote) lines.push(parts.footnote, '');
  lines.push(
    '--',
    f.name,
    ...(f.contactLine.length ? [f.contactLine.map((c) => c.text).join(' · ')] : []),
    f.companyLine,
    ...(f.whatsapp ? [`${t.whatsapp}: ${f.whatsapp}`] : []),
    `${t.terms}: ${f.terms}`,
    `${t.privacy}: ${f.privacy}`,
    f.reason,
  );
  return lines.join('\n');
}
