/**
 * Pharmaceutical Form Standardization Utility
 * Standardizes raw/imported drug forms into 24 canonical standard forms,
 * eliminating duplicate and localized variants (e.g. film-coated, comprimés, gélules, drops, injections).
 */

export const CANONICAL_PHARMACEUTICAL_FORMS = [
  'Ampoule',
  'Capsule',
  'Cream',
  'Drops',
  'Elixir',
  'Emulsion',
  'Enema',
  'Gel',
  'Infusion',
  'Inhaler',
  'Injection',
  'Lotion',
  'Ointment',
  'Ovule',
  'Patch',
  'Powder',
  'Sachet',
  'Shampoo',
  'Solution',
  'Spray',
  'Suppository',
  'Suspension',
  'Syrup',
  'Tablet',
] as const;

export type CanonicalPharmaceuticalForm = (typeof CANONICAL_PHARMACEUTICAL_FORMS)[number];

const CANONICAL_SET_LOWER = new Set<string>(
  CANONICAL_PHARMACEUTICAL_FORMS.map((f) => f.toLowerCase())
);

/**
 * Checks if a string is one of the 24 canonical pharmaceutical forms (case-insensitive).
 */
export function isCanonicalPharmaceuticalForm(form: string | undefined | null): boolean {
  if (!form) return false;
  return CANONICAL_SET_LOWER.has(form.trim().toLowerCase());
}

/**
 * Normalizes any pharmaceutical form string into one of the 24 canonical standard forms.
 * If the form is unrecognized, returns formatted title-case version without creating duplicates.
 */
export function normalizePharmaceuticalForm(
  rawForm: string | undefined | null,
  fallback = 'Tablet'
): string {
  if (!rawForm || typeof rawForm !== 'string') return fallback;
  const str = rawForm.trim();
  if (!str) return fallback;

  // Normalize diacritics for robust matching (e.g. Élixir -> elixir, Gélule -> gelule, Crème -> creme)
  const cleanStr = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lower = cleanStr.toLowerCase();

  // Exact canonical match first (case-insensitive)
  const canonicalExact = CANONICAL_PHARMACEUTICAL_FORMS.find(
    (c) => c.toLowerCase() === lower
  );
  if (canonicalExact) return canonicalExact;

  // 1. Specific dosage forms with priority
  // Ampoule (must precede injection/infusion)
  if (/\bampoules?\b/i.test(lower)) return 'Ampoule';

  // Infusion / Perfusion (must precede general solution)
  if (/\b(infus|perfus)/i.test(lower)) return 'Infusion';

  // Injections / Injectables / Vials / Prefilled syringes
  if (/\b(inject|inj\b|vials?|sol inj|syringe|solostar)/i.test(lower)) return 'Injection';

  // Eye/Ear/Oral/Nasal drops (must precede general solution)
  if (
    /\b(drops?|collyres?|gouttes?|instillation)\b/i.test(lower) ||
    /(eye|ear|oral|nasal)\s+drops/i.test(lower) ||
    /ophtalm.*solution/i.test(lower)
  ) {
    return 'Drops';
  }

  // Sprays (nasal, sublingual, topical spray)
  if (/\b(sprays?|pulveris)/i.test(lower)) return 'Spray';

  // Inhalers (aerosol, turbuhaler, diskus, respule, inhaler)
  if (/\b(inhal|respules?|turbuhaler|diskus|aerolizer|rotacaps?)/i.test(lower)) return 'Inhaler';

  // Ovules / Pessaries
  if (/\b(ovules?|pessar)/i.test(lower)) return 'Ovule';

  // Suppositories
  if (/\b(supposit)/i.test(lower)) return 'Suppository';

  // Patches
  if (/\bpatch/i.test(lower)) return 'Patch';

  // Topicals
  if (/\b(shampoos?|shampooing)\b/i.test(lower)) return 'Shampoo';
  if (/\blotions?\b/i.test(lower)) return 'Lotion';
  if (/\b(ointments?|pommades?)\b/i.test(lower)) return 'Ointment';
  if (/\b(gels?|gelee)\b/i.test(lower)) return 'Gel';
  if (/\b(creams?|creme)\b/i.test(lower)) return 'Cream';
  if (/\bemulsions?\b/i.test(lower)) return 'Emulsion';
  if (/\benemas?\b/i.test(lower)) return 'Enema';

  // Solid oral forms
  if (/\b(capsules?|gelules?|softgels?)\b/i.test(lower)) return 'Capsule';
  if (/\b(tablets?|comprim|fct|caplets?|repetabs?)/i.test(lower)) return 'Tablet';

  // Powders & Sachets
  if (/\b(sachets?|granules?)\b/i.test(lower)) return 'Sachet';
  if (/\b(powders?|poudres?)\b/i.test(lower)) return 'Powder';

  // Liquids
  if (/\b(elixirs?)\b/i.test(lower)) return 'Elixir';
  if (/\b(syrups?|sirops?)\b/i.test(lower)) return 'Syrup';
  if (/\bsuspensions?\b/i.test(lower)) return 'Suspension';
  if (/\b(solutions?|buvables?|solute)\b/i.test(lower)) return 'Solution';

  // Fallback: format clean custom form
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Returns the 24 canonical pharmaceutical forms plus any valid custom forms from settings,
 * deduplicated case-insensitively and sorted alphabetically.
 */
export function getStandardPharmaceuticalForms(customForms?: string[]): string[] {
  const formsSet = new Set<string>(CANONICAL_PHARMACEUTICAL_FORMS);

  if (customForms && Array.isArray(customForms)) {
    customForms.forEach((raw) => {
      if (!raw || !raw.trim()) return;
      const normalized = normalizePharmaceuticalForm(raw.trim());
      // If it normalized to one of the 24, it's already in formsSet!
      // Only truly novel custom forms get added:
      if (!isCanonicalPharmaceuticalForm(normalized)) {
        formsSet.add(normalized);
      }
    });
  }

  return Array.from(formsSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}
