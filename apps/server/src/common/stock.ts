/** Stock rules shared by cart, checkout and admin reporting. */
export type StockFields = { stockQuantity: number; trackInventory: boolean };

/** Units a customer can buy right now; Infinity for unlimited-stock variants. */
export function availableStock(v: StockFields): number {
  return v.trackInventory ? Math.max(0, v.stockQuantity) : Number.POSITIVE_INFINITY;
}

export function hasStock(v: StockFields, quantity: number): boolean {
  return availableStock(v) >= quantity;
}
