/**
 * Size-guide measurement charts (cm). Edit the numbers here; labels and the
 * how-to-measure copy live in messages/<locale>/catalog.json under `pdp.sizeGuide`.
 *
 * Charts are picked by the product's size set (see the server's
 * `products/size-sets.ts`: `adult-letter`, `kids-age`) and, for adult sizes,
 * by the top-level category (women / men). Products with custom sizes get the
 * measuring guide without a table.
 */

export type Measurement = 'bust' | 'chest' | 'waist' | 'hips' | 'inseam' | 'height';

export type SizeChartId = 'women' | 'men' | 'kids';

export type SizeChart = {
  id: SizeChartId;
  /** Table columns after the size column. */
  columns: Measurement[];
  rows: { size: string; values: Partial<Record<Measurement, string>> }[];
  /** How-to-measure steps shown above the table, in order. */
  howToMeasure: Measurement[];
};

export const SIZE_CHARTS: Record<SizeChartId, SizeChart> = {
  women: {
    id: 'women',
    columns: ['bust', 'waist', 'hips'],
    howToMeasure: ['bust', 'waist', 'hips'],
    rows: [
      { size: 'XS', values: { bust: '78–82', waist: '60–64', hips: '86–90' } },
      { size: 'S', values: { bust: '82–86', waist: '64–68', hips: '90–94' } },
      { size: 'M', values: { bust: '86–90', waist: '68–72', hips: '94–98' } },
      { size: 'L', values: { bust: '90–96', waist: '72–78', hips: '98–104' } },
      { size: 'XL', values: { bust: '96–102', waist: '78–84', hips: '104–110' } },
      { size: 'XXL', values: { bust: '102–108', waist: '84–90', hips: '110–116' } },
    ],
  },
  men: {
    id: 'men',
    columns: ['waist', 'hips', 'chest'],
    howToMeasure: ['waist', 'hips', 'inseam', 'chest'],
    rows: [
      { size: 'XS', values: { waist: '71–76', hips: '86–91', chest: '84–89' } },
      { size: 'S', values: { waist: '76–81', hips: '91–96', chest: '89–94' } },
      { size: 'M', values: { waist: '81–86', hips: '96–101', chest: '94–99' } },
      { size: 'L', values: { waist: '86–94', hips: '101–106', chest: '99–104' } },
      { size: 'XL', values: { waist: '94–102', hips: '106–111', chest: '104–109' } },
      { size: 'XXL', values: { waist: '102–110', hips: '111–116', chest: '109–116' } },
    ],
  },
  kids: {
    id: 'kids',
    columns: ['height', 'chest', 'waist'],
    howToMeasure: ['height', 'chest', 'waist'],
    rows: [
      { size: '2Y', values: { height: '86–92', chest: '51–53', waist: '50–51' } },
      { size: '4Y', values: { height: '98–104', chest: '54–56', waist: '52–53' } },
      { size: '6Y', values: { height: '110–116', chest: '57–60', waist: '54–56' } },
      { size: '8Y', values: { height: '122–128', chest: '61–64', waist: '57–59' } },
      { size: '10Y', values: { height: '134–140', chest: '65–69', waist: '60–62' } },
      { size: '12Y', values: { height: '146–152', chest: '70–75', waist: '63–65' } },
      { size: '14Y', values: { height: '158–164', chest: '76–81', waist: '66–69' } },
    ],
  },
};

/** Measuring steps for products with custom sizes (no table). */
export const GENERIC_HOW_TO_MEASURE: Measurement[] = ['bust', 'waist', 'hips'];

const KIDS_SLUGS = /^(children|kids|boys|girls|baby)/;
const MEN_SLUGS = /^(men|mens|man)(-|$)/;

/**
 * Which chart applies to a product: kids for the kids size set (or a kids
 * category), men for adult sizes under the men category, women for other
 * adult letter sizes. Null for custom sizes.
 */
export function sizeChartIdFor(params: { sizeSetKey?: string | null; topCategorySlug?: string | null }): SizeChartId | null {
  const slug = (params.topCategorySlug ?? '').toLowerCase();
  if (params.sizeSetKey === 'kids-age') return 'kids';
  if (params.sizeSetKey === 'adult-letter') {
    if (MEN_SLUGS.test(slug)) return 'men';
    if (KIDS_SLUGS.test(slug)) return null;
    return 'women';
  }
  return null;
}

/**
 * The chart for a product, trimmed to the sizes it is offered in (falls back
 * to the full chart when none of its sizes are in the chart).
 */
export function sizeChartFor(params: {
  sizeSetKey?: string | null;
  topCategorySlug?: string | null;
  sizes?: string[];
}): SizeChart | null {
  const id = sizeChartIdFor(params);
  if (!id) return null;
  const chart = SIZE_CHARTS[id];
  const offered = new Set(params.sizes ?? []);
  const rows = chart.rows.filter((r) => offered.has(r.size));
  return rows.length > 0 ? { ...chart, rows } : chart;
}

const ADULT_LETTER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const KIDS_AGES = /^\d{1,2}Y$/;

/**
 * Size-set key for a product: its own set, else inferred from its sizes
 * (letter sizes -> adult, "2Y".."14Y" -> kids) so older products without a
 * set still get a chart.
 */
export function effectiveSizeSetKey(sizeSetKey: string | null | undefined, sizes: string[]): string | null {
  if (sizeSetKey) return sizeSetKey;
  if (sizes.length === 0) return null;
  if (sizes.every((s) => ADULT_LETTER.includes(s.toUpperCase()))) return 'adult-letter';
  if (sizes.every((s) => KIDS_AGES.test(s.toUpperCase()))) return 'kids-age';
  return null;
}
