import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ProductCard from '../ProductCard';

const meta: Meta<typeof ProductCard> = {
  title: 'Storefront/ProductCard',
  component: ProductCard,
  tags: ['autodocs'],
  parameters: {
    nextjs: { appDirectory: true },
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProductCard>;

const baseProduct = {
  id: 'prod-1',
  nameHe: 'מכנסי ים קלאסיים',
  nameEn: 'Classic Swim Shorts',
  slug: 'classic-swim-shorts',
  basePrice: '149.90',
  images: [{ url: '/products/men/shorts-black.jpg', color: 'Black' }],
  variants: [],
};

export const Default: Story = {
  args: {
    product: baseProduct,
  },
};

export const WithSalePrice: Story = {
  args: {
    product: {
      ...baseProduct,
      nameEn: 'Summer Bikini',
      nameHe: 'ביקיני קיץ',
      slug: 'summer-bikini',
      basePrice: '199.90',
      variants: [
        {
          id: 'var-1',
          salePrice: '139.90',
          saleStart: '2025-01-01',
          saleEnd: '2030-12-31',
          priceOverride: null,
        },
      ],
    },
  },
};

export const NoImage: Story = {
  args: {
    product: {
      ...baseProduct,
      nameEn: 'Mystery Product',
      nameHe: 'מוצר מסתורי',
      images: [],
    },
  },
};

export const LongName: Story = {
  args: {
    product: {
      ...baseProduct,
      nameEn: 'Premium Ultra-Lightweight Quick-Dry Beach Swimming Shorts Collection',
      nameHe: 'קולקציית מכנסי ים מהירי ייבוש קלי משקל פרימיום',
    },
  },
};

export const Grid: Story = {
  name: 'Product Grid (4 cards)',
  decorators: [
    (Story) => (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <ProductCard product={baseProduct} />
      <ProductCard
        product={{
          ...baseProduct,
          id: 'prod-2',
          nameEn: 'Ocean Bikini',
          nameHe: 'ביקיני אושן',
          slug: 'ocean-bikini',
          basePrice: '199.90',
          variants: [{ id: 'v', salePrice: '149.90', saleStart: '2025-01-01', saleEnd: '2030-12-31', priceOverride: null }],
        }}
      />
      <ProductCard
        product={{
          ...baseProduct,
          id: 'prod-3',
          nameEn: 'Kids Rash Guard',
          nameHe: 'חולצת גלישה ילדים',
          slug: 'kids-rash-guard',
          basePrice: '89.90',
        }}
      />
      <ProductCard
        product={{
          ...baseProduct,
          id: 'prod-4',
          nameEn: 'Board Shorts',
          nameHe: 'מכנסי סרף',
          slug: 'board-shorts',
          basePrice: '179.90',
          images: [],
        }}
      />
    </>
  ),
};
