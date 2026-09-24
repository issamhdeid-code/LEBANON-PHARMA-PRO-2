import { Product } from '../types/pharmacy';

export const escapeCsvCell = (value: string | number | null | undefined): string => {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const STOCK_EXPORT_EXCEL_HEADERS = [
  'Code',
  'Barcode',
  'Name',
  'Dosage',
  'Form',
  'Presentation',
  'Category',
  'Subcategory',
  'Price USD ($)',
  'Price LBP',
  'Cost Price USD ($)',
  'Stock Quantity',
  'Packaging / Units',
  'Min Stock Alert',
  'Stock Status',
  'Expiry Date',
  'Batch Number',
  'Agent / Supplier',
  'Active Ingredients',
];

export function getProductStockStatus(quantity: number, minStockAlert: number = 5): 'Out of Stock' | 'Low Stock' | 'Normal' {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= minStockAlert) return 'Low Stock';
  return 'Normal';
}

export function formatProductPackagingUnits(p: Product): string {
  const qty = p.stockQuantity ?? 0;
  if (!p.isDivisible || !p.piecesPerBox || p.piecesPerBox <= 1) {
    return `${qty} box${qty === 1 ? '' : 'es'}`;
  }
  const totalPieces = Math.round(qty * p.piecesPerBox);
  const boxes = Math.floor(totalPieces / p.piecesPerBox);
  const pieces = totalPieces % p.piecesPerBox;
  const pieceLabel = p.pieceName || 'piece';
  if (boxes === 0 && pieces > 0) {
    return `${pieces} ${pieceLabel}${pieces === 1 ? '' : 's'}`;
  }
  if (pieces === 0) {
    return `${boxes} box${boxes === 1 ? '' : 'es'}`;
  }
  return `${boxes} box${boxes === 1 ? '' : 'es'}, ${pieces} ${pieceLabel}${pieces === 1 ? '' : 's'}`;
}

export function generateStockInventoryCsv(products: Product[]): string {
  const rows = products.map((p) => {
    const unitsText = formatProductPackagingUnits(p);
    const stockStatus = getProductStockStatus(p.stockQuantity ?? 0, p.minStockAlert ?? 5);

    return [
      p.code || '',
      p.barcode || '',
      p.name || '',
      p.dosage || '',
      p.form || '',
      p.presentation || '',
      p.category || '',
      p.subcategory || '',
      p.priceUSD > 0 ? p.priceUSD.toFixed(2) : '0.00',
      p.priceLBP > 0 ? String(Math.round(p.priceLBP)) : '0',
      p.costPriceUSD != null && p.costPriceUSD > 0 ? p.costPriceUSD.toFixed(2) : '',
      p.stockQuantity ?? 0,
      unitsText,
      p.minStockAlert ?? 5,
      stockStatus,
      p.expiryDate || '',
      p.batchNumber || (p.batches?.[0]?.batchNumber ?? ''),
      p.agent || '',
      p.ingredients || '',
    ];
  });

  return [STOCK_EXPORT_EXCEL_HEADERS.join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\r\n');
}

export function downloadCsvFile(csvContent: string, filename: string): void {
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
