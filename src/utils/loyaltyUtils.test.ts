import { describe, it, expect } from 'vitest';
import {
  calculatePointsEarned,
  pointsToUSD,
  pointsToLBP,
  usdToPoints,
  calculateMaxRedeemablePoints,
  getLoyaltyTier,
} from './loyaltyUtils';

describe('Loyalty Points Utilities', () => {
  describe('calculatePointsEarned', () => {
    it('calculates points accurately with default 1 point per $1 spent', () => {
      expect(calculatePointsEarned(10)).toBe(10);
      expect(calculatePointsEarned(24.99)).toBe(24);
      expect(calculatePointsEarned(0)).toBe(0);
      expect(calculatePointsEarned(-5)).toBe(0);
    });

    it('calculates points with custom multiplier', () => {
      expect(calculatePointsEarned(10, 2)).toBe(20);
      expect(calculatePointsEarned(15.5, 3)).toBe(46);
    });
  });

  describe('pointsToUSD & pointsToLBP conversions', () => {
    it('converts points to USD according to admin exchange rule (e.g. 100 pts = $1)', () => {
      expect(pointsToUSD(100, 100, 1.0)).toBe(1.0);
      expect(pointsToUSD(50, 100, 1.0)).toBe(0.5);
      expect(pointsToUSD(250, 100, 1.0)).toBe(2.5);
    });

    it('supports custom admin redemption rates (e.g. 200 pts = $3.00)', () => {
      expect(pointsToUSD(200, 200, 3.0)).toBe(3.0);
      expect(pointsToUSD(100, 200, 3.0)).toBe(1.5);
    });

    it('converts points to LBP with exchange rate', () => {
      const exchangeRate = 89500;
      // 100 pts = $1.00 = 89,500 LBP
      expect(pointsToLBP(100, exchangeRate, 100, 1.0)).toBe(89500);
      // 50 pts = $0.50 = 44,750 LBP
      expect(pointsToLBP(50, exchangeRate, 100, 1.0)).toBe(44750);
    });
  });

  describe('usdToPoints', () => {
    it('calculates points needed for desired discount', () => {
      expect(usdToPoints(1.0, 100, 1.0)).toBe(100);
      expect(usdToPoints(0.5, 100, 1.0)).toBe(50);
      expect(usdToPoints(2.5, 100, 1.0)).toBe(250);
    });
  });

  describe('calculateMaxRedeemablePoints', () => {
    it('returns 0 if points are below minimum redemption threshold', () => {
      expect(calculateMaxRedeemablePoints(5, 50, 100, 1.0, 10)).toBe(0);
    });

    it('caps redemption at customer balance if cart total is higher', () => {
      // Customer has 80 points ($0.80), cart is $20.00
      expect(calculateMaxRedeemablePoints(80, 20.0, 100, 1.0, 10)).toBe(80);
    });

    it('caps redemption at cart total if customer has more points than cart value', () => {
      // Customer has 500 points ($5.00), cart is $2.00 (needs 200 points)
      expect(calculateMaxRedeemablePoints(500, 2.0, 100, 1.0, 10)).toBe(200);
    });
  });

  describe('getLoyaltyTier', () => {
    it('categorizes customers accurately into Bronze, Silver, Gold, Platinum', () => {
      expect(getLoyaltyTier(25).tier).toBe('Bronze');
      expect(getLoyaltyTier(150).tier).toBe('Silver');
      expect(getLoyaltyTier(320).tier).toBe('Gold');
      expect(getLoyaltyTier(750).tier).toBe('Platinum');
    });

    it('provides next tier progress', () => {
      const bronze = getLoyaltyTier(40);
      expect(bronze.nextTierName).toBe('Silver');
      expect(bronze.pointsToNextTier).toBe(60);
      expect(bronze.progressPercent).toBe(40);

      const plat = getLoyaltyTier(600);
      expect(plat.progressPercent).toBe(100);
      expect(plat.nextTierName).toBeUndefined();
    });
  });
});
