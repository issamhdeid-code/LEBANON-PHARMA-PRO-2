import { Product } from './pharmacy';

export type LabelPresetId =
  | 'shelf-50x25'
  | 'compact-38x20'
  | 'box-70x35'
  | 'a4-grid-24'
  | 'thermal-58mm';

export interface LabelPresetDefinition {
  id: LabelPresetId;
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  columnsPerPage?: number;
  isContinuousRoll?: boolean;
}

export const LABEL_PRESETS: Record<LabelPresetId, LabelPresetDefinition> = {
  'shelf-50x25': {
    id: 'shelf-50x25',
    name: 'Shelf Edge (50 × 25 mm)',
    description: 'Standard pharmacy shelf price tag (2" × 1")',
    widthMm: 50,
    heightMm: 25,
    columnsPerPage: 3,
  },
  'compact-38x20': {
    id: 'compact-38x20',
    name: 'Compact Vial / Bottle (38 × 20 mm)',
    description: 'Small format for eye drops, ampoules & small bottles',
    widthMm: 38,
    heightMm: 20,
    columnsPerPage: 4,
  },
  'box-70x35': {
    id: 'box-70x35',
    name: 'Large Carton / Box (70 × 35 mm)',
    description: 'Large format for bulk cartons and syrup bottles',
    widthMm: 70,
    heightMm: 35,
    columnsPerPage: 2,
  },
  'a4-grid-24': {
    id: 'a4-grid-24',
    name: 'A4 Sticker Sheet (3 × 8 = 24 Labels)',
    description: 'Standard 24-up sticker paper for A4 desktop printers (70 × 37 mm)',
    widthMm: 70,
    heightMm: 37,
    columnsPerPage: 3,
  },
  'thermal-58mm': {
    id: 'thermal-58mm',
    name: 'Thermal Roll (58 mm width)',
    description: 'Single-column continuous roll for POS & thermal label printers',
    widthMm: 54,
    heightMm: 30,
    columnsPerPage: 1,
    isContinuousRoll: true,
  },
};

export interface BarcodeLabelTemplate {
  preset: LabelPresetId;
  labelWidthMm: number;
  labelHeightMm: number;

  // Product Name
  showProductName: boolean;
  productNameSize: 'xs' | 'sm' | 'base';
  productNameLines: 1 | 2;
  productNameBold: boolean;

  // Price
  showPrice: boolean;
  priceCurrency: 'both' | 'usd' | 'lbp';
  priceSize: 'sm' | 'base' | 'lg';
  priceBold: boolean;

  // Barcode
  showBarcodeGraphic: boolean;
  showBarcodeText: boolean;
  barcodeHeight: number;
  barcodeSource: 'auto' | 'barcode_only' | 'code_only';

  // Pharmacy & Drug Details
  showPharmacyName: boolean;
  customPharmacyName: string;
  showDosageForm: boolean;
  showExpiryDate: boolean;
  showBatchNumber: boolean;

  // Border & Appearance
  borderStyle: 'solid' | 'dashed' | 'none';
}

export const DEFAULT_BARCODE_TEMPLATE: BarcodeLabelTemplate = {
  preset: 'shelf-50x25',
  labelWidthMm: 50,
  labelHeightMm: 25,

  showProductName: true,
  productNameSize: 'sm',
  productNameLines: 2,
  productNameBold: true,

  showPrice: true,
  priceCurrency: 'both',
  priceSize: 'base',
  priceBold: true,

  showBarcodeGraphic: true,
  showBarcodeText: true,
  barcodeHeight: 32,
  barcodeSource: 'auto',

  showPharmacyName: true,
  customPharmacyName: '',
  showDosageForm: true,
  showExpiryDate: false,
  showBatchNumber: false,

  borderStyle: 'solid',
};

export interface BarcodePrintItem {
  product: Product;
  quantity: number;
}
