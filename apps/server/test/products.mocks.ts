import { createMockPrismaService } from './helpers';

/**
 * Prisma mock with everything the products module touches, including
 * interactive and batch `$transaction` (the callback receives the same mock,
 * so assertions on `prisma.x.y` also cover writes made inside a transaction).
 */
export function createProductsPrismaMock() {
  const base = createMockPrismaService();
  const mock = {
    ...base,
    product: { ...base.product },
    productImage: {
      ...base.productImage,
      update: jest.fn(),
      findMany: jest.fn(),
    },
    productVariant: {
      ...base.productVariant,
      findMany: jest.fn().mockResolvedValue([]),
    },
    sizeSet: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: typeof mock) => unknown)(mock);
    return Promise.all(arg as Promise<unknown>[]);
  });
  return mock;
}

export type ProductsPrismaMock = ReturnType<typeof createProductsPrismaMock>;

export const fakeFile = (name = 'photo.jpg', mimetype = 'image/jpeg') => ({
  buffer: Buffer.from(`data-${name}`),
  originalname: name,
  mimetype,
  size: 10,
});
