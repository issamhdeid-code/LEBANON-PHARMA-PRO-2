import { Product, SaleTransaction } from '../types/pharmacy';

export interface ProductStockForecast {
  product: Product;
  currentStock: number;
  minStockAlert: number;
  unitsSold30d: number;
  unitsSold90d: number;
  dailyVelocity: number; // units per day
  daysUntilStockout: number; // Infinity if velocity === 0
  stockoutDate: Date | null;
  urgency: 'critical' | 'warning' | 'attention' | 'healthy';
  suggestedReorderQty: number; // boxes to reorder
  estimatedOrderCostUSD: number;
  estimatedOrderCostLBP: number;
  supplierName: string;
}

export interface ForecastSummary {
  criticalCount: number; // 0-3 days or already 0
  warningCount: number; // 4-7 days
  attentionCount: number; // 8-14 days
  totalSuggestedUnits: number;
  totalEstimatedCostUSD: number;
  totalEstimatedCostLBP: number;
  items: ProductStockForecast[];
}

/**
 * Calculates stock depletion forecasting based on sales history across the last 30 & 90 days.
 * Weighted velocity: gives 70% weight to recent 30-day velocity and 30% to 90-day velocity.
 * Suggested reorder quantity aims to provide a 30-day safety stock buffer above minStockAlert.
 */
export function calculateStockForecast(
  products: Product[],
  sales: SaleTransaction[],
  exchangeRate: number,
  targetDaysBuffer: number = 30
): ForecastSummary {
  const now = Date.now();
  const msInDay = 86_400_000;
  const thirtyDaysAgo = now - 30 * msInDay;
  const ninetyDaysAgo = now - 90 * msInDay;

  // Pre-aggregate product sales to optimize performance across large transaction histories
  const salesMap = new Map<string, { sold30d: number; sold90d: number }>();

  for (const sale of sales) {
    if (sale.isUnreal) continue; // Exclude fictitious/unreal invoices
    const saleTime = sale.timestamp || new Date(sale.date).getTime();
    if (saleTime < ninetyDaysAgo) continue;

    const isWithin30d = saleTime >= thirtyDaysAgo;

    for (const item of sale.items) {
      if (!item.productId) continue;
      // If item was sold by piece, convert quantity to equivalent boxes for accurate box stock projection
      let qtyBoxes = item.quantity;
      if (item.isPiece) {
        // Pieces sold: convert to box fraction if piecesPerBox > 1
        const prod = products.find((p) => p.id === item.productId);
        const pieces = prod?.piecesPerBox && prod.piecesPerBox > 1 ? prod.piecesPerBox : 1;
        qtyBoxes = item.quantity / pieces;
      }

      const existing = salesMap.get(item.productId) || { sold30d: 0, sold90d: 0 };
      if (isWithin30d) {
        existing.sold30d += qtyBoxes;
      }
      existing.sold90d += qtyBoxes;
      salesMap.set(item.productId, existing);
    }
  }

  const forecastItems: ProductStockForecast[] = [];

  for (const product of products) {
    const usage = salesMap.get(product.id) || { sold30d: 0, sold90d: 0 };
    const v30 = usage.sold30d / 30; // Daily sales in last 30 days
    const v90 = usage.sold90d / 90; // Daily sales in last 90 days

    // Blended velocity: gives responsive weight to 30d with 90d baseline stability
    const dailyVelocity = usage.sold30d > 0 ? (v30 * 0.7 + v90 * 0.3) : v90;

    const currentStock = Math.max(0, product.stockQuantity || 0);
    const minAlert = Math.max(1, product.minStockAlert || 5);

    let daysUntilStockout = Infinity;
    let stockoutDate: Date | null = null;

    if (currentStock === 0) {
      daysUntilStockout = 0;
      stockoutDate = new Date(now);
    } else if (dailyVelocity > 0) {
      daysUntilStockout = Math.max(0, currentStock / dailyVelocity);
      stockoutDate = new Date(now + daysUntilStockout * msInDay);
    } else if (currentStock <= minAlert) {
      // No recent sales, but stock is already below minimum threshold
      daysUntilStockout = 14; // Default attention
      stockoutDate = new Date(now + 14 * msInDay);
    }

    // Determine urgency level
    let urgency: ProductStockForecast['urgency'] = 'healthy';
    if (currentStock === 0 || daysUntilStockout <= 3) {
      urgency = 'critical';
    } else if (daysUntilStockout <= 7 || currentStock <= minAlert) {
      urgency = 'warning';
    } else if (daysUntilStockout <= 14) {
      urgency = 'attention';
    }

    // Suggested order quantity calculation:
    // Ensure safety stock for targetDaysBuffer days, plus restore minStockAlert
    let suggestedReorderQty = 0;
    if (urgency !== 'healthy' || currentStock <= minAlert) {
      if (dailyVelocity > 0) {
        const neededUnits = (dailyVelocity * targetDaysBuffer) + minAlert - currentStock;
        suggestedReorderQty = Math.max(minAlert, Math.ceil(neededUnits));
      } else {
        // Fallback when no velocity history: restock up to twice minStockAlert
        suggestedReorderQty = Math.max(1, Math.ceil((minAlert * 2) - currentStock));
      }
    }

    // Cost calculations based on product costPriceUSD
    const unitCostUSD = product.costPriceUSD || 0;
    const unitCostLBP = Math.round(unitCostUSD * exchangeRate);

    const estimatedOrderCostUSD = Math.round(suggestedReorderQty * unitCostUSD * 100) / 100;
    const estimatedOrderCostLBP = Math.round(suggestedReorderQty * unitCostLBP);

    // Only include items that have forecast urgency or need reorder
    if (urgency !== 'healthy' || currentStock <= minAlert) {
      forecastItems.push({
        product,
        currentStock,
        minStockAlert: minAlert,
        unitsSold30d: Math.round(usage.sold30d * 10) / 10,
        unitsSold90d: Math.round(usage.sold90d * 10) / 10,
        dailyVelocity: Math.round(dailyVelocity * 100) / 100,
        daysUntilStockout: Math.round(daysUntilStockout * 10) / 10,
        stockoutDate,
        urgency,
        suggestedReorderQty,
        estimatedOrderCostUSD,
        estimatedOrderCostLBP,
        supplierName: product.agent || 'Direct / General',
      });
    }
  }

  // Sort: Critical first (fewest days left), then warning, then attention
  forecastItems.sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, attention: 2, healthy: 3 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return a.daysUntilStockout - b.daysUntilStockout;
  });

  const criticalCount = forecastItems.filter((i) => i.urgency === 'critical').length;
  const warningCount = forecastItems.filter((i) => i.urgency === 'warning').length;
  const attentionCount = forecastItems.filter((i) => i.urgency === 'attention').length;
  const totalSuggestedUnits = forecastItems.reduce((acc, i) => acc + i.suggestedReorderQty, 0);
  const totalEstimatedCostUSD = forecastItems.reduce((acc, i) => acc + i.estimatedOrderCostUSD, 0);
  const totalEstimatedCostLBP = forecastItems.reduce((acc, i) => acc + i.estimatedOrderCostLBP, 0);

  return {
    criticalCount,
    warningCount,
    attentionCount,
    totalSuggestedUnits,
    totalEstimatedCostUSD,
    totalEstimatedCostLBP,
    items: forecastItems,
  };
}
