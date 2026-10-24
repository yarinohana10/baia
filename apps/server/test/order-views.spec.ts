import { withItemImages } from '../src/orders/order-views';

const images = [
  { url: 'https://cdn.test/products/p/navy.jpg', color: 'Navy' },
  { url: 'https://cdn.test/products/p/any.jpg', color: null },
];

describe('withItemImages (order history photos)', () => {
  it("shows the photo of the ordered colour and drops the variant's photo list", () => {
    const order = withItemImages({ id: 'o1', items: [{ id: 'i1', color: 'navy', variant: { product: { images } } }] });
    expect(order.items[0]).toEqual({ id: 'i1', color: 'navy', imageUrl: 'https://cdn.test/products/p/navy.jpg' });
  });

  it('falls back to a photo without a colour, then to none', () => {
    const order = withItemImages({
      items: [
        { color: 'Red', variant: { product: { images } } },
        { color: 'Red', variant: { product: { images: [] } } },
        { color: 'Red', variant: null },
      ],
    });
    expect(order.items.map((i) => i.imageUrl)).toEqual(['https://cdn.test/products/p/any.jpg', null, null]);
  });
});
