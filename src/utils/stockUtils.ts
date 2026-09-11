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
