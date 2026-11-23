export function formatPrice(price: number) {
  return Math.trunc(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
