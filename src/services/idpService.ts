import { Product, Supplier, PurchaseItem } from '../types/pharmacy';
import { isProductExpired } from '../components/purchase/PurchaseView';

export interface ExtractedInvoiceItem {
  productName: string;
  barcode?: string | null;
  itemCode?: string | null;
  quantity: number;
  freeQty?: number;
  batchNumber: string;
  expiryDate: string; // Raw or standard format e.g. "08/2027", "2027-08-31"
  unitCost: number;
  sellingPrice?: number | null;
  discount?: number;
  isPiece?: boolean;
}

export interface ExtractedInvoiceData {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string; // YYYY-MM-DD
  currency?: 'USD' | 'LBP';
  exchangeRate?: number | null;
  invoiceDiscountPercent?: number;
  totalAmount?: number;
  items: ExtractedInvoiceItem[];
}

export interface MatchedInvoiceItem extends ExtractedInvoiceItem {
  id: string;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedProductCode?: string;
  matchType: 'exact' | 'fuzzy' | 'none';
  calculatedUnitCostUSD: number;
  calculatedUnitCostLBP: number;
  calculatedSellingPriceUSD: number;
  calculatedSellingPriceLBP: number;
  normalizedExpiryISO: string;
  displayExpiry: string;
  isExpired: boolean;
}

export interface ProcessedInvoiceResult {
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: 'USD' | 'LBP';
  invoiceDiscount: number;
  items: MatchedInvoiceItem[];
  rawExtracted: ExtractedInvoiceData;
}

/**
 * Normalizes an arbitrary date string (from OCR/IDP) into both:
 * - standard display "MM/YYYY"
 * - ISO string "YYYY-MM-DD"
 */
export function normalizeExtractedExpiry(rawExpiry?: string): { displayExpiry: string; isoExpiry: string } {
  if (!rawExpiry || !rawExpiry.trim()) {
    return { displayExpiry: '', isoExpiry: '' };
  }

  const clean = rawExpiry.trim().replace(/[.\s]/g, '/').replace(/-+/g, '-');

  // Case 1: YYYY-MM-DD or YYYY-MM
  if (/^\d{4}-\d{1,2}(-\d{1,2})?$/.test(clean)) {
    const parts = clean.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parts[2] ? parseInt(parts[2], 10) : new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return {
      displayExpiry: `${mm}/${year}`,
      isoExpiry: `${year}-${mm}-${dd}`,
    };
  }

  // Case 2: MM/YYYY or MM/YY or DD/MM/YYYY
  if (clean.includes('/')) {
    const parts = clean.split('/').filter(Boolean);
    if (parts.length === 2) {
      let month = parseInt(parts[0], 10);
      let year = parseInt(parts[1], 10);
      if (year < 100) year += 2000; // e.g. 27 -> 2027
      if (month >= 1 && month <= 12 && year >= 2000 && year <= 2099) {
        const lastDay = new Date(year, month, 0).getDate();
        const mm = String(month).padStart(2, '0');
        const dd = String(lastDay).padStart(2, '0');
        return {
          displayExpiry: `${mm}/${year}`,
          isoExpiry: `${year}-${mm}-${dd}`,
        };
      }
    } else if (parts.length === 3) {
      // Could be DD/MM/YYYY or MM/DD/YYYY
      let p1 = parseInt(parts[0], 10);
      let p2 = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      let month = p2;
      let day = p1;
      // If p1 > 12, definitely DD/MM/YYYY
      if (p1 > 12) {
        day = p1;
        month = p2;
      }
      if (month >= 1 && month <= 12 && year >= 2000 && year <= 2099) {
        const mm = String(month).padStart(2, '0');
        const dd = String(day || new Date(year, month, 0).getDate()).padStart(2, '0');
        return {
          displayExpiry: `${mm}/${year}`,
          isoExpiry: `${year}-${mm}-${dd}`,
        };
      }
    }
  }

  // Case 3: 4 or 6 digit number e.g. "0827" or "082027"
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 4) {
    const month = parseInt(digits.slice(0, 2), 10);
    const year = 2000 + parseInt(digits.slice(2, 4), 10);
    if (month >= 1 && month <= 12) {
      const lastDay = new Date(year, month, 0).getDate();
      const mm = String(month).padStart(2, '0');
      const dd = String(lastDay).padStart(2, '0');
      return {
        displayExpiry: `${mm}/${year}`,
        isoExpiry: `${year}-${mm}-${dd}`,
      };
    }
  } else if (digits.length === 6) {
    const month = parseInt(digits.slice(0, 2), 10);
    const year = parseInt(digits.slice(2, 6), 10);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2099) {
      const lastDay = new Date(year, month, 0).getDate();
      const mm = String(month).padStart(2, '0');
      const dd = String(lastDay).padStart(2, '0');
      return {
        displayExpiry: `${mm}/${year}`,
        isoExpiry: `${year}-${mm}-${dd}`,
      };
    }
  }

  return { displayExpiry: clean, isoExpiry: '' };
}

/**
 * Normalizes string for fuzzy comparison
 */
function cleanStringForSearch(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\d\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches an extracted supplier name against the pharmacy's existing supplier catalog
 */
export function matchSupplier(
  extractedSupplierName: string | undefined,
  suppliers: Supplier[]
): Supplier | null {
  if (!extractedSupplierName || !extractedSupplierName.trim() || suppliers.length === 0) {
    return null;
  }

  const cleanExtracted = cleanStringForSearch(extractedSupplierName);
  if (!cleanExtracted) return null;

  // 1. Exact match on clean name or code
  for (const s of suppliers) {
    const sNameClean = cleanStringForSearch(s.name);
    const sCodeClean = cleanStringForSearch(s.code);
    if (sNameClean === cleanExtracted || sCodeClean === cleanExtracted) {
      return s;
    }
  }

  // 2. Substring match (e.g. "Mersaco S.A.L." vs "Mersaco")
  for (const s of suppliers) {
    const sNameClean = cleanStringForSearch(s.name);
    if (sNameClean.length >= 3 && (cleanExtracted.includes(sNameClean) || sNameClean.includes(cleanExtracted))) {
      return s;
    }
  }

  // 3. Token-based word match
  const extractedWords = cleanExtracted.split(' ').filter(w => w.length > 2);
  let bestSupplier: Supplier | null = null;
  let maxMatchedWords = 0;

  for (const s of suppliers) {
    const sWords = cleanStringForSearch(s.name).split(' ').filter(w => w.length > 2);
    const matchedCount = extractedWords.filter(w => sWords.includes(w)).length;
    if (matchedCount > maxMatchedWords && matchedCount >= 1) {
      maxMatchedWords = matchedCount;
      bestSupplier = s;
    }
  }

  return bestSupplier;
}

/**
 * Matches an extracted invoice item against the pharmacy's product catalog
 */
export function matchProduct(
  item: ExtractedInvoiceItem,
  products: Product[]
): { product: Product | null; matchType: 'exact' | 'fuzzy' | 'none' } {
  if (products.length === 0) {
    return { product: null, matchType: 'none' };
  }

  // 1. Match by Barcode if provided
  if (item.barcode && item.barcode.trim().length >= 4) {
    const cleanBarcode = item.barcode.trim();
    const barcodeMatch = products.find(p => p.barcode === cleanBarcode || p.pieceBarcode === cleanBarcode);
    if (barcodeMatch) {
      return { product: barcodeMatch, matchType: 'exact' };
    }
  }

  // 2. Match by Item Code if provided
  if (item.itemCode && item.itemCode.trim().length >= 2) {
    const cleanCode = item.itemCode.trim().toLowerCase();
    const codeMatch = products.find(p => p.code && p.code.toLowerCase() === cleanCode);
    if (codeMatch) {
      return { product: codeMatch, matchType: 'exact' };
    }
  }

  // 3. Match by Product Name
  const cleanExtractedName = cleanStringForSearch(item.productName);
  if (!cleanExtractedName) {
    return { product: null, matchType: 'none' };
  }

  // 3a. Exact name match
  const exactNameMatch = products.find(p => cleanStringForSearch(p.name) === cleanExtractedName);
  if (exactNameMatch) {
    return { product: exactNameMatch, matchType: 'exact' };
  }

  // 3b. Token-based fuzzy matching
  const extractedTokens = cleanExtractedName.split(' ').filter(t => t.length > 1);
  if (extractedTokens.length === 0) {
    return { product: null, matchType: 'none' };
  }

  // Identify primary brand token (usually the first token, e.g. "augmentin", "panadol", "lipitor")
  const primaryBrand = extractedTokens[0];

  let bestProduct: Product | null = null;
  let bestScore = 0;

  for (const p of products) {
    const pNameTokens = cleanStringForSearch(p.name).split(' ').filter(t => t.length > 1);
    if (pNameTokens.length === 0) continue;

    // Check if primary brand matches
    const hasBrandMatch = pNameTokens.some(t => t === primaryBrand || (primaryBrand.length > 4 && t.startsWith(primaryBrand.slice(0, 4))));
    if (!hasBrandMatch) continue;

    let score = 2; // Brand match bonus

    // Count matching tokens (e.g. dosage "1g", "500", "tab", "inj")
    for (const token of extractedTokens.slice(1)) {
      if (pNameTokens.includes(token)) {
        score += 1.5;
      } else if (p.dosage && cleanStringForSearch(p.dosage).includes(token)) {
        score += 1.5;
      } else if (p.form && cleanStringForSearch(p.form).includes(token)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestProduct = p;
    }
  }

  if (bestProduct && bestScore >= 3) {
    return { product: bestProduct, matchType: 'fuzzy' };
  }

  return { product: null, matchType: 'none' };
}

/**
 * Processes extracted invoice data into matched items with calculated dual-currency pricing,
 * standardized expiry dates, and supplier links ready for PurchaseView.
 */
export function matchExtractedInvoice(
  extracted: ExtractedInvoiceData,
  products: Product[],
  suppliers: Supplier[],
  exchangeRate: number
): ProcessedInvoiceResult {
  const matchedSupplier = matchSupplier(extracted.supplierName, suppliers);
  const currency: 'USD' | 'LBP' = extracted.currency === 'LBP' ? 'LBP' : 'USD';
  const effectiveRate = extracted.exchangeRate && extracted.exchangeRate > 1000 ? extracted.exchangeRate : (exchangeRate || 89500);

  const matchedItems: MatchedInvoiceItem[] = (extracted.items || []).map((item, idx) => {
    const { product, matchType } = matchProduct(item, products);
    const { displayExpiry, isoExpiry } = normalizeExtractedExpiry(item.expiryDate);
    const isExpired = isProductExpired(displayExpiry || isoExpiry);

    // Cost calculations
    const rawCost = Math.max(0, Number(item.unitCost) || 0);
    let unitCostUSD = 0;
    let unitCostLBP = 0;

    if (currency === 'USD') {
      unitCostUSD = Number(rawCost.toFixed(2));
      unitCostLBP = Math.round(rawCost * effectiveRate);
    } else {
      unitCostLBP = Math.round(rawCost);
      unitCostUSD = effectiveRate > 0 ? Number((rawCost / effectiveRate).toFixed(2)) : 0;
    }

    // Selling price calculations
    let sellingPriceUSD = 0;
    let sellingPriceLBP = 0;

    if (item.sellingPrice && item.sellingPrice > 0) {
      if (currency === 'USD') {
        sellingPriceUSD = Number(item.sellingPrice.toFixed(2));
        sellingPriceLBP = Math.round(item.sellingPrice * effectiveRate);
      } else {
        sellingPriceLBP = Math.round(item.sellingPrice);
        sellingPriceUSD = effectiveRate > 0 ? Number((item.sellingPrice / effectiveRate).toFixed(2)) : 0;
      }
    } else if (product) {
      sellingPriceLBP = product.priceLBP || 0;
      sellingPriceUSD = product.priceUSD || (effectiveRate > 0 ? Number((sellingPriceLBP / effectiveRate).toFixed(2)) : 0);
    } else {
      // Standard markup fallback (approx 25-30%)
      sellingPriceUSD = Number((unitCostUSD * 1.25).toFixed(2));
      sellingPriceLBP = Math.round(unitCostLBP * 1.25);
    }

    return {
      ...item,
      id: `idp-item-${Date.now()}-${idx}`,
      matchedProductId: product?.id,
      matchedProductName: product?.name || item.productName,
      matchedProductCode: product?.code || item.itemCode || '',
      matchType,
      calculatedUnitCostUSD: unitCostUSD,
      calculatedUnitCostLBP: unitCostLBP,
      calculatedSellingPriceUSD: sellingPriceUSD,
      calculatedSellingPriceLBP: sellingPriceLBP,
      normalizedExpiryISO: isoExpiry,
      displayExpiry,
      isExpired,
    };
  });

  return {
    supplierId: matchedSupplier?.id || '',
    supplierName: matchedSupplier?.name || extracted.supplierName || '',
    invoiceNumber: extracted.invoiceNumber || '',
    invoiceDate: extracted.invoiceDate || new Date().toISOString().split('T')[0],
    currency,
    invoiceDiscount: extracted.invoiceDiscountPercent || 0,
    items: matchedItems,
    rawExtracted: extracted,
  };
}

/**
 * Converts a processed IDP invoice item into a clean PurchaseItem accepted by PurchaseView.
 */
export function convertToPurchaseItem(
  matchedItem: MatchedInvoiceItem,
  productFallback?: Product
): PurchaseItem {
  return {
    productId: matchedItem.matchedProductId || productFallback?.id || '',
    productCode: matchedItem.matchedProductCode || productFallback?.code || matchedItem.itemCode || '',
    productName: matchedItem.matchedProductName || productFallback?.name || matchedItem.productName,
    quantity: Math.max(1, Math.round(matchedItem.quantity || 1)),
    freeQty: Math.max(0, Math.round(matchedItem.freeQty || 0)),
    unitCostUSD: matchedItem.calculatedUnitCostUSD,
    unitCostLBP: matchedItem.calculatedUnitCostLBP,
    sellingPriceUSD: matchedItem.calculatedSellingPriceUSD,
    sellingPriceLBP: matchedItem.calculatedSellingPriceLBP,
    discount: Math.max(0, Number(matchedItem.discount) || 0),
    batchNumber: (matchedItem.batchNumber || '').trim(),
    expiryDate: matchedItem.displayExpiry || matchedItem.normalizedExpiryISO || '',
    isPiece: Boolean(matchedItem.isPiece),
    vatRate: 0,
  };
}

/**
 * Sends a base64 file to the server's IDP parsing endpoint
 */
export async function sendInvoiceToIDPApi(
  fileBase64: string,
  mimeType: string
): Promise<ExtractedInvoiceData> {
  const response = await fetch('/api/idp/process-invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileData: fileBase64,
      mimeType,
    }),
  });

  const rawText = await response.text().catch(() => '');

  if (!response.ok) {
    let errJson: any = null;
    try {
      errJson = JSON.parse(rawText);
    } catch {
      // If server or proxy returned HTML (e.g. warmup or 502/503 page)
      if (rawText.includes('<!doctype') || rawText.includes('<html')) {
        errJson = {
          error: 'The server is warming up or initializing. Please retry in a few moments.',
        };
      } else {
        errJson = { error: rawText.slice(0, 200) || `Server error (${response.status})` };
      }
    }
    const message = errJson?.error || `Server responded with status ${response.status}`;
    const err = new Error(message);
    (err as any).status = response.status;
    (err as any).fallbackNeeded = errJson?.fallbackNeeded;
    throw err;
  }

  let data: any = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    if (rawText.includes('<!doctype') || rawText.includes('<html')) {
      throw new Error('The server returned an HTML warmup page instead of JSON. Please retry in a moment.');
    }
    throw new Error(`Invalid JSON returned by server: ${rawText.slice(0, 100)}`);
  }

  if (data && data.success === false) {
    const err = new Error(data.error || 'Failed to extract invoice data');
    (err as any).isHighDemand = !!data.isHighDemand;
    (err as any).fallbackNeeded = !!data.fallbackNeeded;
    throw err;
  }

  if (!data || !data.extracted) {
    throw new Error('Invalid response structure from IDP server');
  }

  return data.extracted as ExtractedInvoiceData;
}

/**
 * Provides a realistic sample Lebanese distributor invoice for demonstration or offline testing
 */
export function getSampleDemoInvoice(): ExtractedInvoiceData {
  const today = new Date().toISOString().split('T')[0];
  return {
    supplierName: 'Mersaco S.A.L.',
    invoiceNumber: 'INV-2026-8834',
    invoiceDate: today,
    currency: 'USD',
    exchangeRate: 89500,
    invoiceDiscountPercent: 2,
    totalAmount: 432.5,
    items: [
      {
        productName: 'Augmentin 1g 14 Film-Coated Tab',
        barcode: '5000158068438',
        itemCode: 'AUG1G',
        quantity: 20,
        freeQty: 2,
        batchNumber: 'LOT-AU982',
        expiryDate: '12/2028',
        unitCost: 11.2,
        discount: 0,
        sellingPrice: 14.5,
      },
      {
        productName: 'Panadol Extra 24 Tab',
        barcode: '5000347065017',
        itemCode: 'PANEX',
        quantity: 50,
        freeQty: 5,
        batchNumber: 'LOT-PN551',
        expiryDate: '08/2027',
        unitCost: 2.8,
        discount: 5,
        sellingPrice: 3.5,
      },
      {
        productName: 'Concor 5mg 30 Tab',
        barcode: '4022536854128',
        itemCode: 'CON5',
        quantity: 15,
        freeQty: 0,
        batchNumber: 'LOT-CC339',
        expiryDate: '04/2028',
        unitCost: 4.5,
        discount: 0,
        sellingPrice: 5.8,
      },
      {
        productName: 'Profid 200mg 20 Cap',
        barcode: '7680456123987',
        itemCode: 'PRF200',
        quantity: 10,
        freeQty: 1,
        batchNumber: 'LOT-PF102',
        expiryDate: '10/2027',
        unitCost: 3.75,
        discount: 0,
        sellingPrice: 4.9,
      },
    ],
  };
}
