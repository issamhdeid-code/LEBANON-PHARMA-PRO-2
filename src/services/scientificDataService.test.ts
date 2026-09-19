import { describe, it, expect } from 'vitest';
import {
  extractMedlineDosing,
  synthesizeMultiIngredientScientificInfo,
  type PharmacopoeiaEntry,
} from './scientificDataService';

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