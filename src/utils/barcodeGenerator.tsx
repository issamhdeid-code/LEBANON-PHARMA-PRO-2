import React from 'react';

/**
 * Standard Code 128 Pattern Table (Patterns 0 to 106).
 * Each pattern specifies alternating bar and space widths in modules (1 to 4).
 * Patterns 0..105 have 6 elements totaling 11 modules.
 * Stop pattern (106) has 7 elements totaling 13 modules.
 */
export const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export interface BarcodeRect {
  x: number;
  width: number;
}

export interface EncodedBarcode {
  rects: BarcodeRect[];
  totalWidth: number;
  cleanText: string;
}

/**
 * Encodes an ASCII string into Code 128-B bar coordinates with quiet zones.
 * Safe fallback for non-ASCII or empty values.
 */
export function encodeCode128B(
  text: string,
  moduleWidth: number = 1.5,
  quietZoneModules: number = 10
): EncodedBarcode {
  let cleanText = (text || '').trim();
  if (!cleanText) {
    cleanText = '000000';
  }

  // Filter out characters outside ASCII 32..126
  let filteredText = '';
  for (let i = 0; i < cleanText.length; i++) {
    const code = cleanText.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      filteredText += cleanText[i];
    }
  }

  if (!filteredText) {
    filteredText = '000000';
  }

  const START_B = 104;
  const STOP = 106;
  const codes: number[] = [START_B];
  let checkSum = START_B;

  for (let i = 0; i < filteredText.length; i++) {
    const val = filteredText.charCodeAt(i) - 32;
    codes.push(val);
    checkSum += val * (i + 1);
  }

  codes.push(checkSum % 103);
  codes.push(STOP);

  const rects: BarcodeRect[] = [];
  let currentX = quietZoneModules * moduleWidth;

  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c] || CODE128_PATTERNS[0];
    for (let p = 0; p < pattern.length; p++) {
      const widthUnits = parseInt(pattern[p], 10);
      const widthPx = widthUnits * moduleWidth;
      const isBar = p % 2 === 0;
      if (isBar) {
        rects.push({
          x: Math.round(currentX * 100) / 100,
          width: Math.round(widthPx * 100) / 100,
        });
      }
      currentX += widthPx;
    }
  }

  const totalWidth = Math.round((currentX + quietZoneModules * moduleWidth) * 100) / 100;

  return {
    rects,
    totalWidth,
    cleanText: filteredText,
  };
}

export interface BarcodeSvgProps {
  value: string;
  height?: number;
  moduleWidth?: number;
  showText?: boolean;
  fontSize?: number;
  className?: string;
  textColor?: string;
  barColor?: string;
}

/**
 * Pure SVG Barcode component (Code 128-B standard).
 * Guaranteed crisp output on screen, thermal roll printers, and laser/inkjet label sheets.
 */
export const BarcodeSvg: React.FC<BarcodeSvgProps> = React.memo(function BarcodeSvg({
  value,
  height = 36,
  moduleWidth = 1.3,
  showText = true,
  fontSize = 10,
  className = '',
  textColor = '#0f172a',
  barColor = '#000000',
}) {
  const { rects, totalWidth, cleanText } = React.useMemo(
    () => encodeCode128B(value, moduleWidth, 8),
    [value, moduleWidth]
  );

  const textOffset = showText ? fontSize + 4 : 0;
  const totalSvgHeight = height + textOffset;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalSvgHeight}`}
      className={`w-full max-w-full overflow-visible select-none ${className}`}
      style={{ display: 'block', height: 'auto', maxHeight: `${totalSvgHeight}px` }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Barcode for ${cleanText}`}
    >
      {/* Barcode bars */}
      <g fill={barColor}>
        {rects.map((r, idx) => (
          <rect
            key={idx}
            x={r.x}
            y={0}
            width={r.width}
            height={height}
          />
        ))}
      </g>

      {/* Human-readable text */}
      {showText && (
        <text
          x={totalWidth / 2}
          y={height + fontSize}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontWeight="600"
          fill={textColor}
          letterSpacing="1px"
        >
          {cleanText}
        </text>
      )}
    </svg>
  );
});
