import { isPriceDrop } from './filters';

/** Describe a price drop: "↓ 8% (was R18,500) · 3 Oct". Returns null when none. */
export function describePriceDrop(item) {
  if (!isPriceDrop(item)) return null;
  const pct = Math.round(((item.previous_price - item.price) / item.previous_price) * 100);
  const when = item.price_changed_at
    ? new Date(item.price_changed_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
    : null;
  return {
    pct,
    previous: item.previous_price,
    when,
    short: `↓ ${pct}%${when ? ` · ${when}` : ''}`,
    long: `Dropped ${pct}% from R${item.previous_price.toLocaleString('en-ZA')}${when ? ` on ${when}` : ''}`,
  };
}
