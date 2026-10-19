import ProductCard from '@/components/storefront/ProductCard';
import type { CardProduct } from '@/lib/catalog/types';

/** "You may also like" row: swipeable on phones, four across on desktop. */
export function RelatedProducts({ title, products }: { title: string; products: CardProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="related-title" className="mt-16 border-t border-gray-100 pt-12 md:mt-24">
      <h2 id="related-title" className="mb-6 text-xl font-semibold text-charcoal md:text-2xl">
        {title}
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:thin] md:mx-0 md:gap-6 md:px-0">
        {products.map((p) => (
          <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc(25%-1.125rem)]">
            <ProductCard product={p} sizes="(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 25vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}
