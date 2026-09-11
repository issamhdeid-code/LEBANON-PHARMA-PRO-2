const API_BASE = '';

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

export async function fetchMOPHPriceList(): Promise<MOPHPriceListRow[]> {
  const response = await fetch(`${API_BASE}/api/moph/price-list`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch MOPH price list (${response.status})`);
  }

  const result = await response.json();
  return Array.isArray(result) ? result : [];
}

export interface MOPHLNDDIngredientResult {
  name: string;
  dosage: string;
  form: string;
  ingredients: string;
}

export interface MOPHTimestamp {
  unixMs: number;
  trusted: boolean;
}

export async function fetchMOPHNow(): Promise<MOPHTimestamp> {
  const response = await fetch(`${API_BASE}/api/moph/now`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch current time (${response.status})`);
  }

  const data = await response.json();
  return {
    unixMs: Number(data?.unixMs) || 0,
    trusted: data?.trusted !== false,
  };
}

export async function fetchMOPHLNDDIngredients(
  items: Array<{ name: string; dosage: string; form: string }>
): Promise<MOPHLNDDIngredientResult[]> {
  const response = await fetch(`${API_BASE}/api/moph/lndd-ingredients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch ingredients (${response.status})`);
  }

  const result = await response.json();
  return Array.isArray(result) ? result : [];
}