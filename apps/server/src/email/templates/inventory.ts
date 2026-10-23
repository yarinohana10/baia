import type { EmailTemplate } from './index';
import { render } from './helpers';

/** Store-inbox stock alerts (always Hebrew). One email per variant crossing. */

interface StockAlertData {
  productName: string;
  color: string;
  size: string;
  sku?: string | null;
  remaining: number;
  /** Link to the product in the admin panel. */
  adminUrl: string;
}

export interface InventoryTemplateData {
  'admin-low-stock': StockAlertData & { threshold: number };
  'admin-sold-out': StockAlertData;
}

const detailRows = (d: StockAlertData) => [
  { label: 'מוצר', value: d.productName },
  { label: 'צבע', value: d.color },
  { label: 'מידה', value: d.size },
  ...(d.sku ? [{ label: 'מק״ט', value: d.sku }] : []),
];

const adminLowStock: EmailTemplate<InventoryTemplateData['admin-low-stock']> = (data, _locale, ctx) =>
  render(
    {
      locale: 'he',
      preheader: `נותרו ${data.remaining} יחידות: ${data.productName} / ${data.color} / ${data.size}`,
      heading: 'מלאי נמוך',
      paragraphs: [],
      blocks: [
        { type: 'facts', items: [{ label: 'נותר במלאי', value: String(data.remaining) }] },
        { type: 'details', rows: detailRows(data) },
        { type: 'callout', tone: 'warning', lines: [`המלאי ירד ל-${data.remaining} יחידות (סף ההתראה: ${data.threshold}).`] },
      ],
      cta: { label: 'עדכון מלאי', url: data.adminUrl },
    },
    `מלאי נמוך: ${data.productName} / ${data.color} / ${data.size} (נותרו ${data.remaining})`,
    ctx,
  );

const adminSoldOut: EmailTemplate<InventoryTemplateData['admin-sold-out']> = (data, _locale, ctx) =>
  render(
    {
      locale: 'he',
      preheader: `אזל המלאי: ${data.productName} / ${data.color} / ${data.size}`,
      heading: 'המלאי אזל',
      paragraphs: [],
      blocks: [
        { type: 'facts', items: [{ label: 'נותר במלאי', value: String(data.remaining) }] },
        { type: 'details', rows: detailRows(data) },
        { type: 'callout', tone: 'warning', lines: ['הפריט מוצג בחנות כ"חוזר בקרוב" ולא ניתן לרכישה עד שהמלאי יתעדכן.'] },
      ],
      cta: { label: 'עדכון מלאי', url: data.adminUrl },
    },
    `אזל המלאי: ${data.productName} / ${data.color} / ${data.size}`,
    ctx,
  );

export const inventoryTemplates: { [K in keyof InventoryTemplateData]: EmailTemplate<InventoryTemplateData[K]> } = {
  'admin-low-stock': adminLowStock,
  'admin-sold-out': adminSoldOut,
};
