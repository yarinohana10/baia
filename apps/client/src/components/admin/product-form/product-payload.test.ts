import { describe, expect, it } from 'vitest';
import { initialProductForm, productFormReducer } from '@/hooks/admin/product-form';
import { productPayload, variantPayload } from './product-payload';
import { newVariant, withLoadedStock } from './stock-variants';
import { getStockSummary } from '../products/stock-summary';

const saved = { ...newVariant('top', 'Black', 'M'), id: 'v1', stockQuantity: 5 };

describe('stock edits sent with the quantity the form loaded', () => {
  it('sends expectedStockQuantity for saved variants only', () => {
    const loaded = withLoadedStock(saved);
    expect(variantPayload({ ...loaded, stockQuantity: 9 })).toMatchObject({ id: 'v1', stockQuantity: 9, expectedStockQuantity: 5 });
    expect(variantPayload(newVariant('top', 'Red', 'S'))).not.toHaveProperty('expectedStockQuantity');
  });

  it('remembers stock from the server product, not from later edits', () => {
    const form = initialProductForm({ variants: [saved] } as never);
    const edited = productFormReducer(form, { type: 'variants', variants: form.variants.map((v) => ({ ...v, stockQuantity: 50 })) });
    expect(productPayload(edited).variants[0]).toMatchObject({ stockQuantity: 50, expectedStockQuantity: 5 });
  });

  it('sends the Back Soon and visibility flags', () => {
    const form = { ...initialProductForm(), basePrice: '10', backSoon: true, isActive: false };
    expect(productPayload(form)).toMatchObject({ backSoon: true, isActive: false });
  });
});

describe('products list stock badge', () => {
  const variant = (stockQuantity: number) => ({ id: String(stockQuantity), isActive: true, stockQuantity });
  it('follows the configured low-stock threshold', () => {
    expect(getStockSummary([variant(8)]).status).toBe('in_stock');
    expect(getStockSummary([variant(8)], 10).status).toBe('low_stock');
    expect(getStockSummary([variant(0)], 10).status).toBe('out_of_stock');
  });
});
