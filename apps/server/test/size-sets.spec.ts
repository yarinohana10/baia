import { ADULT_LETTER_SIZE_SET, compareSizes } from '../src/products/size-sets';

describe('built-in size sets', () => {
  it('offers adult sizes from XS up to 5XL, in order', () => {
    expect(ADULT_LETTER_SIZE_SET.sizes).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']);
    expect(ADULT_LETTER_SIZE_SET.nameEn).toBe('Adult (XS–5XL)');
  });

  it('sorts the larger sizes after XXL', () => {
    const order = ADULT_LETTER_SIZE_SET.sizes;
    expect(['5XL', 'M', '3XL', 'XXL', '4XL'].sort((a, b) => compareSizes(a, b, order))).toEqual(['M', 'XXL', '3XL', '4XL', '5XL']);
  });
});
