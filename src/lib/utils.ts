// ============================================
// InvestSovet — Shared Utilities
// ============================================

/** Format price with appropriate decimal places based on magnitude */
export function formatPrice(price: number): string {
  if (price < 0.001) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Round a number to 2 decimal places (avoids floating-point drift) */
export function roundBalance(n: number): number {
  return Math.round(n * 100) / 100;
}
