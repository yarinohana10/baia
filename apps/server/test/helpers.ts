/**
 * Shared test helpers and mock factories.
 */

export function createMockPrismaService() {
  return {
    upload: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    productImage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    productVariant: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    order: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    orderItem: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    siteConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

export function createMockStorageService() {
  return {
    upload: jest.fn().mockResolvedValue('http://localhost:4566/baia-assets/test/file.jpg'),
    delete: jest.fn().mockResolvedValue(undefined),
    getUrl: jest.fn((key: string) => `http://localhost:4566/baia-assets/${key}`),
  };
}

export const MOCK_UPLOAD = {
  id: 'upload-1',
  s3Key: 'products/prod-1/abc.jpg',
  s3Bucket: 'baia-assets',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  fileName: 'test.jpg',
  uploadedBy: 'user-1',
  createdAt: new Date('2026-01-01'),
};

export const MOCK_PRODUCT = {
  id: 'prod-1',
  nameHe: 'מכנסי ים',
  nameEn: 'Swim Shorts',
  descriptionHe: null,
  descriptionEn: null,
  slug: 'swim-shorts',
  basePrice: { toNumber: () => 149.90 },
  categoryId: 'cat-1',
  isFeatured: false,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  category: { id: 'cat-1', nameHe: 'גברים', nameEn: 'Men', slug: 'men' },
  variants: [],
  images: [],
};

export const MOCK_CATEGORY = {
  id: 'cat-1',
  nameHe: 'גברים',
  nameEn: 'Men',
  slug: 'men',
  image: null,
  imageUploadId: null,
  imageUpload: null,
  sortOrder: 1,
  parentId: null,
  parent: null,
  children: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
