import { ProductCategory, Product } from '../types/pharmacy';

export const STANDARD_SUBCATEGORIES: Record<ProductCategory, string[]> = {
  para: [
    'Baby Products',
    'First Aid & Wound Care',
    'Medical Devices & Diagnostics',
    'Oral & Dental Care',
    'Orthopedic & Support',
    'Sexual Health & Family Planning',
    'Personal Hygiene & Sanitizers',
    'Incontinence & Adult Care',
    'Eye & Ear Care',
    'Mother & Maternity Care',
    'Thermometers & Monitoring',
  ],
  vitamins: [
    'Vitamin D Supplements',
    'Multivitamins & Minerals',
    'Vitamin C & Antioxidants',
    'B-Complex & Energy',
    'Calcium & Bone Health',
    'Iron & Blood Health',
    'Omega-3 & Fish Oils',
    'Joint Support & Collagen',
    'Immunity & Defense',
    'Hair, Skin & Nails',
    'Probiotics & Digestion',
    'Sports & Amino Acids',
    'Magnesium & Sleep',
    'Herbal & Plant Extracts',
  ],
  cosmetics: [
    'Skincare & Face Care',
    'Sunscreen & Sun Protection',
    'Dermocosmetics & Sensitive Skin',
    'Anti-Aging & Serums',
    'Hair Care & Shampoos',
    'Acne & Blemish Treatments',
    'Body Care & Moisturizers',
    'Eye Contour Care',
    'Lip Care & Balms',
    'Cleansers & Toners',
  ],
  drug: [
    'Analgesics & Pain Relief',
    'Antibiotics & Anti-Infectives',
    'Cardiovascular & Hypertension',
    'Gastrointestinal & Digestive',
    'Respiratory, Cough & Allergy',
    'Diabetes & Endocrine',
    'CNS & Neurological',
    'Dermatological Medicines',
    'Ophthalmic & ENT',
    'Pediatric Medicines',
    'Hormones & Gynecology',
    'Urological & Kidney Care',
  ],
};

/**
 * Returns all available subcategories for a given category, combining
 * standard predefined subcategories with any custom subcategories
 * currently in use across the stock products.
 */
export function getSubcategoryOptions(
  category: ProductCategory | 'all',
  products: Product[] = [],
  customGlobalSubcategories: string[] = []
): string[] {
  const result = new Set<string>();

  if (category === 'all') {
    Object.values(STANDARD_SUBCATEGORIES).forEach((list) => {
      list.forEach((sub) => result.add(sub));
    });
  } else {
    (STANDARD_SUBCATEGORIES[category] || []).forEach((sub) => result.add(sub));
  }

  // Add global custom subcategories
  customGlobalSubcategories.forEach((sub) => result.add(sub.trim()));

  // Add any custom subcategories currently assigned to products
  products.forEach((p) => {
    if (p.subcategory && p.subcategory.trim()) {
      if (category === 'all' || p.category === category) {
        result.add(p.subcategory.trim());
      }
    }
  });

  return Array.from(result).sort((a, b) => a.localeCompare(b));
}

/**
 * Intelligently suggests a subcategory based on product name, active ingredient,
 * and category. For example:
 * - "Maxi-D" / "Vitamin D3" -> "Vitamin D Supplements"
 * - "Baby bottle" / "Feeding bottle" / "Chicco bottle" -> "Baby Products"
 */
export function suggestSubcategory(
  name: string,
  category: ProductCategory,
  ingredients?: string
): string | undefined {
  const text = `${name || ''} ${ingredients || ''}`.toLowerCase();

  if (category === 'vitamins') {
    if (text.includes('maxi-d') || text.includes('maxi d') || text.includes('vitamin d') || text.includes('cholecalciferol') || text.includes('d3') || text.includes('d-drop') || text.includes('biod3')) {
      return 'Vitamin D Supplements';
    }
    if (text.includes('omega') || text.includes('fish oil') || text.includes('dha') || text.includes('epa')) {
      return 'Omega-3 & Fish Oils';
    }
    if (text.includes('iron') || text.includes('ferrous') || text.includes('fer') || text.includes('folic')) {
      return 'Iron & Blood Health';
    }
    if (text.includes('calcium') || text.includes('osteocare') || text.includes('calcichew')) {
      return 'Calcium & Bone Health';
    }
    if (text.includes('vitamin c') || text.includes('ascorbic') || text.includes('zinc')) {
      return 'Vitamin C & Antioxidants';
    }
    if (text.includes('collagen') || text.includes('glucosamine') || text.includes('chondroitin') || text.includes('joint')) {
      return 'Joint Support & Collagen';
    }
    if (text.includes('hair') || text.includes('biotin') || text.includes('nail')) {
      return 'Hair, Skin & Nails';
    }
    if (text.includes('probiotic') || text.includes('flora') || text.includes('digest')) {
      return 'Probiotics & Digestion';
    }
    if (text.includes('magnesium') || text.includes('sleep') || text.includes('melatonin')) {
      return 'Magnesium & Sleep';
    }
    if (text.includes('multi') || text.includes('pharmaton') || text.includes('centrum') || text.includes('supradyn')) {
      return 'Multivitamins & Minerals';
    }
  }

  if (category === 'para') {
    if (
      text.includes('bottle') ||
      text.includes('feeding') ||
      text.includes('baby') ||
      text.includes('nipple') ||
      text.includes('pacifier') ||
      text.includes('bebe') ||
      text.includes('teat') ||
      text.includes('avent') ||
      text.includes('chicco') ||
      text.includes('nuk')
    ) {
      return 'Baby Products';
    }
    if (text.includes('plaster') || text.includes('bandage') || text.includes('gauze') || text.includes('wound') || text.includes('compress') || text.includes('dressing')) {
      return 'First Aid & Wound Care';
    }
    if (text.includes('tension') || text.includes('blood pressure') || text.includes('thermometer') || text.includes('glucometer') || text.includes('strips') || text.includes('lancet')) {
      return 'Medical Devices & Diagnostics';
    }
    if (text.includes('tooth') || text.includes('dental') || text.includes('brush') || text.includes('floss') || text.includes('denture') || text.includes('parodontax')) {
      return 'Oral & Dental Care';
    }
    if (text.includes('condom') || text.includes('lubricant') || text.includes('pregnancy test') || text.includes('durex')) {
      return 'Sexual Health & Family Planning';
    }
    if (text.includes('orthopedic') || text.includes('knee') || text.includes('splint') || text.includes('brace') || text.includes('collar')) {
      return 'Orthopedic & Support';
    }
    if (text.includes('diaper') || text.includes('incontinence') || text.includes('tena') || text.includes('underpad')) {
      return 'Incontinence & Adult Care';
    }
  }

  if (category === 'cosmetics') {
    if (text.includes('sun') || text.includes('spf') || text.includes('solar') || text.includes('uv') || text.includes('sunscreen')) {
      return 'Sunscreen & Sun Protection';
    }
    if (text.includes('acne') || text.includes('blemish') || text.includes('effaclar') || text.includes('keracnyl') || text.includes('sebium')) {
      return 'Acne & Blemish Treatments';
    }
    if (text.includes('shampoo') || text.includes('conditioner') || text.includes('hair') || text.includes('keratin')) {
      return 'Hair Care & Shampoos';
    }
    if (text.includes('serum') || text.includes('anti-aging') || text.includes('wrinkle') || text.includes('hyaluronic') || text.includes('retinol')) {
      return 'Anti-Aging & Serums';
    }
    if (text.includes('cream') || text.includes('moisturizer') || text.includes('hydra') || text.includes('lotion')) {
      return 'Skincare & Face Care';
    }
  }

  if (category === 'drug') {
    if (text.includes('paracetamol') || text.includes('panadol') || text.includes('ibuprofen') || text.includes('advil') || text.includes('cataflam') || text.includes('voltaren') || text.includes('pain') || text.includes('ketorolac')) {
      return 'Analgesics & Pain Relief';
    }
    if (text.includes('amoxicillin') || text.includes('augmentin') || text.includes('cipro') || text.includes('azithromycin') || text.includes('antibiotic') || text.includes('cefixime')) {
      return 'Antibiotics & Anti-Infectives';
    }
    if (text.includes('cough') || text.includes('syrup') || text.includes('bronch') || text.includes('allergy') || text.includes('cetirizine') || text.includes('antihistamine') || text.includes('aerius')) {
      return 'Respiratory, Cough & Allergy';
    }
    if (text.includes('omeprazole') || text.includes('pantoprazole') || text.includes('antacid') || text.includes('gaviscon') || text.includes('spasm')) {
      return 'Gastrointestinal & Digestive';
    }
    if (text.includes('concor') || text.includes('amlodipine') || text.includes('atorvastatin') || text.includes('lipitor') || text.includes('hypertension')) {
      return 'Cardiovascular & Hypertension';
    }
    if (text.includes('metformin') || text.includes('gluco') || text.includes('insulin') || text.includes('januvia') || text.includes('diabetes')) {
      return 'Diabetes & Endocrine';
    }
  }

  return undefined;
}
