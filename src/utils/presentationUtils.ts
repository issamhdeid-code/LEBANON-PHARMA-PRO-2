/**
 * Pharmaceutical Presentation Standardization Utility
 * Standardizes packaging/presentation formats, deduplicating unit counts,
 * container types (Vial, Ampoule, Bottle, Tube, Syringe, Pen, Sachet),
 * volumes (ml, L), weights (g), and oral unit counts.
 */

export const CANONICAL_PRESENTATIONS = [
  '1 Vial',
  '2 Vials',
  '5 Vials',
  '10 Vials',
  '1 Ampoule',
  '5 Ampoules',
  '10 Ampoules',
  '1 Prefilled Syringe',
  '2 Prefilled Syringes',
  '1 Prefilled Pen',
  '5ml',
  '10ml',
  '15ml',
  '20ml',
  '30ml',
  '50ml',
  '60ml',
  '100ml',
  '120ml',
  '150ml',
  '200ml',
  '250ml',
  '500ml',
  '1000ml',
  '5g',
  '10g',
  '15g',
  '20g',
  '30g',
  '40g',
  '50g',
  '60g',
  '100g',
  '1 Sachet',
  '10 Sachets',
  '12 Sachets',
  '20 Sachets',
  '30 Sachets',
  '4',
  '7',
  '10',
  '14',
  '15',
  '16',
  '20',
  '21',
  '24',
  '28',
  '30',
  '40',
  '50',
  '56',
  '60',
  '84',
  '90',
  '100',
  '120',
] as const;

export type CanonicalPresentation = (typeof CANONICAL_PRESENTATIONS)[number];

const CANONICAL_PRESENTATIONS_SET = new Set<string>(
  CANONICAL_PRESENTATIONS.map((p) => p.toLowerCase())
);

/**
 * Checks if a presentation is in the canonical list (case-insensitive).
 */
export function isCanonicalPresentation(pres: string | undefined | null): boolean {
  if (!pres) return false;
  return CANONICAL_PRESENTATIONS_SET.has(pres.trim().toLowerCase());
}

/**
 * Normalizes any presentation string into a standardized, deduplicated format.
 * Examples:
 * - "1Vial", "1 vial", "1  Vial" -> "1 Vial"
 * - "10Vials", "10 vials", "10 Vials", "Box of 10Vials" -> "10 Vials"
 * - "5Ampoules", "5 ampoules", "5 Ampoules" -> "5 Ampoules"
 * - "100 ML", "100ml" -> "100ml"
 * - "30 G", "30g" -> "30g"
 * - "30 Tablets", "Box of 30", "30 (3x10)" -> "30"
 * - "Box of 24 tablets" -> "24"
 * - "Tube de 15g", "Tube of 15g" -> "15g"
 */
export function normalizePresentation(
  raw: string | undefined | null,
  fallback = ''
): string {
  if (!raw || typeof raw !== 'string') return fallback;
  let str = raw.trim();
  if (!str) return fallback;

  // Strip trailing punctuation
  str = str.replace(/[.,;:]+$/, '').trim();

  // 1. Remove French/English redundant wrapping prefixes like "Box of", "Boite de", "Pack of"
  const boxMatch = str.match(/^(?:box\s+of|boite\s+de|pack\s+of|packet\s+of)\s+(.+)$/i);
  if (boxMatch) {
    str = boxMatch[1].trim();
  }

  // 2. Tube of Xg / Tube de Xg -> Xg
  const tubeMatch = str.match(/^tube\s+(?:of|de)\s+(\d+(?:\.\d+)?\s*g)\b/i);
  if (tubeMatch) {
    return normalizePresentation(tubeMatch[1], fallback);
  }

  // 3. Flacon de Xml / Bottle of Xml -> Xml
  const flaconMatch = str.match(/^(?:flacon|bottle)\s+(?:of|de)\s+(\d+(?:\.\d+)?\s*ml)\b/i);
  if (flaconMatch) {
    return normalizePresentation(flaconMatch[1], fallback);
  }

  // 4. Vials: e.g. "1Vial", "1 vial", "10Vials", "10 vials"
  const vialMatch = str.match(/^(\d+)\s*vials?(?:\s+for\s+single\s+use)?$/i);
  if (vialMatch) {
    const count = parseInt(vialMatch[1], 10);
    return count === 1 ? '1 Vial' : `${count} Vials`;
  }

  // 5. Ampoules: e.g. "5Ampoules", "5 ampoules", "10Ampoules"
  const ampMatch = str.match(/^(\d+)\s*ampoules?$/i);
  if (ampMatch) {
    const count = parseInt(ampMatch[1], 10);
    return count === 1 ? '1 Ampoule' : `${count} Ampoules`;
  }

  // 6. Prefilled Syringes / Pens: e.g. "1Prefilled syringe", "2prefilled pens"
  const syringeMatch = str.match(/^(\d+)\s*pre-?filled\s+syringes?$/i);
  if (syringeMatch) {
    const count = parseInt(syringeMatch[1], 10);
    return count === 1 ? '1 Prefilled Syringe' : `${count} Prefilled Syringes`;
  }
  const penMatch = str.match(/^(\d+)\s*pre-?filled\s+pens?$/i);
  if (penMatch) {
    const count = parseInt(penMatch[1], 10);
    return count === 1 ? '1 Prefilled Pen' : `${count} Prefilled Pens`;
  }

  // 7. Sachets: e.g. "12 Sachets", "12sachets", "30Sachets"
  const sachetMatch = str.match(/^(\d+)\s*sachets?$/i);
  if (sachetMatch) {
    const count = parseInt(sachetMatch[1], 10);
    return count === 1 ? '1 Sachet' : `${count} Sachets`;
  }

  // 8. Volumes: "100 ml", "100ML", "100ml", "1.000ml"
  const mlMatch = str.match(/^(\d+(?:\.\d+)?)\s*ml$/i);
  if (mlMatch) {
    const val = mlMatch[1];
    return `${val}ml`;
  }

  // 9. Weights: "30 g", "30G", "30g"
  const gMatch = str.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  if (gMatch) {
    const val = gMatch[1];
    return `${val}g`;
  }

  // 10. Liters: "1 l", "10 l", "7.5l"
  const lMatch = str.match(/^(\d+(?:\.\d+)?)\s*l$/i);
  if (lMatch) {
    const val = lMatch[1];
    return `${val}L`;
  }

  // 11. Plain count of solid dosage forms:
  // e.g. "30 Tablets", "24 Film-Coated Tablets", "30 Heart-Shaped Tablets",
  // "28 Gastro-Resistant Tablets", "24 Caplets", "30 (3x10)", "Box of 30 tablets"
  const solidUnitsMatch = str.match(
    /^(\d+)\s*(?:film-coated\s+|gastro-resistant\s+|heart-shaped\s+|effervescent\s+|softgel\s+)?(?:tablets?|comprim[eé]s?|capsules?|g[eé]lules?|caplets?|pills?)(?:\s*\(.*\))?$/i
  );
  if (solidUnitsMatch) {
    return solidUnitsMatch[1];
  }

  const blisterCountMatch = str.match(/^(\d+)\s*\(\s*\d+\s*[xX]\s*\d+\s*\)$/);
  if (blisterCountMatch) {
    return blisterCountMatch[1];
  }

  // Plain integers: "30", "28", "100"
  if (/^\d+$/.test(str)) {
    return str;
  }

  // Exact canonical match check (case-insensitive)
  const exact = CANONICAL_PRESENTATIONS.find(
    (c) => c.toLowerCase() === str.toLowerCase()
  );
  if (exact) return exact;

  // Clean title-cased or trimmed string as fallback
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Returns the canonical presentations plus any custom presentations from settings,
 * deduplicated case-insensitively and sorted naturally.
 */
export function getStandardPresentations(customPresentations?: string[]): string[] {
  const map = new Map<string, string>();

  // Add all canonical presentations
  CANONICAL_PRESENTATIONS.forEach((p) => {
    map.set(p.toLowerCase(), p);
  });

  // Add custom presentations from settings
  if (customPresentations && Array.isArray(customPresentations)) {
    customPresentations.forEach((raw) => {
      if (!raw || !raw.trim()) return;
      const normalized = normalizePresentation(raw.trim());
      if (normalized && !map.has(normalized.toLowerCase())) {
        map.set(normalized.toLowerCase(), normalized);
      }
    });
  }

  // Sort with natural sorting (numbers ascending, words alphabetically)
  return Array.from(map.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}
