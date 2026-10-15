import ProductCard from './ProductCard';
import type { CardProduct } from '@/lib/catalog/types';

/** Responsive product grid. The first `priorityCount` cards preload their image (above the fold). */
export function ProductGrid({ products, priorityCount = 0 }: { products: CardProduct[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, i) => (
        <li key={product.id}>
          <ProductCard product={product} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
