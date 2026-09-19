import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PHARMACEUTICAL_FORMS,
  isCanonicalPharmaceuticalForm,
  normalizePharmaceuticalForm,
  getStandardPharmaceuticalForms,
} from './pharmaceuticalFormUtils';

describe('pharmaceuticalFormUtils', () => {
  it('has exactly 24 canonical forms sorted alphabetically', () => {
    expect(CANONICAL_PHARMACEUTICAL_FORMS).toHaveLength(24);
    const sorted = [...CANONICAL_PHARMACEUTICAL_FORMS].sort();
    expect(CANONICAL_PHARMACEUTICAL_FORMS).toEqual(sorted);
  });

  it('correctly identifies canonical forms', () => {
    expect(isCanonicalPharmaceuticalForm('Tablet')).toBe(true);
    expect(isCanonicalPharmaceuticalForm('tablet')).toBe(true);
    expect(isCanonicalPharmaceuticalForm('CAPSULE')).toBe(true);
    expect(isCanonicalPharmaceuticalForm('Syrup')).toBe(true);
    expect(isCanonicalPharmaceuticalForm('Unknown Form')).toBe(false);
    expect(isCanonicalPharmaceuticalForm('')).toBe(false);
    expect(isCanonicalPharmaceuticalForm(undefined)).toBe(false);
  });

  describe('normalizePharmaceuticalForm', () => {
    it('normalizes tablet variants into Tablet', () => {
      expect(normalizePharmaceuticalForm('Tablet, film coated')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Tablet, scored')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Tablet, enteric coated')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Tablet, prolonged release')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Tablet, chewable')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Tablet, effervescent')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Tablets')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('tablets')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Comprimés pelliculés')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Comprimé')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Comprimes')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('FCT')).toBe('Tablet');
      expect(normalizePharmaceuticalForm('Caplet, film coated')).toBe('Tablet');
    });

    it('normalizes capsule variants into Capsule', () => {
      expect(normalizePharmaceuticalForm('Capsule, hard')).toBe('Capsule');
      expect(normalizePharmaceuticalForm('Capsule, soft')).toBe('Capsule');
      expect(normalizePharmaceuticalForm('Capsules soft')).toBe('Capsule');
      expect(normalizePharmaceuticalForm('Gélule')).toBe('Capsule');
      expect(normalizePharmaceuticalForm('gélule')).toBe('Capsule');
      expect(normalizePharmaceuticalForm('Gelules')).toBe('Capsule');
      expect(normalizePharmaceuticalForm('Softgel')).toBe('Capsule');
    });

    it('normalizes liquid syrups and elixirs', () => {
      expect(normalizePharmaceuticalForm('Syrup, sugar free')).toBe('Syrup');
      expect(normalizePharmaceuticalForm('Sirop')).toBe('Syrup');
      expect(normalizePharmaceuticalForm('Cough syrup')).toBe('Syrup');
      expect(normalizePharmaceuticalForm('Elixir')).toBe('Elixir');
      expect(normalizePharmaceuticalForm('Élixir')).toBe('Elixir');
    });

    it('normalizes drops correctly ahead of general solutions', () => {
      expect(normalizePharmaceuticalForm('Eye drops solution')).toBe('Drops');
      expect(normalizePharmaceuticalForm('Eye drops')).toBe('Drops');
      expect(normalizePharmaceuticalForm('Ear drops solution')).toBe('Drops');
      expect(normalizePharmaceuticalForm('Collyre en solution')).toBe('Drops');
      expect(normalizePharmaceuticalForm('Gouttes')).toBe('Drops');
    });

    it('normalizes injections and infusions', () => {
      expect(normalizePharmaceuticalForm('Solution for injection')).toBe('Injection');
      expect(normalizePharmaceuticalForm('Injectable solution')).toBe('Injection');
      expect(normalizePharmaceuticalForm('Sol inj')).toBe('Injection');
      expect(normalizePharmaceuticalForm('Vial')).toBe('Injection');
      expect(normalizePharmaceuticalForm('Ampoule')).toBe('Ampoule');
      expect(normalizePharmaceuticalForm('Concentrate for solution for infusion')).toBe('Infusion');
      expect(normalizePharmaceuticalForm('Solution pour perfusion')).toBe('Infusion');
    });

    it('normalizes creams, gels, ointments', () => {
      expect(normalizePharmaceuticalForm('Topical cream')).toBe('Cream');
      expect(normalizePharmaceuticalForm('Crème')).toBe('Cream');
      expect(normalizePharmaceuticalForm('Eye ointment')).toBe('Ointment');
      expect(normalizePharmaceuticalForm('Pommade')).toBe('Ointment');
      expect(normalizePharmaceuticalForm('Topical gel')).toBe('Gel');
      expect(normalizePharmaceuticalForm('Gel dermique')).toBe('Gel');
    });

    it('normalizes suppositories, ovules, and pessaries', () => {
      expect(normalizePharmaceuticalForm('Suppositories')).toBe('Suppository');
      expect(normalizePharmaceuticalForm('Suppositoire')).toBe('Suppository');
      expect(normalizePharmaceuticalForm('Vaginal ovules')).toBe('Ovule');
      expect(normalizePharmaceuticalForm('Pessaries')).toBe('Ovule');
    });

    it('normalizes inhalers and sprays', () => {
      expect(normalizePharmaceuticalForm('Metered dose inhaler')).toBe('Inhaler');
      expect(normalizePharmaceuticalForm('Turbuhaler')).toBe('Inhaler');
      expect(normalizePharmaceuticalForm('Respule')).toBe('Inhaler');
      expect(normalizePharmaceuticalForm('Nasal spray suspension')).toBe('Spray');
      expect(normalizePharmaceuticalForm('Sublingual spray')).toBe('Spray');
    });

    it('normalizes powders, sachets, suspensions, solutions', () => {
      expect(normalizePharmaceuticalForm('Sachets granules for oral solution')).toBe('Sachet');
      expect(normalizePharmaceuticalForm('Granules')).toBe('Sachet');
      expect(normalizePharmaceuticalForm('Powder for oral suspension')).toBe('Powder');
      expect(normalizePharmaceuticalForm('Oral suspension')).toBe('Suspension');
      expect(normalizePharmaceuticalForm('Oral solution')).toBe('Solution');
      expect(normalizePharmaceuticalForm('Solution buvable')).toBe('Solution');
      expect(normalizePharmaceuticalForm('Transdermal patch')).toBe('Patch');
      expect(normalizePharmaceuticalForm('Shampooing')).toBe('Shampoo');
    });

    it('handles empty or blank values with fallback', () => {
      expect(normalizePharmaceuticalForm('')).toBe('Tablet');
      expect(normalizePharmaceuticalForm(undefined)).toBe('Tablet');
      expect(normalizePharmaceuticalForm(null)).toBe('Tablet');
      expect(normalizePharmaceuticalForm('   ', 'Capsule')).toBe('Capsule');
    });
  });

  describe('getStandardPharmaceuticalForms', () => {
    it('returns the 24 canonical forms without duplicates when customForms contains duplicate names', () => {
      const result = getStandardPharmaceuticalForms([
        'tablet',
        'TABLET',
        'Comprimé',
        'Tablet, film coated',
        'Capsule',
        'Syrup',
      ]);
      expect(result).toHaveLength(24);
      expect(result).toEqual([...CANONICAL_PHARMACEUTICAL_FORMS].sort());
    });

    it('adds genuinely new custom forms that are not in the 24 standard forms', () => {
      const result = getStandardPharmaceuticalForms(['Gum', 'Lozenge', 'Tablet']);
      expect(result).toContain('Gum');
      expect(result).toContain('Lozenge');
      expect(result.filter((f) => f === 'Tablet')).toHaveLength(1);
      expect(result).toHaveLength(26);
    });
  });
});
