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
  it('derives the slug from the English name until the slug is edited', () => {
    let state = productFormReducer(initialProductForm(), { type: 'nameEn', value: 'Sea Breeze Top' });
    expect(state.slug).toBe('sea-breeze-top');
    state = productFormReducer(state, { type: 'slug', value: 'breeze' });
    state = productFormReducer(state, { type: 'nameEn', value: 'Other' });
    expect(state.slug).toBe('breeze');
  });

  it('keeps generated SKUs in step with the slug', () => {
    let state = productFormReducer(initialProductForm(), { type: 'nameEn', value: 'Top' });
    const generated = newVariant(skuPrefixOf(state), 'Black', 'M');
    const manual = { ...newVariant('x', 'Red', 'S'), sku: 'CUSTOM', autoSku: false };
    state = productFormReducer(state, { type: 'variants', variants: [generated, manual] });
    state = productFormReducer(state, { type: 'slug', value: 'wave-top' });
    expect(state.variants.map((v) => v.sku)).toEqual(['wave-top-black-m', 'CUSTOM']);
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
    expect(product).toMatchObject({ basePrice: '120', sizeSetTouched: true, autoSlug: false });
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
