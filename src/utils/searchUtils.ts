import { Product, ProductCategory } from '../types/pharmacy';

// Arabic Tashkeel (diacritics) regex
const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/g;

// Arabic digits to Western digits
const ARABIC_INDIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

// Lebanese & Arab Pharmacy Arabic-to-English brand and term mapping
const PHARMA_ARABIC_DICTIONARY: Record<string, string[]> = {
  // Common Brands in Lebanon
  'بنادول': ['panadol', 'paracetamol'],
  'بانادول': ['panadol', 'paracetamol'],
  'بندول': ['panadol', 'paracetamol'],
  'ادفانس': ['advance'],
  'أدفانس': ['advance'],
  'ادفنس': ['advance'],
  'اكسترا': ['extra'],
  'إكسترا': ['extra'],
  'نايت': ['night'],
  'كولد': ['cold'],
  'فلو': ['flu'],
  'سينوس': ['sinus'],
  'اوغمنتين': ['augmentin', 'amoxicillin'],
  'اوجمنتين': ['augmentin', 'amoxicillin'],
  'اوكمنتين': ['augmentin', 'amoxicillin'],
  'كونكور': ['concor', 'bisoprolol'],
  'بروفين': ['brufen', 'ibuprofen'],
  'بروفن': ['brufen', 'ibuprofen'],
  'فولتارين': ['voltaren', 'diclofenac'],
  'فولتارن': ['voltaren', 'diclofenac'],
  'دوليبران': ['doliprane', 'paracetamol'],
  'دولبران': ['doliprane', 'paracetamol'],
  'فلاجيل': ['flagyl', 'metronidazole'],
  'كاتافلام': ['cataflam', 'diclofenac'],
  'كتافلام': ['cataflam', 'diclofenac'],
  'ادفل': ['advil', 'ibuprofen'],
  'أدفيل': ['advil', 'ibuprofen'],
  'ادفيل': ['advil', 'ibuprofen'],
  'ليبيتور': ['lipitor', 'atorvastatin'],
  'نكسيوم': ['nexium', 'esomeprazole'],
  'نيكسيوم': ['nexium', 'esomeprazole'],
  'اموكسيل': ['amoxil', 'amoxicillin'],
  'اموكسيسيلين': ['amoxicillin'],
  'باراسيتامول': ['paracetamol'],
  'اسبيرين': ['aspirin'],
  'اسبرين': ['aspirin'],
  'زيثروماكس': ['zithromax', 'azithromycin'],
  'ازيترومايسين': ['azithromycin'],
  'بلافيكس': ['plavix', 'clopidogrel'],
  'كريستور': ['crestor', 'rosuvastatin'],
  'غلوكوفاج': ['glucophage', 'metformin'],
  'جلوكوفاج': ['glucophage', 'metformin'],
  'سيلسيبت': ['cellcept', 'mycophenolate'],
  'بريدنيزون': ['prednisone'],
  'كورتيزون': ['cortisone'],
  'سولبادين': ['solpadeine'],
  'بانادولين': ['panadol'],
  'بانتوبرازول': ['pantoprazole', 'controloc'],
  'كونترولوك': ['controloc', 'pantoprazole'],
  'سيبروفلوكساسين': ['ciprofloxacin', 'cipro'],
  'سيبرو': ['cipro'],
  'سيتريزين': ['cetirizine', 'zyrtec'],
  'زيرتيك': ['zyrtec', 'cetirizine'],
  'كلاريتين': ['claritin', 'loratadine'],
  'لوراتادين': ['loratadine'],
  'فيتامين': ['vitamin'],
  'اوميغا': ['omega'],
  'اوميجا': ['omega'],
  'زنك': ['zinc'],
  'حديد': ['iron'],
  'كالسيوم': ['calcium'],
  'ماغنيزيوم': ['magnesium'],
  'مغنيسيوم': ['magnesium'],

  // Forms and presentations
  'حبوب': ['tablet', 'tablets', 'tab'],
  'حب': ['tablet', 'tablets', 'tab'],
  'اقراص': ['tablets', 'tablet', 'tab'],
  'أقراص': ['tablets', 'tablet', 'tab'],
  'شراب': ['syrup'],
  'قطرة': ['drops', 'drop'],
  'قطرات': ['drops'],
  'بخاخ': ['spray'],
  'مرهم': ['ointment'],
  'كريم': ['cream'],
  'جل': ['gel'],
  'كبسول': ['capsule', 'cap'],
  'كبسولات': ['capsules', 'capsule', 'cap'],
  'فوار': ['effervescent'],
  'حقن': ['injection'],
  'ابرة': ['ampoule', 'injection'],
  'إبرة': ['ampoule', 'injection'],
  'اطفال': ['children', 'pediatric'],
  'أطفال': ['children', 'pediatric'],
  'رضع': ['infant'],

  // Units
  'مغ': ['mg'],
  'ملغ': ['mg'],
  'غ': ['g', '1g'],
  'غم': ['g'],
  'مل': ['ml'],
};

/**
 * Normalizes Arabic text by unifying Alefs, Yaas, Taa Marbuta, removing Tashkeel,
 * and converting Arabic-Indic digits to standard 0-9.
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  let s = text.toLowerCase();

  // Convert Arabic-Indic numbers to Western digits
  s = s.replace(/[٠-٩]/g, (d) => ARABIC_INDIC_DIGITS[d] || d);

  // Remove diacritics
  s = s.replace(ARABIC_DIACRITICS_REGEX, '');

  // Normalize Alefs (أ, إ, آ, ا) -> ا
  s = s.replace(/[أإآا]/g, 'ا');

  // Normalize Yaa / Alef Maqsura (ى, ي) -> ي
  s = s.replace(/[ىي]/g, 'ي');

  // Normalize Taa Marbuta (ة, ه) -> ه
  s = s.replace(/[ةه]/g, 'ه');

  return s.trim();
}

/**
 * Phonetic transliteration from Arabic letters to Latin characters
 * for common pharmaceutical spelling variations.
 */
export function transliterateArabicToLatin(arabicText: string): string[] {
  const norm = normalizeArabic(arabicText);
  if (!norm) return [];

  // Mapping letters to possible latin sounds
  const charMap: Record<string, string[]> = {
    'ا': ['a', 'e', 'o', ''],
    'ب': ['b', 'p'],
    'ت': ['t'],
    'ث': ['th', 's'],
    'ج': ['g', 'j'],
    'ح': ['h'],
    'خ': ['kh'],
    'د': ['d'],
    'ذ': ['z', 'th'],
    'ر': ['r'],
    'ز': ['z'],
    'س': ['s', 'c'],
    'ش': ['sh', 'ch'],
    'ص': ['s'],
    'ض': ['d'],
    'ط': ['t'],
    'ظ': ['z'],
    'ع': ['a', 'e', ''],
    'غ': ['gh', 'g'],
    'ف': ['f', 'v', 'ph'],
    'ق': ['k', 'q'],
    'ك': ['k', 'c'],
    'ل': ['l'],
    'م': ['m'],
    'ن': ['n'],
    'ه': ['h'],
    'و': ['o', 'u', 'w', 'ou', 'oo'],
    'ي': ['i', 'y', 'e', 'ee'],
  };

  // Generate a primary phonetically transliterated string
  let primary = '';
  for (let i = 0; i < norm.length; i++) {
    const ch = norm[i];
    if (charMap[ch]) {
      primary += charMap[ch][0];
    } else {
      primary += ch;
    }
  }

  // Generate an alternate string swapping 'b' -> 'p' (vital for Arab speakers typing Panadol as بنادول)
  const alternateWithP = primary.replace(/b/g, 'p');
  const alternateWithC = primary.replace(/k/g, 'c');

  return Array.from(new Set([primary, alternateWithP, alternateWithC])).filter(Boolean);
}

/**
 * Generates all search variants for a single token:
 * includes raw token, Arabic normalized, dictionary matches, and transliterated variants.
 */
export function getTokenVariants(rawToken: string): string[] {
  const clean = rawToken.trim().toLowerCase();
  if (!clean) return [];

  const variants = new Set<string>();
  variants.add(clean);

  // Check if token has Arabic characters
  const isArabic = /[\u0600-\u06FF]/.test(clean);
  if (isArabic) {
    const normArabic = normalizeArabic(clean);
    variants.add(normArabic);

    // 1. Direct dictionary matches
    if (PHARMA_ARABIC_DICTIONARY[clean]) {
      PHARMA_ARABIC_DICTIONARY[clean].forEach((v) => variants.add(v));
    }
    if (PHARMA_ARABIC_DICTIONARY[normArabic]) {
      PHARMA_ARABIC_DICTIONARY[normArabic].forEach((v) => variants.add(v));
    }

    // 2. Transliteration matches
    const transliterated = transliterateArabicToLatin(clean);
    transliterated.forEach((v) => variants.add(v));
  } else {
    // English/Latin token: handle common endings like 1g -> 1, 500mg -> 500
    if (/^\d+g$/.test(clean)) {
      variants.add(clean.replace('g', ''));
    } else if (/^\d+mg$/.test(clean)) {
      variants.add(clean.replace('mg', ''));
    }
  }

  return Array.from(variants).filter((v) => v.length > 0);
}

/**
 * Checks whether a single token (or any of its variants) matches a target string.
 */
function tokenMatchesTarget(tokenVariants: string[], targetString: string, targetNormArabic: string): boolean {
  for (const variant of tokenVariants) {
    if (targetString.includes(variant) || targetNormArabic.includes(variant)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds a normalized, comprehensive searchable string for a Product.
 */
export function buildProductSearchPayload(product: Product): {
  latinText: string;
  arabicText: string;
  nameOnly: string;
} {
  const nameOnly = (product.name || '').toLowerCase();
  const code = (product.code || '').toLowerCase();
  const barcode = (product.barcode || '').toLowerCase();
  const ingredients = (product.ingredients || '').toLowerCase();
  const dosage = (product.dosage || '').toLowerCase();
  const form = (product.form || '').toLowerCase();
  const presentation = (product.presentation || '').toLowerCase();
  const agent = (product.agent || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  const generics = (product.scientificInfo?.generics || []).join(' ').toLowerCase();

  const latinText = `${nameOnly} ${code} ${barcode} ${ingredients} ${dosage} ${form} ${presentation} ${agent} ${category} ${generics}`;
  const arabicText = normalizeArabic(latinText);

  return {
    latinText,
    arabicText,
    nameOnly,
  };
}

/**
 * Filter and rank products by multi-word query and category.
 * Supports multiple words in Arabic or English, e.g.:
 * - "بنادول" -> matches all Panadol products
 * - "بنادول أدفانس" -> matches "Panadol Advance"
 * - "panadol advance" -> matches "Panadol Advance"
 * - "panadol 500" -> matches "Panadol Extra 500mg", "Panadol Advance 500mg"
 * - "augmentin 1" -> matches "Augmentin 1g"
 */
export function filterProductsByMultiWordQuery(
  products: Product[],
  searchQuery: string,
  selectedCategory: ProductCategory | 'all' = 'all'
): Product[] {
  const query = searchQuery.trim();
  const rawTokens = query.split(/\s+/).filter(Boolean);

  // If no search query, filter only by category
  if (rawTokens.length === 0) {
    if (selectedCategory === 'all') {
      return products;
    }
    return products.filter((p) => p.category === selectedCategory);
  }

  // Pre-generate token variants for each word
  const tokenVariantsList = rawTokens.map((tok) => getTokenVariants(tok));
  const fullQueryLower = query.toLowerCase();
  const fullQueryNormArabic = normalizeArabic(query);

  const matchedWithScores: { product: Product; score: number }[] = [];

  for (const product of products) {
    // 1. Category check
    if (selectedCategory !== 'all' && product.category !== selectedCategory) {
      continue;
    }

    // 2. Barcode or code exact match priority
    const cleanBarcode = (product.barcode || '').toLowerCase();
    const cleanCode = (product.code || '').toLowerCase();
    if (cleanBarcode === fullQueryLower || cleanCode === fullQueryLower) {
      matchedWithScores.push({ product, score: 1000 });
      continue;
    }

    const { latinText, arabicText, nameOnly } = buildProductSearchPayload(product);

    // 3. Multi-token requirement: EVERY token must match
    let allTokensMatch = true;
    for (const variants of tokenVariantsList) {
      if (!tokenMatchesTarget(variants, latinText, arabicText)) {
        allTokensMatch = false;
        break;
      }
    }

    if (!allTokensMatch) {
      continue;
    }

    // 4. Calculate relevance score for ranking
    let score = 50;

    // Direct substring in product name
    if (nameOnly.startsWith(fullQueryLower) || arabicText.startsWith(fullQueryNormArabic)) {
      score += 100;
    } else if (nameOnly.includes(fullQueryLower)) {
      score += 60;
    }

    // First token starts name
    if (tokenVariantsList[0]) {
      for (const firstVar of tokenVariantsList[0]) {
        if (nameOnly.startsWith(firstVar)) {
          score += 40;
          break;
        }
      }
    }

    // All tokens appear in name
    let allInName = true;
    for (const variants of tokenVariantsList) {
      const inName = variants.some((v) => nameOnly.includes(v));
      if (!inName) {
        allInName = false;
        break;
      }
    }
    if (allInName) {
      score += 35;
    }

    // In stock gets bonus
    if (product.stockQuantity > 0) {
      score += 15;
    }

    matchedWithScores.push({ product, score });
  }

  // Sort by score descending, then by name alphabetically
  matchedWithScores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.product.name.localeCompare(b.product.name);
  });

  return matchedWithScores.map((item) => item.product);
}
