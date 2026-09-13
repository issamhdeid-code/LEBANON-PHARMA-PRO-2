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
