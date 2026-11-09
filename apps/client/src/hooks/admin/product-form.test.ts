import { describe, expect, it } from 'vitest';
import type { ProductCategory } from '@/components/admin/product-form/types';
import { newVariant } from '@/components/admin/product-form/stock-variants';
import { initialProductForm, productFormReducer, skuPrefixOf } from './product-form';
import { INITIAL_SUBMISSION, productSubmissionReducer } from './product-submission';

const categories: ProductCategory[] = [
  { id: 'women', nameHe: 'נשים', nameEn: 'Women', sizeSetId: 'letters', children: [{ id: 'bikini', nameHe: 'ביקיני', nameEn: 'Bikini' }] },
  { id: 'kids', nameHe: 'ילדים', nameEn: 'Kids', sizeSetId: 'ages', children: [] },
];

describe('productFormReducer', () => {
  it('has no editable web address: new products leave it to the server, saved ones keep theirs', () => {
    const created = productFormReducer(initialProductForm(), { type: 'nameEn', value: 'Sea Breeze Top' });
    expect(created.slug).toBe('');
    const saved = productFormReducer(initialProductForm({ slug: 'women-sea-breeze-top', nameEn: 'Sea Breeze Top' } as never), {
      type: 'nameEn',
      value: 'Renamed',
    });
    expect(saved.slug).toBe('women-sea-breeze-top');
  });

  it('builds generated SKUs from the English name (new) or the saved address', () => {
    let state = productFormReducer(initialProductForm(), { type: 'nameEn', value: 'Top' });
    const generated = newVariant(skuPrefixOf(state), 'Black', 'M');
    const manual = { ...newVariant('x', 'Red', 'S'), sku: 'CUSTOM', autoSku: false };
    state = productFormReducer(state, { type: 'variants', variants: [generated, manual] });
    state = productFormReducer(state, { type: 'nameEn', value: 'Wave Top' });
    expect(state.variants.map((v) => v.sku)).toEqual(['wave-top-black-m', 'CUSTOM']);
    expect(skuPrefixOf({ slug: 'women-wave-top', nameEn: 'Renamed' })).toBe('women-wave-top');
  });

  it('follows the category size set (children inherit) until one is picked', () => {
    let state = productFormReducer(initialProductForm(), { type: 'category', categoryId: 'bikini', categories });
    expect(state.sizeSetId).toBe('letters');
    state = productFormReducer(state, { type: 'sizeSet', sizeSetId: '' });
    state = productFormReducer(state, { type: 'category', categoryId: 'kids', categories });
    expect(state.sizeSetId).toBe('');
  });

  it('applies the category default once categories load', () => {
    const picked = productFormReducer(initialProductForm(), { type: 'category', categoryId: 'kids', categories: [] });
    expect(picked.sizeSetId).toBe('');
    expect(productFormReducer(picked, { type: 'categoriesLoaded', categories }).sizeSetId).toBe('ages');
  });

  it('never re-defaults the size set of a saved product', () => {
    const product = initialProductForm({
      id: 'p1',
      nameHe: 'א',
      nameEn: 'A',
      slug: 'a',
      basePrice: '120.00',
      categoryId: 'kids',
      sizeSetId: null,
      isFeatured: false,
      isActive: true,
      variants: [],
      images: [],
    });
    expect(product).toMatchObject({ basePrice: '120', sizeSetTouched: true });
    expect(productFormReducer(product, { type: 'categoriesLoaded', categories }).sizeSetId).toBe('');
  });
});

describe('productSubmissionReducer', () => {
  it('drops server errors on a new attempt and when their field is edited', () => {
    const failed = productSubmissionReducer(INITIAL_SUBMISSION, {
      type: 'failed',
      error: 'fix',
      serverErrors: { slug: 'taken', 'images.0.altTextEn': 'too long', other: 'x' },
    });
    const edited = productSubmissionReducer(failed, { type: 'fieldsEdited', fields: ['slug'] });
    expect(edited.serverErrors).toEqual({ 'images.0.altTextEn': 'too long', other: 'x' });
    expect(productSubmissionReducer(edited, { type: 'imagesChanged' }).serverErrors).toEqual({ other: 'x' });
    expect(productSubmissionReducer(edited, { type: 'attempt' })).toMatchObject({ submitted: true, serverErrors: {} });
  });

  it('tracks saving around a request', () => {
    const saving = productSubmissionReducer({ ...INITIAL_SUBMISSION, error: 'old' }, { type: 'start' });
    expect(saving).toMatchObject({ saving: true, error: '' });
    expect(productSubmissionReducer(saving, { type: 'settled' }).saving).toBe(false);
  });
});
