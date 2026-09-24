/**
 * Lebanese Pharma Pro - Loyalty Point System Utility
 * Handles point earning calculations, money-to-points conversions,
 * tiered status indicators, and redemption logic.
 */

export interface LoyaltyTierInfo {
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  color: string;
  badgeBg: string;
  borderColor: string;
  nextTierName?: string;
  pointsToNextTier?: number;
  progressPercent: number;
}

export const DEFAULT_LOYALTY_SETTINGS = {
  enabled: true,
  pointsPerUSD: 1, // 1 point per $1 spent
  redeemRatePoints: 100, // 100 points
  redeemRateUSD: 1.0, // = $1.00 USD discount
  minPointsToRedeem: 10, // Must have at least 10 points to redeem
  maxRedemptionPercent: 100, // Can cover up to 100% of order
};

/**
 * Calculates points earned on spending.
 * Example: $25.50 spent at 1 point/$1 = 25 points.
 */
export function calculatePointsEarned(
  spendingUSD: number,
  pointsPerUSD: number = DEFAULT_LOYALTY_SETTINGS.pointsPerUSD
): number {
  if (!spendingUSD || spendingUSD <= 0) return 0;
  const rate = pointsPerUSD > 0 ? pointsPerUSD : 1;
  return Math.floor(spendingUSD * rate);
}

/**
 * Converts loyalty points into USD discount value according to admin exchange rule.
 * Example: 150 points at rate 100 pts = $1.00 -> $1.50 USD.
 */
export function pointsToUSD(
  points: number,
  ratePoints: number = DEFAULT_LOYALTY_SETTINGS.redeemRatePoints,
  rateUSD: number = DEFAULT_LOYALTY_SETTINGS.redeemRateUSD
): number {
  if (!points || points <= 0) return 0;
  const safeRatePoints = ratePoints > 0 ? ratePoints : 100;
  const safeRateUSD = rateUSD > 0 ? rateUSD : 1.0;
  const value = (points / safeRatePoints) * safeRateUSD;
  return Number(value.toFixed(2));
}

/**
 * Converts loyalty points into LBP value using the active pharmacy exchange rate.
 */
export function pointsToLBP(
  points: number,
  exchangeRate: number,
  ratePoints: number = DEFAULT_LOYALTY_SETTINGS.redeemRatePoints,
  rateUSD: number = DEFAULT_LOYALTY_SETTINGS.redeemRateUSD
): number {
  const usdVal = pointsToUSD(points, ratePoints, rateUSD);
  return Math.round(usdVal * (exchangeRate || 89500));
}

/**
 * Calculates the number of points required to achieve a desired USD discount.
 */
export function usdToPoints(
  usdAmount: number,
  ratePoints: number = DEFAULT_LOYALTY_SETTINGS.redeemRatePoints,
  rateUSD: number = DEFAULT_LOYALTY_SETTINGS.redeemRateUSD
): number {
  if (!usdAmount || usdAmount <= 0) return 0;
  const safeRatePoints = ratePoints > 0 ? ratePoints : 100;
  const safeRateUSD = rateUSD > 0 ? rateUSD : 1.0;
  return Math.ceil((usdAmount / safeRateUSD) * safeRatePoints);
}

/**
 * Computes maximum points that can be redeemed for a cart total.
 */
export function calculateMaxRedeemablePoints(
  customerPoints: number,
  cartTotalUSD: number,
  ratePoints: number = DEFAULT_LOYALTY_SETTINGS.redeemRatePoints,
  rateUSD: number = DEFAULT_LOYALTY_SETTINGS.redeemRateUSD,
  minPointsToRedeem: number = DEFAULT_LOYALTY_SETTINGS.minPointsToRedeem,
  maxRedemptionPercent: number = DEFAULT_LOYALTY_SETTINGS.maxRedemptionPercent
): number {
  if (!customerPoints || customerPoints < minPointsToRedeem || cartTotalUSD <= 0) {
    return 0;
  }
  const maxDiscountAllowedUSD = cartTotalUSD * (Math.min(100, Math.max(0, maxRedemptionPercent)) / 100);
  const pointsNeededForTotal = usdToPoints(maxDiscountAllowedUSD, ratePoints, rateUSD);
  return Math.max(0, Math.min(customerPoints, pointsNeededForTotal));
}

/**
 * Returns customer loyalty tier classification and progress towards next tier.
 */
export function getLoyaltyTier(points: number): LoyaltyTierInfo {
  const safePoints = Math.max(0, points || 0);

  if (safePoints >= 500) {
    return {
      tier: 'Platinum',
      color: 'text-purple-600 dark:text-purple-400',
      badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
      borderColor: 'border-purple-300 dark:border-purple-700',
      progressPercent: 100,
    };
  }

  if (safePoints >= 250) {
    const needed = 500 - safePoints;
    const progress = Math.min(100, Math.round(((safePoints - 250) / 250) * 100));
    return {
      tier: 'Gold',
      color: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      borderColor: 'border-amber-300 dark:border-amber-700',
      nextTierName: 'Platinum',
      pointsToNextTier: needed,
      progressPercent: progress,
    };
  }

  if (safePoints >= 100) {
    const needed = 250 - safePoints;
    const progress = Math.min(100, Math.round(((safePoints - 100) / 150) * 100));
    return {
      tier: 'Silver',
      color: 'text-slate-600 dark:text-slate-300',
      badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      borderColor: 'border-slate-300 dark:border-slate-600',
      nextTierName: 'Gold',
      pointsToNextTier: needed,
      progressPercent: progress,
    };
  }

  const needed = 100 - safePoints;
  const progress = Math.min(100, Math.round((safePoints / 100) * 100));
  return {
    tier: 'Bronze',
    color: 'text-orange-700 dark:text-orange-400',
    badgeBg: 'bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
    borderColor: 'border-orange-200 dark:border-orange-800',
    nextTierName: 'Silver',
    pointsToNextTier: needed,
    progressPercent: progress,
  };
}
