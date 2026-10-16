import type { EmailLocale } from '../email.types';

const BRAND_COLOR = '#005d72';
const TEXT_COLOR = '#1a1c1c';
const MUTED_COLOR = '#3f484c';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function dirFor(locale: EmailLocale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

export interface LayoutParts {
  locale: EmailLocale;
  /** Shown in inbox previews. Plain text. */
  preheader: string;
  heading: string;
  /** Paragraphs of plain text (escaped here). */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Small print under the button. Plain text. */
  footnote?: string;
}

const FOOTER: Record<EmailLocale, string> = {
  he: 'BAIA בגדי ים · קיבלת הודעה זו כי בוצעה פעולה בחשבון שלך באתר.',
  en: 'BAIA Swimwear · You received this email because of activity on your account.',
};

const LINK_FALLBACK: Record<EmailLocale, string> = {
  he: 'אם הכפתור לא עובד, אפשר להעתיק את הקישור הבא לדפדפן:',
  en: "If the button doesn't work, copy this link into your browser:",
};

/**
 * Table-based, inline-styled layout that renders consistently in common email
 * clients. Direction and alignment are set on every block element because many
 * clients ignore `dir` on <html>.
 */
export function renderLayout(parts: LayoutParts): string {
  const dir = dirFor(parts.locale);
  const align = dir === 'rtl' ? 'right' : 'left';
  const font = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
  const p = (text: string) =>
    `<p dir="${dir}" style="margin:0 0 16px;font-family:${font};font-size:16px;line-height:24px;color:${MUTED_COLOR};text-align:${align};">${escapeHtml(text)}</p>`;

  const cta = parts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;" align="${align}">
        <tr><td style="border-radius:4px;background:${BRAND_COLOR};">
          <a href="${escapeHtml(parts.cta.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${font};font-size:14px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-decoration:none;">${escapeHtml(parts.cta.label)}</a>
        </td></tr>
      </table>
      <div style="clear:both;"></div>
      <p dir="${dir}" style="margin:0 0 8px;font-family:${font};font-size:13px;line-height:20px;color:${MUTED_COLOR};text-align:${align};">${escapeHtml(LINK_FALLBACK[parts.locale])}</p>
      <p dir="ltr" style="margin:0 0 16px;font-family:${font};font-size:13px;line-height:20px;word-break:break-all;text-align:left;"><a href="${escapeHtml(parts.cta.url)}" style="color:${BRAND_COLOR};">${escapeHtml(parts.cta.url)}</a></p>`
    : '';

  const footnote = parts.footnote
    ? `<p dir="${dir}" style="margin:16px 0 0;font-family:${font};font-size:13px;line-height:20px;color:${MUTED_COLOR};text-align:${align};">${escapeHtml(parts.footnote)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="${parts.locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(parts.heading)}</title>
</head>
<body dir="${dir}" style="margin:0;padding:0;background:#f4f4f4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(parts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="max-width:560px;background:#ffffff;border-radius:8px;">
      <tr><td align="center" style="padding:32px 32px 8px;">
        <span dir="ltr" style="font-family:Georgia, 'Times New Roman', serif;font-size:28px;letter-spacing:6px;color:${TEXT_COLOR};">BAIA</span>
      </td></tr>
      <tr><td dir="${dir}" style="padding:24px 32px 32px;text-align:${align};">
        <h1 dir="${dir}" style="margin:0 0 20px;font-family:Georgia, 'Times New Roman', serif;font-size:24px;line-height:32px;font-weight:normal;color:${TEXT_COLOR};text-align:${align};">${escapeHtml(parts.heading)}</h1>
        ${parts.paragraphs.map(p).join('\n        ')}
        ${cta}
        ${footnote}
      </td></tr>
    </table>
    <p dir="${dir}" style="max-width:560px;margin:16px auto 0;font-family:${font};font-size:12px;line-height:18px;color:#8a9296;text-align:center;">${escapeHtml(FOOTER[parts.locale])}</p>
  </td></tr>
</table>
</body>
</html>`;
}

/** Plain-text alternative built from the same parts. */
export function renderText(parts: LayoutParts): string {
  const lines = [parts.heading, '', ...parts.paragraphs.flatMap((x) => [x, ''])];
  if (parts.cta) lines.push(`${parts.cta.label}:`, parts.cta.url, '');
  if (parts.footnote) lines.push(parts.footnote, '');
  lines.push('--', FOOTER[parts.locale]);
  return lines.join('\n');
}
