import { Product } from '../types/pharmacy';

export interface PriceChangeIndicatorData {
  hasChange: boolean;
  direction: 'up' | 'down';
  percent: number;
  percentFormatted: string;
  isSkippedDecrease?: boolean;
  importedPrice?: number;
}

export function formatPriceChangePercent(pct: number): string {
  if (isNaN(pct) || !isFinite(pct)) return '0';
  const rounded = Number(pct.toFixed(1));
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

export function formatLBPValue(amount: number): string {
  return Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function getPriceChangeInfoUSD(prod: Product): PriceChangeIndicatorData | null {
  // Case 1: Skipped decreased price from CSV import
  // If price in CSV was lower than existing price, the update to the lower price was skipped,
  // but we display the small red arrow down and percentage change.
  if (
    prod.skippedDecreasedPriceUSD !== undefined &&
    prod.skippedDecreasedPriceUSD < prod.priceUSD &&
    prod.priceUSD > 0
  ) {
    const diff = prod.priceUSD - prod.skippedDecreasedPriceUSD;
    const pct = (diff / prod.priceUSD) * 100;
    return {
      hasChange: true,
      direction: 'down',
      percent: pct,
      percentFormatted: formatPriceChangePercent(pct),
      isSkippedDecrease: true,
      importedPrice: prod.skippedDecreasedPriceUSD,
    };
  }

  // Case 2: Normal price change (e.g. price increase from CSV, or manual price update)
  if (prod.previousPriceUSD !== undefined && prod.priceUSD !== prod.previousPriceUSD) {
    const isUp = prod.priceUSD > prod.previousPriceUSD;
    const base = prod.previousPriceUSD > 0 ? prod.previousPriceUSD : prod.priceUSD;
    const pct = base > 0 ? Math.abs(((prod.priceUSD - prod.previousPriceUSD) / base) * 100) : 100;
    return {
      hasChange: true,
      direction: isUp ? 'up' : 'down',
      percent: pct,
      percentFormatted: formatPriceChangePercent(pct),
    };
  }

  return null;
}

export function getPriceChangeInfoLBP(prod: Product): PriceChangeIndicatorData | null {
  // Case 1: Skipped decreased price from CSV import
  if (
    prod.skippedDecreasedPriceLBP !== undefined &&
    prod.skippedDecreasedPriceLBP < prod.priceLBP &&
    prod.priceLBP > 0
  ) {
    const diff = prod.priceLBP - prod.skippedDecreasedPriceLBP;
    const pct = (diff / prod.priceLBP) * 100;
    return {
      hasChange: true,
      direction: 'down',
      percent: pct,
      percentFormatted: formatPriceChangePercent(pct),
      isSkippedDecrease: true,
      importedPrice: prod.skippedDecreasedPriceLBP,
    };
  }

  // Case 2: Normal price change
  if (prod.previousPriceLBP !== undefined && prod.priceLBP !== prod.previousPriceLBP) {
    const isUp = prod.priceLBP > prod.previousPriceLBP;
    const base = prod.previousPriceLBP > 0 ? prod.previousPriceLBP : prod.priceLBP;
    const pct = base > 0 ? Math.abs(((prod.priceLBP - prod.previousPriceLBP) / base) * 100) : 100;
    return {
      hasChange: true,
      direction: isUp ? 'up' : 'down',
      percent: pct,
      percentFormatted: formatPriceChangePercent(pct),
    };
  }

  return null;
}
