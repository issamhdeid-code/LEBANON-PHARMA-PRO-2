import { Product, PurchaseInvoice, ProductBatch } from '../types/pharmacy';

export const formatStockDisplay = (stockQuantity: number, isDivisible?: boolean, piecesPerBox?: number, pieceName?: string): string => {
  if (!isDivisible || !piecesPerBox || piecesPerBox <= 1) {
    return Number.isInteger(stockQuantity) ? stockQuantity.toString() : stockQuantity.toFixed(2);
  }

  const totalPieces = Math.round(stockQuantity * piecesPerBox);
  const boxes = Math.floor(totalPieces / piecesPerBox);
  const pieces = totalPieces % piecesPerBox;

  const pieceLabel = pieceName || 'Piece';
  const pieceLabelPlural = pieces > 1 || pieces === 0 ? 's' : '';
  const boxLabel = `Box${boxes > 1 || boxes === 0 ? 'es' : ''}`;

  if (boxes === 0 && pieces > 0) return `${pieces} ${pieceLabel}${pieceLabelPlural}`;
  if (pieces === 0) return `${boxes} ${boxLabel}`;
  return `${boxes} ${boxLabel} + ${pieces} ${pieceLabel}${pieceLabelPlural}`;
};

/**
 * Standardized expiry date parser.
 * Accurately parses MM-YYYY, MM/YYYY, YYYY-MM-DD, YYYY-MM, MMYY, MMYYYY, and standard ISO dates.
 */
export const parseExpiryDate = (
  dateStr?: string
): { date: Date | null; displayMMYYYY: string; raw: string; timestamp: number } => {
  if (!dateStr || !dateStr.trim()) {
    return { date: null, displayMMYYYY: 'N/A', raw: '', timestamp: 0 };
  }
  const str = dateStr.trim();

  // MM-YYYY or MM/YYYY
  if (/^\d{1,2}[-/]\d{4}$/.test(str)) {
    const parts = str.split(/[-/]/);
    const m = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    const d = new Date(y, m - 1, 1);
    const mm = m < 10 ? `0${m}` : `${m}`;
    return { date: d, displayMMYYYY: `${mm}-${y}`, raw: str, timestamp: d.getTime() };
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = new Date(y, m - 1, parseInt(parts[2], 10));
    const mm = m < 10 ? `0${m}` : `${m}`;
    return { date: d, displayMMYYYY: `${mm}-${y}`, raw: str, timestamp: d.getTime() };
  }

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = new Date(y, m - 1, 1);
    const mm = m < 10 ? `0${m}` : `${m}`;
    return { date: d, displayMMYYYY: `${mm}-${y}`, raw: str, timestamp: d.getTime() };
  }

  // 4 digits: MMYY e.g. "0526"
  if (/^\d{4}$/.test(str)) {
    const m = parseInt(str.slice(0, 2), 10);
    const y = 2000 + parseInt(str.slice(2, 4), 10);
    if (m >= 1 && m <= 12) {
      const d = new Date(y, m - 1, 1);
      const mm = m < 10 ? `0${m}` : `${m}`;
      return { date: d, displayMMYYYY: `${mm}-${y}`, raw: str, timestamp: d.getTime() };
    }
  }

  // 6 digits: MMYYYY e.g. "052026"
  if (/^\d{6}$/.test(str)) {
    const m = parseInt(str.slice(0, 2), 10);
    const y = parseInt(str.slice(2, 6), 10);
    if (m >= 1 && m <= 12) {
      const d = new Date(y, m - 1, 1);
      const mm = m < 10 ? `0${m}` : `${m}`;
      return { date: d, displayMMYYYY: `${mm}-${y}`, raw: str, timestamp: d.getTime() };
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const mm = d.getMonth() + 1 < 10 ? `0${d.getMonth() + 1}` : `${d.getMonth() + 1}`;
    return { date: d, displayMMYYYY: `${mm}-${d.getFullYear()}`, raw: str, timestamp: d.getTime() };
  }

  return { date: null, displayMMYYYY: str || 'N/A', raw: str, timestamp: 0 };
};

export interface ResolvedBatchSource {
  invoiceNumber?: string;
  supplierName?: string;
  date?: string;
  quantity: number;
  isPiece?: boolean;
}

export interface ResolvedBatch {
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  totalPurchased: number;
  isDepleted: boolean;
  purchaseSources: ResolvedBatchSource[];
}

/**
 * Resolves all batches and expiries for a product by combining:
 * 1. Historical purchase invoice line items for this product
 * 2. Any explicit product.batches currently tracked
 * 3. Fallback to product.expiryDate / product.batchNumber
 * 
 * Accurately tracks all expiries even when the item was purchased multiple times
 * with different expiry dates, calculating live remaining quantities via FIFO.
 */
export const resolveProductBatches = (
  product: Product,
  purchases: PurchaseInvoice[] = []
): ResolvedBatch[] => {
  // 1. Gather all line items for this product across all purchase invoices
  const relevantPurchases: {
    invoiceNumber?: string;
    supplierName?: string;
    date?: string;
    itemBatch: string;
    itemExpiry: string;
    quantity: number;
    isPiece?: boolean;
    timestamp: number;
  }[] = [];

  for (const p of purchases) {
    if (!p.items || !Array.isArray(p.items)) continue;
    for (const item of p.items) {
      if (item.productId === product.id || (product.code && item.productCode === product.code)) {
        const qtyInBoxes = item.isPiece && product.piecesPerBox && product.piecesPerBox > 0
          ? item.quantity / product.piecesPerBox
          : item.quantity;

        let invTimestamp = 0;
        if (p.date) {
          const t = new Date(p.date).getTime();
          if (!isNaN(t)) invTimestamp = t;
        }

        relevantPurchases.push({
          invoiceNumber: p.invoiceNumber || p.id,
          supplierName: p.supplierName,
          date: p.date,
          itemBatch: (item.batchNumber || '').trim(),
          itemExpiry: (item.expiryDate || '').trim(),
          quantity: qtyInBoxes,
          isPiece: item.isPiece,
          timestamp: invTimestamp,
        });
      }
    }
  }

  // 2. Build a map of batches grouped by batchNumber + normalized expiry
  const batchMap = new Map<string, ResolvedBatch>();

  // If the product already has explicit batches in product.batches, seed them
  if (product.batches && Array.isArray(product.batches) && product.batches.length > 0) {
    for (const b of product.batches) {
      const bNum = (b.batchNumber || '').trim();
      const bExp = (b.expiryDate || '').trim();
      const normExp = parseExpiryDate(bExp).displayMMYYYY;
      const key = `${bNum.toLowerCase()}____${normExp}`;
      batchMap.set(key, {
        batchNumber: bNum || 'N/A',
        expiryDate: bExp,
        quantity: b.quantity !== undefined ? b.quantity : 0,
        totalPurchased: b.quantity !== undefined ? b.quantity : 0,
        isDepleted: b.quantity !== undefined ? b.quantity <= 0 : false,
        purchaseSources: [],
      });
    }
  }

  // Add/merge all purchased items
  for (const pur of relevantPurchases) {
    const bNum = pur.itemBatch;
    const bExp = pur.itemExpiry;
    const normExp = parseExpiryDate(bExp).displayMMYYYY;
    const key = `${bNum.toLowerCase()}____${normExp}`;

    let existing = batchMap.get(key);
    if (!existing) {
      existing = {
        batchNumber: bNum || 'N/A',
        expiryDate: bExp,
        quantity: 0,
        totalPurchased: 0,
        isDepleted: false,
        purchaseSources: [],
      };
      batchMap.set(key, existing);
    }

    existing.totalPurchased += pur.quantity;
    existing.purchaseSources.push({
      invoiceNumber: pur.invoiceNumber,
      supplierName: pur.supplierName,
      date: pur.date,
      quantity: pur.quantity,
      isPiece: pur.isPiece,
    });
  }

  // If no batches from either purchases or product.batches, use product legacy fields
  if (batchMap.size === 0) {
    if (product.expiryDate || product.batchNumber || product.stockQuantity > 0) {
      return [{
        batchNumber: product.batchNumber || 'N/A',
        expiryDate: product.expiryDate || '',
        quantity: Math.max(0, product.stockQuantity),
        totalPurchased: Math.max(0, product.stockQuantity),
        isDepleted: product.stockQuantity <= 0,
        purchaseSources: [],
      }];
    }
    return [];
  }

  const allBatches = Array.from(batchMap.values());

  // Sort batches by expiry date ascending (earliest expiry first, FIFO)
  allBatches.sort((a, b) => {
    const timeA = parseExpiryDate(a.expiryDate).timestamp;
    const timeB = parseExpiryDate(b.expiryDate).timestamp;
    if (timeA === 0 && timeB === 0) return 0;
    if (timeA === 0) return 1;
    if (timeB === 0) return -1;
    return timeA - timeB;
  });

  // Calculate live quantities using FIFO/FEFO based on product.stockQuantity
  const currentStock = Math.max(0, product.stockQuantity);

  if (currentStock === 0) {
    for (const b of allBatches) {
      b.quantity = 0;
      b.isDepleted = true;
    }
    return allBatches;
  }

  // Check if product.batches already has explicit user-configured batches that exactly sum to currentStock
  // and covers all active inventory without missing newly purchased batches
  const explicitSum = product.batches && product.batches.length > 0
    ? product.batches.reduce((acc, b) => acc + (b.quantity || 0), 0)
    : -1;

  const hasUnaccountedPurchases = relevantPurchases.some((p) => {
    const normExp = parseExpiryDate(p.itemExpiry).displayMMYYYY;
    const key = `${p.itemBatch.toLowerCase()}____${normExp}`;
    return !product.batches?.some((b) => {
      const bNormExp = parseExpiryDate(b.expiryDate).displayMMYYYY;
      return `${(b.batchNumber || '').toLowerCase()}____${bNormExp}` === key;
    });
  });

  if (explicitSum === currentStock && !hasUnaccountedPurchases && product.batches && product.batches.length > 0) {
    for (const b of allBatches) {
      b.isDepleted = (b.quantity || 0) <= 0;
    }
    return allBatches;
  }

  // Otherwise, allocate current live stock across batches using FEFO (earliest expiry first)
  const totalInflow = allBatches.reduce(
    (acc, b) => acc + Math.max(b.totalPurchased || 0, b.quantity || 0),
    0
  );

  if (totalInflow === 0) {
    // If no prior capacity recorded, allocate all current stock to earliest batch
    allBatches[0].quantity = currentStock;
    for (let i = 1; i < allBatches.length; i++) {
      allBatches[i].quantity = 0;
    }
  } else if (currentStock >= totalInflow) {
    // All known batches are fully in stock at capacity
    for (const b of allBatches) {
      b.quantity = Math.max(b.totalPurchased || 0, b.quantity || 0);
    }
    const excess = currentStock - totalInflow;
    if (excess > 0 && allBatches.length > 0) {
      // Add excess inventory (e.g. unrecorded initial stock) to the latest expiring batch
      allBatches[allBatches.length - 1].quantity += excess;
    }
  } else {
    // Sales occurred: deplete earliest expiring batches first (FEFO/FIFO)
    let soldRemaining = totalInflow - currentStock;
    for (const b of allBatches) {
      const capacity = Math.max(b.totalPurchased || 0, b.quantity || 0);
      if (soldRemaining <= 0) {
        b.quantity = capacity;
      } else if (soldRemaining >= capacity) {
        b.quantity = 0;
        soldRemaining -= capacity;
      } else {
        b.quantity = capacity - soldRemaining;
        soldRemaining = 0;
      }
    }
  }

  for (const b of allBatches) {
    b.isDepleted = (b.quantity || 0) <= 0;
  }

  return allBatches;
};

/**
 * Generates a valid 13-digit EAN-13 barcode in the 20-29 internal retail/pharmacy namespace
 * with proper EAN-13 checksum calculation.
 */
export const generateRandomBarcode = (): string => {
  const randomDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  const base12 = `200${randomDigits}`;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base12}${checkDigit}`;
};
