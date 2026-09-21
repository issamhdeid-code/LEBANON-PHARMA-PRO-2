import { describe, it, expect } from 'vitest';
import {
  extractMedlineDosing,
  synthesizeMultiIngredientScientificInfo,
  areMoleculesEquivalent,
  hasMatchingActiveMolecule,
  findCategorizedGenericAlternatives,
  type PharmacopoeiaEntry,
} from './scientificDataService';
import { Product } from '../types/pharmacy';

describe('extractMedlineDosing', () => {
  it('extracts real adult and pediatric dosing from an AHFS MedlinePlus summary', () => {
    const summary = [
      'This drug comes as a tablet to take by mouth.',
      'Adults—500 milligrams (mg) every 8 hours for 7 days.',
      'Children—15 mg/kg every 12 hours.',
      'Store at room temperature.',
    ].join(' ');

    const result = extractMedlineDosing(summary);
    expect(result.dosage).toContain('500 milligrams (mg) every 8 hours');
    expect(result.pediatricDosage).toContain('15 mg/kg every 12 hours');
  });

  it('handles "Adults:" and "Children:" prefix variants', () => {
    const summary = 'Adults: 20 mg once daily with food. Children: 5 mg/kg/day in two divided doses.';
    const result = extractMedlineDosing(summary);
    expect(result.dosage).toContain('20 mg once daily');
    expect(result.pediatricDosage).toContain('5 mg/kg/day');
  });

  it('ignores sentences with a prefix but no numeric dose', () => {
    const summary = 'Adults—Your doctor will determine the best dose. Children under 12 should not use this drug.';
    const result = extractMedlineDosing(summary);
    expect(result.dosage).toBe('');
    expect(result.pediatricDosage).toBe('');
  });

  it('returns empty strings for empty input', () => {
    expect(extractMedlineDosing('')).toEqual({ dosage: '', pediatricDosage: '' });
    expect(extractMedlineDosing('   ')).toEqual({ dosage: '', pediatricDosage: '' });
  });
});

const MONOGRAPH: PharmacopoeiaEntry = {
  indications: '• Primary Use: Fallback.',
  contraindications: '• Absolute: Hypersensitivity.',
  sideEffects: '• Common Reactions: Generic.',
  dosage: 'Adults: fallback dose.',
  pediatricDosage: 'Pediatrics: fallback child dose.',
  pregnancyCategory: 'B',
  storageConditions: 'Store below 25°C.',
};

describe('synthesizeMultiIngredientScientificInfo', () => {
  const paracetamol = {
    molecule: 'Paracetamol',
    data: {
      indications: '• Primary Use: Relief of mild to moderate pain and fever.\n• Key Indications: Headache; toothache; fever.\n• Pharmacological Class: Analgesic / Antipyretic.',
      contraindications: '• Clinical Contraindications: Severe hepatic impairment.',
      sideEffects: '• Common Reactions: Nausea, rash.\n• Critical Warnings: Acute hepatotoxicity with overdose.',
      dosage: '500mg every 4-6 hours, max 3000mg/day',
      pediatricDosage: '10-15 mg/kg every 4-6 hours',
      source: 'NIH NLM (MedlinePlus & RxNav)',
    },
  };

  it('combines specific primary uses and classes from each molecule, no boilerplate', () => {
    const caffeine = {
      molecule: 'Caffeine',
      data: {
        indications: '• Primary Use: Restoration of mental alertness.\n• Key Indications: Fatigue; drowsiness.\n• Pharmacological Class: Xanthine Stimulant.',
        contraindications: '• Clinical Contraindications: Gastric ulcer, severe anxiety.',
        sideEffects: '• Common Reactions: Insomnia, palpitations.',
        source: 'NIH NLM (MedlinePlus & RxNav)',
      },
    };

    const result = synthesizeMultiIngredientScientificInfo([paracetamol, caffeine], ['Paracetamol', 'Caffeine'], MONOGRAPH);

    expect(result.indications).toContain('Paracetamol: Relief of mild to moderate pain and fever');
    expect(result.indications).toContain('Caffeine: Restoration of mental alertness');
    expect(result.indications).toContain('Analgesic / Antipyretic');
    expect(result.indications).toContain('Xanthine Stimulant');
    expect(result.indications).not.toContain('synergistic clinical efficacy');
    expect(result.source).toBe('NIH NLM Multi-Ingredient Synthesis (MedlinePlus & RxNav)');
  });

  it('carries real adult and pediatric dosing recovered from online lookups', () => {
    const result = synthesizeMultiIngredientScientificInfo([paracetamol], ['Paracetamol'], MONOGRAPH);
    expect(result.dosage).toContain('500mg every 4-6 hours');
    expect(result.pediatricDosage).toContain('10-15 mg/kg');
  });

  it('falls back to monograph dosage when no online dose exists', () => {
    const noDose = {
      ...paracetamol,
      data: { ...paracetamol.data, dosage: undefined, pediatricDosage: undefined },
    };
    const result = synthesizeMultiIngredientScientificInfo([noDose], ['Paracetamol'], MONOGRAPH);
    expect(result.dosage).toBe('Adults: fallback dose.');
    expect(result.pediatricDosage).toBe('Pediatrics: fallback child dose.');
  });

  it('marks the source as FDA-aware when any molecule came from an FDA label', () => {
    const fdaRow = {
      ...paracetamol,
      data: { ...paracetamol.data, source: 'FDA Label (openFDA)' },
    };
    const result = synthesizeMultiIngredientScientificInfo([fdaRow], ['Paracetamol'], MONOGRAPH);
    expect(result.source).toBe('NIH NLM + FDA Multi-Ingredient Synthesis (MedlinePlus, RxNav & openFDA)');
  });
});

describe('areMoleculesEquivalent & hasMatchingActiveMolecule', () => {
  it('correctly matches equivalent molecules and synonyms without false positives', () => {
    // Exact & Salt / Hydrate variations
    expect(areMoleculesEquivalent('Paracetamol', 'Paracetamol')).toBe(true);
    expect(areMoleculesEquivalent('Paracetamol', 'Acetaminophen')).toBe(true);
    expect(areMoleculesEquivalent('Amoxicillin Trihydrate', 'Amoxicillin')).toBe(true);
    expect(areMoleculesEquivalent('Amoxicilline', 'Amoxicillin')).toBe(true);
    expect(areMoleculesEquivalent('Diclofenac Sodium', 'Diclofenac Potassium')).toBe(true);
    expect(areMoleculesEquivalent('Salbutamol Sulfate', 'Albuterol')).toBe(true);
    expect(areMoleculesEquivalent('Cholecalciferol', 'Vitamin D3')).toBe(true);
    expect(areMoleculesEquivalent('Ascorbic Acid', 'Vitamin C')).toBe(true);

    // Rejects distinct molecules that share sub-words or prefixes (PREVENT FALSE POSITIVES)
    expect(areMoleculesEquivalent('Cefixime', 'Cefuroxime')).toBe(false);
    expect(areMoleculesEquivalent('Cefixime', 'Cefaclor')).toBe(false);
    expect(areMoleculesEquivalent('Ascorbic Acid', 'Folic Acid')).toBe(false);
    expect(areMoleculesEquivalent('Spironolactone', 'Iron')).toBe(false);
    expect(areMoleculesEquivalent('Amoxicillin', 'Ampicillin')).toBe(false);
    expect(areMoleculesEquivalent('Paracetamol', 'Ibuprofen')).toBe(false);
    expect(areMoleculesEquivalent('Celecoxib', 'Etoricoxib')).toBe(false);
  });

  it('correctly matches products sharing active molecules', () => {
    const panadol = { ingredients: 'Paracetamol 500mg', name: 'Panadol 500mg' };
    const adol = { ingredients: 'Paracetamol 500mg', name: 'Adol 500mg' };
    const panadolExtra = { ingredients: 'Paracetamol 500mg + Caffeine 65mg', name: 'Panadol Extra' };
    const brufen = { ingredients: 'Ibuprofen 400mg', name: 'Brufen 400mg' };
    const aldactone = { ingredients: 'Spironolactone 25mg', name: 'Aldactone 25mg' };

    expect(hasMatchingActiveMolecule(panadol, adol)).toBe(true);
    expect(hasMatchingActiveMolecule(panadol, panadolExtra)).toBe(true);
    expect(hasMatchingActiveMolecule(panadol, brufen)).toBe(false);
    expect(hasMatchingActiveMolecule(panadol, aldactone)).toBe(false);
  });

  it('categorizes single vs multi-ingredient generic alternatives and sorts in-stock first', () => {
    const targetProduct: Product = {
      id: 'target-1',
      code: 'PAN500',
      name: 'Panadol Advance 500mg',
      category: 'drug',
      ingredients: 'Paracetamol 500mg',
      dosage: '500mg',
      presentation: 'Box of 24 tablets',
      form: 'Tablet',
      stockQuantity: 10,
      priceUSD: 2.5,
      priceLBP: 223750,
      costPriceUSD: 2.0,
      pharmacistMarginProfit: 20,
      minStockAlert: 5,
      expiryDate: '2027-12-31',
      batchNumber: 'B123',
      agent: 'Omnipharma',
      updatedAt: Date.now(),
      version: 1,
    };

    const mockCatalog: Product[] = [
      {
        ...targetProduct,
        id: 'alt-1',
        code: 'ADOL500',
        name: 'Adol 500mg',
        ingredients: 'Paracetamol 500mg',
        stockQuantity: 5,
      },
      {
        ...targetProduct,
        id: 'alt-2',
        code: 'DOLIPRANE',
        name: 'Doliprane 500mg',
        ingredients: 'Paracetamol 500mg',
        stockQuantity: 0,
      },
      {
        ...targetProduct,
        id: 'alt-3',
        code: 'PANEXTRA',
        name: 'Panadol Extra',
        ingredients: 'Paracetamol 500mg + Caffeine 65mg',
        stockQuantity: 8,
      },
      {
        ...targetProduct,
        id: 'alt-4',
        code: 'BRUFEN400',
        name: 'Brufen 400mg',
        ingredients: 'Ibuprofen 400mg',
        stockQuantity: 20,
      },
      {
        ...targetProduct,
        id: 'alt-5',
        code: 'SPIRONO25',
        name: 'Aldactone 25mg',
        ingredients: 'Spironolactone 25mg',
        stockQuantity: 15,
      },
    ];

    const result = findCategorizedGenericAlternatives(targetProduct, mockCatalog);

    // Single ingredient alternatives should only contain Adol and Doliprane
    expect(result.singleIngredient.map((p) => p.code)).toEqual(['ADOL500', 'DOLIPRANE']);
    // In-stock (Adol) must come before out-of-stock (Doliprane)
    expect(result.singleIngredient[0].code).toBe('ADOL500');
    expect(result.singleIngredient[1].code).toBe('DOLIPRANE');

    // Multi-ingredient alternatives should only contain Panadol Extra
    expect(result.multiIngredient.map((p) => p.code)).toEqual(['PANEXTRA']);

    // Non-matching products (Brufen, Aldactone) MUST NOT be present in either list
    expect(result.allSorted.map((p) => p.code)).not.toContain('BRUFEN400');
    expect(result.allSorted.map((p) => p.code)).not.toContain('SPIRONO25');

    expect(result.inStockCount).toBe(2);
    expect(result.totalCount).toBe(3);
  });
});