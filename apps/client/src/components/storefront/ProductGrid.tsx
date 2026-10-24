import ProductCard from './ProductCard';
import type { CardProduct } from '@/lib/catalog/types';

/**
 * Responsive product grid. The first `priorityCount` cards preload their image (above the fold).
 * Cards sit edge to edge (1px seams) like the home page; on phones the grid bleeds past the page gutter.
 */
export function ProductGrid({ products, priorityCount = 0 }: { products: CardProduct[]; priorityCount?: number }) {
  return (
    <ul className="-mx-[4%] grid grid-cols-2 gap-x-px md:mx-0 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, i) => (
        <li key={product.id}>
          <ProductCard product={product} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
