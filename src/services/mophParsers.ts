// Pure parsing helpers for MOPH data sources (official price-list XLS + LNDD
// drug database search HTML). No Node-specific deps so it can be unit-tested.

export interface MOPHPriceListRow {
  code: number | string;
  registrationNumber: string;
  brandName: string;
  strength: string;
  presentation: string;
  form: string;
  agent: string;
  manufacturer: string;
  country: string;
  publicPriceLBP: number | null;
  pharmacistMargin: number | null;
  stratum: string;
}

export interface LnddRow {
  viewId: string;
  atc: string;
  name: string;
  bg: string;
  ingredients: string;
  dosage: string;
  form: string;
  priceText: string;
}

export function stripTrailingComma(text: string): string {
  return text.replace(/[,\s]+$/, '').trim();
}

export function parseXlsPriceNumber(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  const cleaned = stripTrailingComma(String(val)).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isFinite(num) ? num : null;
}

export function normalizeLnddName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9%]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function lnddRowSignature(name: string, dosage: string): string {
  return `${normalizeLnddName(name)}|${dosage.trim().toUpperCase()}`;
}

// Search results are <tr> rows whose cells link to /en/Drugs/view/<id>.
// The price <td> spans multiple lines, so the matches MUST use the 's' flag
// ('.' crosses newlines) — without it the row regex never matches.
export function parseLnddSearchTable(html: string): LnddRow[] {
  const rows: LnddRow[] = [];
  const rowRe = /<tr>\s*<td><a href="\/en\/Drugs\/view\/(\d+)"[^>]*>(.*?)<\/a><\/td>(.*?)<\/tr>/gis;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const viewId = m[1];
    const atc = stripTrailingComma(m[2].replace(/<[^>]+>/g, '')) || '';
    const rest = m[3];
    const cells = Array.from(rest.matchAll(/<td[^>]*>(.*?)<\/td>/gis)).map(c => c[1]);
    if (cells.length < 6) continue;
    const cellText = (idx: number) => stripTrailingComma(cells[idx].replace(/<[^>]+>/g, '')) || '';
    rows.push({
      viewId,
      atc,
      name: cellText(0),
      bg: cellText(1),
      ingredients: cellText(2),
      dosage: cellText(3),
      form: cellText(4),
      priceText: cellText(5),
    });
  }
  return rows;
}

// Best-effort match of a searched drug against LNDD search rows.
// Exact name scores highest; dosage/form add precision on top.
export function pickBestIngredient(
  rows: LnddRow[],
  name: string,
  dosage: string,
  form: string
): string {
  const targetName = normalizeLnddName(name);
  const targetDosage = dosage.trim().toUpperCase();
  const targetForm = form.trim().toUpperCase();

  let matchedIngredients = '';
  let bestScore = -1;
  for (const row of rows) {
    if (!row.ingredients) continue;
    let score = 0;
    const rowName = normalizeLnddName(row.name);
    if (rowName === targetName) score += 100;
    else if (rowName.includes(targetName) || targetName.includes(rowName)) score += 50;
    else continue;
    if (row.dosage.trim().toUpperCase() === targetDosage) score += 20;
    if (row.form.trim().toUpperCase() === targetForm) score += 10;
    if (score > bestScore) {
      bestScore = score;
      matchedIngredients = row.ingredients;
    }
  }
  return matchedIngredients;
}