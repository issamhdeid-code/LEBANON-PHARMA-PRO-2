import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PRESENTATIONS,
  isCanonicalPresentation,
  normalizePresentation,
  getStandardPresentations,
} from './presentationUtils';

describe('presentationUtils', () => {
  it('has canonical presentations defined', () => {
    expect(CANONICAL_PRESENTATIONS.length).toBeGreaterThan(30);
    expect(isCanonicalPresentation('1 Vial')).toBe(true);
    expect(isCanonicalPresentation('1 vial')).toBe(true);
    expect(isCanonicalPresentation('30')).toBe(true);
    expect(isCanonicalPresentation('100ml')).toBe(true);
    expect(isCanonicalPresentation('30g')).toBe(true);
  });

  it('normalizes vials and ampoules', () => {
    expect(normalizePresentation('1Vial')).toBe('1 Vial');
    expect(normalizePresentation('1 vial')).toBe('1 Vial');
    expect(normalizePresentation('10Vials')).toBe('10 Vials');
    expect(normalizePresentation('10 vials')).toBe('10 Vials');
    expect(normalizePresentation('1Vial for single use')).toBe('1 Vial');
    expect(normalizePresentation('5Ampoules')).toBe('5 Ampoules');
    expect(normalizePresentation('10ampoules')).toBe('10 Ampoules');
  });

  it('normalizes syringes and pens', () => {
    expect(normalizePresentation('1Prefilled syringe')).toBe('1 Prefilled Syringe');
    expect(normalizePresentation('2prefilled syringes')).toBe('2 Prefilled Syringes');
    expect(normalizePresentation('1prefilled pen')).toBe('1 Prefilled Pen');
  });

  it('normalizes weights, volumes, and sachets', () => {
    expect(normalizePresentation('100 ml')).toBe('100ml');
    expect(normalizePresentation('100ML')).toBe('100ml');
    expect(normalizePresentation('30 g')).toBe('30g');
    expect(normalizePresentation('30G')).toBe('30g');
    expect(normalizePresentation('12sachets')).toBe('12 Sachets');
    expect(normalizePresentation('30Sachets')).toBe('30 Sachets');
    expect(normalizePresentation('Tube of 60g')).toBe('60g');
    expect(normalizePresentation('Tube de 15g')).toBe('15g');
  });

  it('normalizes solid unit packaging descriptions to clean numbers', () => {
    expect(normalizePresentation('30 Tablets')).toBe('30');
    expect(normalizePresentation('Box of 24 tablets')).toBe('24');
    expect(normalizePresentation('24 Film-Coated Tablets (2 Blisters)')).toBe('24');
    expect(normalizePresentation('14 Film-Coated Tablets')).toBe('14');
    expect(normalizePresentation('30 Heart-Shaped Tablets')).toBe('30');
    expect(normalizePresentation('28 Gastro-Resistant Tablets')).toBe('28');
    expect(normalizePresentation('Box of 30')).toBe('30');
    expect(normalizePresentation('30 (3x10)')).toBe('30');
  });

  it('getStandardPresentations returns canonical and genuine custom presentations', () => {
    const list = getStandardPresentations(['1 Vial', 'Custom Pack 55']);
    expect(list).toContain('1 Vial');
    expect(list).toContain('Custom Pack 55');
    // Does not duplicate 1 Vial
    const count = list.filter((p) => p.toLowerCase() === '1 vial').length;
    expect(count).toBe(1);
  });
});
