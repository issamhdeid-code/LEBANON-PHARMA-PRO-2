import {
  Product,
  Supplier,
  Customer,
  SaleTransaction,
  PurchaseInvoice,
  PharmacySettings,
  User,
  AppNotification,
  SyncConflictLog,
  AppLogEntry
} from '../types/pharmacy';
import { resolveStraightforwardScientificInfo } from './scientificDataService';
import { idbStorage } from './indexedDbStorage';

export const DEFAULT_EXCHANGE_RATE = 89500; // 89,500 L.L. per 1 USD

export const INITIAL_SETTINGS: PharmacySettings = {
  pharmacyName: 'Pharmacie Al-Arz (Cedar Pharmacy)',
  pharmacyPhone: '+961 1 740 000 / +961 3 123 456',
  pharmacyAddress: 'Hamra Main Street, Beirut, Lebanon',
  licenseNumber: 'LB-PH-4921/2026',
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  defaultCurrency: 'BOTH',
  theme: 'emerald',
  darkMode: false,
  fontSize: 'normal',
  appZoom: 100,
  backupSchedule: 'manual',
  backupRetentionCount: 5,
  layoutStyle: 'standard',
  lowStockThreshold: 10,
  expiryWarningDays: 90,
  notificationsEnabled: true,
  notifyInventory: true,
  notifyExpiry: true,
  notifySync: true,
  notifySale: true,
  notifySystem: true,
  enableDesktopNotifications: true,
  deviceId: 'PC-1-COUNTER',
  deviceName: 'Counter 1 (Main POS)',
  syncRole: 'peer',
  syncServerUrl: 'http://192.168.1.150:3000/sync',
  autoSyncIntervalSec: 10,
  vatRates: {
    drug: 0,
    vitamins: 11,
    cosmetics: 11,
    para: 11,
  },
};

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    username: 'admin',
    password: 'admin',
    name: 'Dr. Tarek El-Khoury (Chief Pharmacist)',
    role: 'admin',
  },
  {
    id: 'user-staff',
    username: 'staff',
    password: 'admin',
    name: 'Maya Zein (Pharmacy Technician)',
    role: 'staff',
  },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-mersaco',
    code: 'SUP-MER',
    name: 'Mersaco Sal',
    contactPerson: 'Ziad Salameh',
    phone: '+961 1 890 200',
    email: 'orders@mersaco.com',
    address: 'Jisr El-Waty, Sin El-Fil, Beirut',
    balanceUSD: 1450.00,
    balanceLBP: 129775000,
    paymentTerms: '30 Days Net',
  },
  {
    id: 'sup-omnipharma',
    code: 'SUP-OMN',
    name: 'Omnipharma S.A.L.',
    contactPerson: 'Rita Boustany',
    phone: '+961 1 423 000',
    email: 'contact@omnipharma.com.lb',
    address: 'Badaro, Sami El Solh Avenue, Beirut',
    balanceUSD: 820.00,
    balanceLBP: 73390000,
    paymentTerms: '45 Days Net',
  },
  {
    id: 'sup-fattal',
    code: 'SUP-FAT',
    name: 'Khalil Fattal & Fils',
    contactPerson: 'Marc Haddad',
    phone: '+961 1 511 888',
    email: 'pharma@fattal.com.lb',
    address: 'Fattal Building, Sin El-Fil',
    balanceUSD: 510.50,
    balanceLBP: 45689750,
    paymentTerms: 'Immediate / Cash on Delivery',
  },
  {
    id: 'sup-union',
    code: 'SUP-UNI',
    name: "Droguerie de l'Union",
    contactPerson: 'Hala Gemayel',
    phone: '+961 1 612 345',
    email: 'sales@droguerieunion.com',
    address: 'Dekwaneh Industrial Zone, Mount Lebanon',
    balanceUSD: 0,
    balanceLBP: 0,
    paymentTerms: '60 Days Net',
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Elie Abi Chahine',
    phone: '+961 70 123 456',
    address: 'Ras Beirut, Sadat St.',
    bloodType: 'A+',
    allergies: 'Penicillin (Amoxicillin severe rash)',
    chronicConditions: 'Hypertension, Dyslipidemia',
    balanceUSD: 0,
    balanceLBP: 0,
    loyaltyPoints: 140,
    lastVisit: '2026-08-28',
  },
  {
    id: 'cust-2',
    name: 'Rana Al-Husseini',
    phone: '+961 71 987 654',
    address: 'Verdun, Dunant Street',
    bloodType: 'O+',
    allergies: 'None reported',
    chronicConditions: 'Type 2 Diabetes',
    balanceUSD: 24.50,
    balanceLBP: 2192750,
    loyaltyPoints: 310,
    lastVisit: '2026-09-02',
  },
  {
    id: 'cust-3',
    name: 'Walid Machnouk',
    phone: '+961 03 445 566',
    address: 'Ashrafieh, Sassine',
    bloodType: 'B+',
    allergies: 'Sulfa drugs',
    chronicConditions: 'Asthma',
    balanceUSD: 0,
    balanceLBP: 0,
    loyaltyPoints: 85,
    lastVisit: '2026-09-03',
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  // --- CATEGORY: DRUG ---
  {
    id: 'prod-pan500',
    code: 'PAN500',
    name: 'Panadol Extra',
    category: 'drug',
    ingredients: 'Paracetamol + Caffeine',
    dosage: '500mg / 65mg',
    presentation: '24 Film-Coated Tablets (2 Blisters)',
    form: 'Tablet',
    
    priceLBP: 315000,
    priceUSD: 3.52,
    costPriceUSD: 2.88,
    pharmacistMarginProfit: 18.0,
    agent: 'Mersaco Sal',
    stockQuantity: 42,
    minStockAlert: 15,
    expiryDate: '2027-11-30',
    batchNumber: 'BT-88902A',
    updatedAt: Date.now() - 500000,
    version: 1,
    scientificInfo: {
      indications: 'Relief of mild to moderate pain (headache, migraine, muscular aches) and fever reduction.',
      contraindications: 'Severe hepatic impairment, hypersensitivity to paracetamol or caffeine.',
      sideEffects: 'Mild restlessness, insomnia due to caffeine, rare allergic skin rash.',
      generics: ['Adol Extra (Julphar)', 'Paramol Extra (Amman Pharma)', 'Doliprane 500 (Sanofi)', 'Panadol Advance'],
      dosage: 'Adults: 1 to 2 tablets every 4-6 hours as needed. Maximum 8 tablets in 24 hours.',
      
      form: 'Film-coated Tablet',
      presentation: 'Box of 24 tablets',
      activeIngredients: 'Paracetamol 500mg, Caffeine 65mg',
      pregnancyCategory: 'B',
      storageConditions: 'Store below 25°C in a dry place.',
    },
  },
  {
    id: 'prod-aug1g',
    code: 'AUG1G',
    name: 'Augmentin 1g',
    category: 'drug',
    ingredients: 'Amoxicillin Trihydrate + Potassium Clavulanate',
    dosage: '875mg / 125mg',
    presentation: '14 Film-Coated Tablets',
    form: 'Tablet',
    
    priceLBP: 895000,
    priceUSD: 10.00,
    costPriceUSD: 8.00,
    pharmacistMarginProfit: 20.0,
    agent: 'Omnipharma S.A.L.',
    stockQuantity: 18,
    minStockAlert: 8,
    expiryDate: '2027-04-15',
    batchNumber: 'AUG-7721C',
    updatedAt: Date.now() - 400000,
    version: 1,
    scientificInfo: {
      indications: 'Bacterial infections of respiratory tract, acute otitis media, sinusitis, skin/soft tissue.',
      contraindications: 'Severe penicillin hypersensitivity or history of amoxicillin-associated cholestatic jaundice.',
      sideEffects: 'Diarrhea, nausea, vomiting, candidiasis, mild abdominal discomfort.',
      generics: ['Curam 1000mg (Sandoz)', 'Klavox 1g (Spimaco)', 'Amoclan 1g (Hikma)', 'Megamox 1g'],
      dosage: 'Adults: 1 tablet twice daily with meals to optimize absorption and minimize GI upset.',
      
      form: 'Tablet',
      presentation: 'Box of 14 film-coated tablets in foil strips',
      activeIngredients: 'Amoxicillin 875mg, Clavulanic Acid 125mg',
      pregnancyCategory: 'B',
      storageConditions: 'Store below 25°C in original moisture-proof blister pack.',
    },
  },
  {
    id: 'prod-lip20',
    code: 'LIP20',
    name: 'Lipitor 20mg',
    category: 'drug',
    ingredients: 'Atorvastatin Calcium Trihydrate',
    dosage: '20mg',
    presentation: '30 Film-Coated Tablets',
    form: 'Tablet',
    
    priceLBP: 1253000,
    priceUSD: 14.00,
    costPriceUSD: 11.20,
    pharmacistMarginProfit: 20.0,
    agent: 'Khalil Fattal & Fils',
    stockQuantity: 24,
    minStockAlert: 10,
    expiryDate: '2027-08-20',
    batchNumber: 'LIP-0914F',
    updatedAt: Date.now() - 350000,
    version: 1,
    scientificInfo: {
      indications: 'Primary hypercholesterolemia, mixed dyslipidemia, and prevention of cardiovascular events.',
      contraindications: 'Active liver disease, unexplained persistent serum transaminase elevation, pregnancy.',
      sideEffects: 'Nasopharyngitis, arthralgia, diarrhea, dyspepsia, mild myalgia.',
      generics: ['Atorva 20mg (Zydus)', 'Torvast 20mg', 'Liponorm 20mg (Benta BPI)', 'Astor 20mg'],
      dosage: 'Adults: 10mg to 20mg once daily at any time of day, with or without food.',
      
      form: 'Tablet',
      presentation: 'Box of 30 tablets',
      activeIngredients: 'Atorvastatin 20mg',
      pregnancyCategory: 'X',
      storageConditions: 'Store below 30°C.',
    },
  },
  {
    id: 'prod-con5',
    code: 'CON5',
    name: 'Concor 5mg',
    category: 'drug',
    ingredients: 'Bisoprolol Fumarate',
    dosage: '5mg',
    presentation: '30 Heart-Shaped Tablets',
    form: 'Tablet',
    
    priceLBP: 537000,
    priceUSD: 6.00,
    costPriceUSD: 4.86,
    pharmacistMarginProfit: 19.0,
    agent: "Droguerie de l'Union",
    stockQuantity: 6, // Low stock on purpose to trigger alert!
    minStockAlert: 10,
    expiryDate: '2026-10-31', // Expiring soon on purpose to trigger alert!
    batchNumber: 'CC-5512B',
    updatedAt: Date.now() - 300000,
    version: 1,
    scientificInfo: {
      indications: 'Management of essential hypertension, chronic stable angina, and stable heart failure.',
      contraindications: 'Acute heart failure, cardiogenic shock, second/third-degree AV block, severe asthma.',
      sideEffects: 'Bradycardia, dizziness, headache, fatigue, cold sensation in extremities.',
      generics: ['Biso 5mg (Algorithm)', 'B-Cor 5mg', 'Bisocard 5mg', 'Cardicor 5mg'],
      dosage: 'Adults: 5mg once daily in morning. May be titrated up to 10mg based on clinical response.',
      
      form: 'Scored Tablet',
      presentation: 'Box of 30 tablets',
      activeIngredients: 'Bisoprolol Fumarate 5mg',
      pregnancyCategory: 'C',
      storageConditions: 'Store below 25°C.',
    },
  },
  {
    id: 'prod-nex40',
    code: 'NEX40',
    name: 'Nexium 40mg',
    category: 'drug',
    ingredients: 'Esomeprazole Magnesium Trihydrate',
    dosage: '40mg',
    presentation: '28 Gastro-Resistant Tablets',
    form: 'Tablet',
    
    priceLBP: 1074000,
    priceUSD: 12.00,
    costPriceUSD: 9.60,
    pharmacistMarginProfit: 20.0,
    agent: 'Mersaco Sal',
    stockQuantity: 15,
    minStockAlert: 8,
    expiryDate: '2028-02-10',
    batchNumber: 'NX-9901M',
    updatedAt: Date.now() - 250000,
    version: 1,
    scientificInfo: {
      indications: 'GERD, erosive esophagitis, H. pylori eradication (adjunct), NSAID ulcer healing.',
      contraindications: 'Hypersensitivity to esomeprazole or substituted benzimidazoles.',
      sideEffects: 'Headache, abdominal pain, diarrhea, flatulence, nausea, mild constipation.',
      generics: ['Esomep 40mg (Algorithm Lebanon)', 'Nexpro 40mg', 'Ezomeprazole Benta', 'Inキシウム'],
      dosage: 'Adults: 1 tablet (40mg) once daily 30-60 min before breakfast swallowed whole.',
      
      form: 'Gastro-resistant Tablet',
      presentation: 'Box of 28 tablets',
      activeIngredients: 'Esomeprazole 40mg',
      pregnancyCategory: 'C',
      storageConditions: 'Store in blister pack below 30°C.',
    },
  },
  {
    id: 'prod-ven100',
    code: 'VEN100',
    name: 'Ventolin Evohaler',
    category: 'drug',
    ingredients: 'Salbutamol Sulfate',
    dosage: '100mcg / puff',
    presentation: 'Pressurised Inhalation Suspension (200 Puffs)',
    form: 'Inhaler',
    
    priceLBP: 447500,
    priceUSD: 5.00,
    costPriceUSD: 4.10,
    pharmacistMarginProfit: 18.0,
    agent: 'Mersaco Sal',
    stockQuantity: 30,
    minStockAlert: 10,
    expiryDate: '2027-12-31',
    batchNumber: 'VN-3382K',
    updatedAt: Date.now() - 200000,
    version: 1,
    scientificInfo: {
      indications: 'Relief of acute bronchospasm in asthma, chronic bronchitis, and exercise-induced asthma.',
      contraindications: 'Hypersensitivity to salbutamol or norflurane propellant.',
      sideEffects: 'Fine skeletal tremor (hands), palpitations, tachycardia, headache.',
      generics: ['Butalin Inhaler', 'Asthalin 100mcg (Cipla)', 'Salamol Inhaler'],
      dosage: '1 to 2 puffs for acute symptoms; wait 1 minute between inhalations.',
      
      form: 'Aerosol Inhaler',
      presentation: '200 doses canister with actuator and dust cap',
      activeIngredients: 'Salbutamol 100mcg per metered dose',
      pregnancyCategory: 'C',
      storageConditions: 'Store below 30°C. Protect from frost and direct sunlight.',
    },
  },
  // --- IN-STOCK GENERIC ALTERNATIVES IN LEBANON ---
  {
    id: 'prod-adol500',
    code: 'ADOL500',
    name: 'Adol Extra',
    category: 'drug',
    ingredients: 'Paracetamol + Caffeine',
    dosage: '500mg / 65mg',
    presentation: '24 Caplets',
    form: 'Tablet',
    
    priceLBP: 250000,
    priceUSD: 2.79,
    costPriceUSD: 2.20,
    pharmacistMarginProfit: 21.0,
    agent: 'Mersaco Sal',
    stockQuantity: 24, // IN STOCK
    minStockAlert: 10,
    expiryDate: '2028-03-30',
    batchNumber: 'ADL-9921',
    updatedAt: Date.now() - 180000,
    version: 1,
    scientificInfo: {
      indications: 'Relief of mild to moderate pain (headache, migraine, toothache) and reduction of fever.',
      contraindications: 'Severe hepatic insufficiency, hypersensitivity to paracetamol or caffeine.',
      sideEffects: 'Mild restlessness, insomnia due to caffeine, rare allergic skin rash.',
      generics: ['Panadol Extra', 'Doliprane 500mg'],
      dosage: 'Adults: 1 to 2 caplets every 4-6 hours. Max 8 caplets in 24 hours.',
      
      form: 'Tablet',
      presentation: 'Box of 24 caplets',
      activeIngredients: 'Paracetamol 500mg, Caffeine 65mg',
      pregnancyCategory: 'B',
      storageConditions: 'Store below 25°C.',
      onlineEnriched: false,
      onlineSource: 'Standard Pharmacopoeia',
    },
  },
  {
    id: 'prod-doli500',
    code: 'DOLI500',
    name: 'Doliprane 500mg',
    category: 'drug',
    ingredients: 'Paracetamol',
    dosage: '500mg',
    presentation: '16 Tablets',
    form: 'Tablet',
    
    priceLBP: 180000,
    priceUSD: 2.01,
    costPriceUSD: 1.60,
    pharmacistMarginProfit: 20.0,
    agent: 'Omnipharma S.A.L.',
    stockQuantity: 35, // IN STOCK
    minStockAlert: 10,
    expiryDate: '2027-10-15',
    batchNumber: 'DOL-4412',
    updatedAt: Date.now() - 170000,
    version: 1,
    scientificInfo: {
      indications: 'Symptomatic treatment of mild to moderate pain and febrile conditions.',
      contraindications: 'Severe hepatocellular insufficiency, hypersensitivity to paracetamol.',
      sideEffects: 'Rare cutaneous allergic reactions or transaminase elevations.',
      generics: ['Panadol Extra', 'Adol Extra'],
      dosage: 'Adults: 1 to 2 tablets every 4 to 6 hours as needed. Max 3000mg/day.',
      
      form: 'Tablet',
      presentation: 'Box of 16 tablets',
      activeIngredients: 'Paracetamol 500mg',
      pregnancyCategory: 'B',
      storageConditions: 'Store below 30°C.',
      onlineEnriched: false,
      onlineSource: 'Standard Pharmacopoeia',
    },
  },
  {
    id: 'prod-paramol',
    code: 'PARAMOL',
    name: 'Paramol Extra (Out of Stock)',
    category: 'drug',
    ingredients: 'Paracetamol + Caffeine',
    dosage: '500mg / 65mg',
    presentation: '20 Tablets',
    form: 'Tablet',
    
    priceLBP: 240000,
    priceUSD: 2.68,
    costPriceUSD: 2.10,
    pharmacistMarginProfit: 21.0,
    agent: 'Droguerie de l\'Union',
    stockQuantity: 0, // OUT OF STOCK - MUST NOT SHOW IN GENERICS!
    minStockAlert: 8,
    expiryDate: '2026-11-20',
    batchNumber: 'PRM-0031',
    updatedAt: Date.now() - 160000,
    version: 1,
    scientificInfo: {
      indications: 'Relief of acute pain and fever.',
      contraindications: 'Severe liver failure.',
      sideEffects: 'Sleeplessness, headache.',
      generics: [],
      dosage: '1 tablet every 4 hours.',
      
      form: 'Tablet',
      presentation: 'Box of 20 tablets',
      activeIngredients: 'Paracetamol 500mg, Caffeine 65mg',
      pregnancyCategory: 'B',
      storageConditions: 'Store below 25°C.',
    },
  },
  {
    id: 'prod-cur1g',
    code: 'CUR1G',
    name: 'Curam 1000mg (Generic Augmentin)',
    category: 'drug',
    ingredients: 'Amoxicillin + Clavulanic Acid',
    dosage: '875mg / 125mg',
    presentation: '14 Film-Coated Tablets',
    form: 'Tablet',
    
    priceLBP: 745000,
    priceUSD: 8.32,
    costPriceUSD: 6.65,
    pharmacistMarginProfit: 20.0,
    agent: 'Omnipharma S.A.L.',
    stockQuantity: 14, // IN STOCK
    minStockAlert: 6,
    expiryDate: '2027-09-30',
    batchNumber: 'CRM-7788',
    updatedAt: Date.now() - 150000,
    version: 1,
    scientificInfo: {
      indications: 'Bacterial infections of the upper and lower respiratory tract, urinary tract, and skin.',
      contraindications: 'Hypersensitivity to penicillins or clavulanate.',
      sideEffects: 'Diarrhea, nausea, candidiasis.',
      generics: ['Augmentin 1g'],
      dosage: '1 tablet twice daily with food.',
      
      form: 'Tablet',
      presentation: 'Box of 14 tablets',
      activeIngredients: 'Amoxicillin 875mg, Clavulanic Acid 125mg',
      pregnancyCategory: 'B',
      storageConditions: 'Store below 25°C.',
      onlineEnriched: false,
      onlineSource: 'Standard Pharmacopoeia',
    },
  },
  {
    id: 'prod-ator20',
    code: 'ATOR20',
    name: 'Atorva 20mg (Generic Lipitor)',
    category: 'drug',
    ingredients: 'Atorvastatin',
    dosage: '20mg',
    presentation: '30 Tablets',
    form: 'Tablet',
    
    priceLBP: 750000,
    priceUSD: 8.38,
    costPriceUSD: 6.70,
    pharmacistMarginProfit: 20.0,
    agent: 'Khalil Fattal & Fils',
    stockQuantity: 16, // IN STOCK
    minStockAlert: 8,
    expiryDate: '2027-11-15',
    batchNumber: 'ATR-2021',
    updatedAt: Date.now() - 140000,
    version: 1,
    scientificInfo: {
      indications: 'Adjunct therapy to diet for hypercholesterolemia and prevention of cardiovascular events.',
      contraindications: 'Active liver disease, pregnancy, lactation.',
      sideEffects: 'Myalgia, headache, gastrointestinal discomfort.',
      generics: ['Lipitor 20mg'],
      dosage: '20mg once daily.',
      
      form: 'Tablet',
      presentation: 'Box of 30 tablets',
      activeIngredients: 'Atorvastatin 20mg',
      pregnancyCategory: 'X',
      storageConditions: 'Store below 25°C.',
      onlineEnriched: false,
      onlineSource: 'Standard Pharmacopoeia',
    },
  },
  {
    id: 'prod-biso5',
    code: 'BISO5',
    name: 'Biso 5mg Algorithm',
    category: 'drug',
    ingredients: 'Bisoprolol',
    dosage: '5mg',
    presentation: '30 Tablets',
    form: 'Tablet',
    
    priceLBP: 380000,
    priceUSD: 4.25,
    costPriceUSD: 3.40,
    pharmacistMarginProfit: 20.0,
    agent: 'Mersaco Sal',
    stockQuantity: 20, // IN STOCK
    minStockAlert: 8,
    expiryDate: '2028-01-20',
    batchNumber: 'BSO-5002',
    updatedAt: Date.now() - 130000,
    version: 1,
    scientificInfo: {
      indications: 'Management of hypertension and stable chronic angina.',
      contraindications: 'Cardiogenic shock, severe bradycardia, asthma.',
      sideEffects: 'Cold extremities, fatigue, dizziness.',
      generics: ['Concor 5mg'],
      dosage: '5mg once daily in the morning.',
      
      form: 'Tablet',
      presentation: 'Box of 30 tablets',
      activeIngredients: 'Bisoprolol 5mg',
      pregnancyCategory: 'C',
      storageConditions: 'Store below 25°C.',
      onlineEnriched: false,
      onlineSource: 'Standard Pharmacopoeia',
    },
  },

  // --- CATEGORY: VITAMINS ---
  {
    id: 'prod-vitc1000',
    code: 'VITC1000',
    name: 'Redoxon Double Action (Vit C + Zinc)',
    category: 'vitamins',
    ingredients: 'Ascorbic Acid 1000mg + Zinc Citrate 10mg',
    dosage: '1000mg / 10mg',
    presentation: 'Tube of 15 Effervescent Orange Tablets',
    form: 'Effervescent Tablet',
    
    priceLBP: 447500,
    priceUSD: 5.00,
    costPriceUSD: 3.75,
    pharmacistMarginProfit: 25.0,
    agent: 'Khalil Fattal & Fils',
    stockQuantity: 28,
    minStockAlert: 10,
    expiryDate: '2027-06-30',
    batchNumber: 'RDX-1290',
    updatedAt: Date.now() - 150000,
    version: 1,
  },
  {
    id: 'prod-vitd10k',
    code: 'VITD10K',
    name: 'D-Vital Vitamin D3 10,000 IU',
    category: 'vitamins',
    ingredients: 'Cholecalciferol (Vitamin D3)',
    dosage: '10,000 IU',
    presentation: 'Box of 30 Softgel Capsules',
    form: 'Softgel',
    
    priceLBP: 716000,
    priceUSD: 8.00,
    costPriceUSD: 6.00,
    pharmacistMarginProfit: 25.0,
    agent: 'Omnipharma S.A.L.',
    stockQuantity: 22,
    minStockAlert: 8,
    expiryDate: '2028-01-15',
    batchNumber: 'DV-4402',
    updatedAt: Date.now() - 120000,
    version: 1,
  },

  // --- CATEGORY: COSMETICS ---
  {
    id: 'prod-bio-spf',
    code: 'BIO-SPF',
    name: 'Bioderma Photoderm Max SPF 50+',
    category: 'cosmetics',
    ingredients: 'Cellular Bioprotection patent, Sun filters UVA/UVB',
    dosage: 'SPF 50+ / UVA 24',
    presentation: '40ml Tube Aquafluid Invisible Finish',
    form: 'Fluid Cream',
    
    priceLBP: 1790000,
    priceUSD: 20.00,
    costPriceUSD: 15.00,
    pharmacistMarginProfit: 25.0,
    agent: 'Khalil Fattal & Fils',
    stockQuantity: 12,
    minStockAlert: 5,
    expiryDate: '2027-09-30',
    batchNumber: 'BD-66718',
    updatedAt: Date.now() - 90000,
    version: 1,
  },
  {
    id: 'prod-cer-hyd',
    code: 'CER-HYD',
    name: 'CeraVe Moisturizing Cream',
    category: 'cosmetics',
    ingredients: '3 Essential Ceramides + Hyaluronic Acid',
    dosage: '454g (16 oz)',
    presentation: 'Tub with moisture lock seal',
    form: 'Cream',
    
    priceLBP: 1611000,
    priceUSD: 18.00,
    costPriceUSD: 13.50,
    pharmacistMarginProfit: 25.0,
    agent: 'Khalil Fattal & Fils',
    stockQuantity: 9,
    minStockAlert: 4,
    expiryDate: '2028-05-15',
    batchNumber: 'CRV-8812',
    updatedAt: Date.now() - 80000,
    version: 1,
  },

  // --- CATEGORY: PARA ---
  {
    id: 'prod-accu-str',
    code: 'ACCU-STR',
    name: 'Accu-Chek Instant Blood Glucose Test Strips',
    category: 'para',
    ingredients: 'Glucose Dehydrogenase biosensor chemistry',
    dosage: '50 Test Strips',
    presentation: 'Vial of 50 strips with desiccant cap',
    form: 'Diagnostic Strips',
    
    priceLBP: 1163500,
    priceUSD: 13.00,
    costPriceUSD: 10.40,
    pharmacistMarginProfit: 20.0,
    agent: "Droguerie de l'Union",
    stockQuantity: 19,
    minStockAlert: 10,
    expiryDate: '2027-03-31',
    batchNumber: 'AC-1199',
    updatedAt: Date.now() - 70000,
    version: 1,
  },
  {
    id: 'prod-omr-bp',
    code: 'OMR-BP',
    name: 'Omron M2 Basic Digital Blood Pressure Monitor',
    category: 'para',
    ingredients: 'Oscillometric Upper Arm Monitor with Cuff 22-32cm',
    dosage: '1 Device (Batteries Included)',
    presentation: 'Box with storage pouch, batteries, manual',
    form: 'Medical Device',
    
    priceLBP: 3580000,
    priceUSD: 40.00,
    costPriceUSD: 32.00,
    pharmacistMarginProfit: 20.0,
    agent: 'Mersaco Sal',
    stockQuantity: 4, // Low stock alert!
    minStockAlert: 5,
    expiryDate: '2032-12-31',
    batchNumber: 'OM-2026-X',
    updatedAt: Date.now() - 60000,
    version: 1,
  }
];

export const INITIAL_SALES: SaleTransaction[] = [
  {
    id: 'sale-1001',
    invoiceNumber: 'INV-2026-0001',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    timestamp: Date.now() - 86400000 * 2,
    items: [
      {
        productId: 'prod-pan500',
        productCode: 'PAN500',
        productName: 'Panadol Extra',
        category: 'drug',
        quantity: 2,
        unitPriceUSD: 3.52,
        unitPriceLBP: 315000,
        costPriceUSD: 2.88,
        totalUSD: 7.04,
        totalLBP: 630000,
      },
      {
        productId: 'prod-vitc1000',
        productCode: 'VITC1000',
        productName: 'Redoxon Double Action',
        category: 'vitamins',
        quantity: 1,
        unitPriceUSD: 5.00,
        unitPriceLBP: 447500,
        costPriceUSD: 3.75,
        totalUSD: 5.00,
        totalLBP: 447500,
      }
    ],
    totalUSD: 12.04,
    totalLBP: 1077500,
    exchangeRate: 89500,
    customerId: 'cust-1',
    customerName: 'Elie Abi Chahine',
    cashierId: 'user-admin',
    cashierName: 'Dr. Tarek El-Khoury',
    paymentMethod: 'cash_lbp',
    amountPaidUSD: 0,
    amountPaidLBP: 1100000,
    changeGivenUSD: 0,
    changeGivenLBP: 22500,
    synced: true,
  },
  {
    id: 'sale-1002',
    invoiceNumber: 'INV-2026-0002',
    date: new Date(Date.now() - 86400000).toISOString(),
    timestamp: Date.now() - 86400000,
    items: [
      {
        productId: 'prod-aug1g',
        productCode: 'AUG1G',
        productName: 'Augmentin 1g',
        category: 'drug',
        quantity: 1,
        unitPriceUSD: 10.00,
        unitPriceLBP: 895000,
        costPriceUSD: 8.00,
        totalUSD: 10.00,
        totalLBP: 895000,
      }
    ],
    totalUSD: 10.00,
    totalLBP: 895000,
    exchangeRate: 89500,
    customerId: 'cust-2',
    customerName: 'Rana Al-Husseini',
    cashierId: 'user-staff',
    cashierName: 'Maya Zein',
    paymentMethod: 'cash_usd',
    amountPaidUSD: 10.00,
    amountPaidLBP: 0,
    changeGivenUSD: 0,
    changeGivenLBP: 0,
    synced: true,
  },
  {
    id: 'sale-1003',
    invoiceNumber: 'INV-2026-0003',
    date: new Date().toISOString(),
    timestamp: Date.now() - 3600000 * 3,
    items: [
      {
        productId: 'prod-lip20',
        productCode: 'LIP20',
        productName: 'Lipitor 20mg',
        category: 'drug',
        quantity: 1,
        unitPriceUSD: 14.00,
        unitPriceLBP: 1253000,
        costPriceUSD: 11.20,
        totalUSD: 14.00,
        totalLBP: 1253000,
      },
      {
        productId: 'prod-bio-spf',
        productCode: 'BIO-SPF',
        productName: 'Bioderma Photoderm Max SPF 50+',
        category: 'cosmetics',
        quantity: 1,
        unitPriceUSD: 20.00,
        unitPriceLBP: 1790000,
        costPriceUSD: 15.00,
        totalUSD: 20.00,
        totalLBP: 1790000,
      }
    ],
    totalUSD: 34.00,
    totalLBP: 3043000,
    exchangeRate: 89500,
    customerId: 'cust-3',
    customerName: 'Walid Machnouk',
    cashierId: 'user-admin',
    cashierName: 'Dr. Tarek El-Khoury',
    paymentMethod: 'mixed',
    amountPaidUSD: 20.00,
    amountPaidLBP: 1300000,
    changeGivenUSD: 0,
    changeGivenLBP: 47000,
    synced: true,
  }
];

export const INITIAL_PURCHASES: PurchaseInvoice[] = [
  {
    id: 'pur-501',
    invoiceNumber: 'PINV-MER-9921',
    supplierId: 'sup-mersaco',
    supplierName: 'Mersaco Sal',
    date: '2026-08-20',
    timestamp: Date.now() - 86400000 * 15,
    items: [
      {
        productId: 'prod-pan500',
        productCode: 'PAN500',
        productName: 'Panadol Extra',
        quantity: 50,
        unitCostUSD: 2.88,
        unitCostLBP: 257760,
        sellingPriceLBP: 315000,
        batchNumber: 'BT-88902A',
        expiryDate: '2027-11-30',
      },
      {
        productId: 'prod-nex40',
        productCode: 'NEX40',
        productName: 'Nexium 40mg',
        quantity: 20,
        unitCostUSD: 9.60,
        unitCostLBP: 859200,
        sellingPriceLBP: 1074000,
        batchNumber: 'NX-9901M',
        expiryDate: '2028-02-10',
      }
    ],
    totalCostUSD: 336.00,
    totalCostLBP: 30072000,
    exchangeRate: 89500,
    status: 'received',
    paid: true,
  }
];

export const INITIAL_LOGS: AppLogEntry[] = [
  {
    id: 'log-seed-01',
    timestamp: Date.now() - 3600 * 1000 * 5,
    component: 'Auth / Security',
    action: 'USER_LOGIN',
    level: 'success',
    title: 'Pharmacist Session Authenticated',
    description: 'Dr. Tarek El-Khoury successfully signed in to terminal Counter 1 (Main POS).',
    user: {
      id: 'user-admin',
      name: 'Dr. Tarek El-Khoury (Chief Pharmacist)',
      role: 'admin',
      username: 'admin',
    },
    device: 'Counter 1 (Main POS)',
    entityType: 'user',
    entityId: 'user-admin',
    details: {
      clientIp: '192.168.1.101',
      authMethod: 'password_offline_hash',
      terminal: 'PC-1-COUNTER',
      sessionDuration: 'Continuous Offline',
    },
  },
  {
    id: 'log-seed-02',
    timestamp: Date.now() - 3600 * 1000 * 4,
    component: 'System',
    action: 'CURRENCY_RATE_INITIALIZED',
    level: 'info',
    title: 'Exchange Rate Configured',
    description: 'Lebanese Pound official POS exchange rate established at 89,500 LBP per 1 USD.',
    user: {
      id: 'user-admin',
      name: 'Dr. Tarek El-Khoury (Chief Pharmacist)',
      role: 'admin',
    },
    device: 'Counter 1 (Main POS)',
    details: {
      previousRate: 89500,
      newRate: 89500,
      baseCurrency: 'USD',
      quotedCurrency: 'LBP',
      policy: 'Banque du Liban Market Standard',
    },
  },
  {
    id: 'log-seed-03',
    timestamp: Date.now() - 3600 * 1000 * 3.5,
    component: 'Inventory / Stock',
    action: 'STOCK_INITIALIZED',
    level: 'info',
    title: 'Drug Inventory Catalog Synchronized',
    description: 'Standard Lebanese Ministry of Public Health (MOPH) pricing and 50+ formulary items loaded into local database.',
    user: {
      name: 'System Engine',
      role: 'admin',
    },
    device: 'Counter 1 (Main POS)',
    details: {
      itemsLoaded: 50,
      categories: ['drug', 'vitamins', 'cosmetics', 'para'],
      agentsTracked: ['Mersaco', 'Omnipharma', 'Fattal', 'Union'],
      offlineCacheState: 'Healthy',
    },
  },
  {
    id: 'log-seed-04',
    timestamp: Date.now() - 3600 * 1000 * 2.8,
    component: 'Purchases',
    action: 'PURCHASE_REGISTERED',
    level: 'success',
    title: 'Supplier Invoice #PINV-MER-9921 Received',
    description: 'Supplier shipment from Mersaco Sal accepted with 3 items totaling $336.00 (30,072,000 L.L.).',
    user: {
      id: 'user-admin',
      name: 'Dr. Tarek El-Khoury (Chief Pharmacist)',
      role: 'admin',
    },
    device: 'Counter 1 (Main POS)',
    entityType: 'purchase',
    entityId: 'pinv-001',
    details: {
      supplier: 'Mersaco Sal',
      invoiceNumber: 'PINV-MER-9921',
      itemsCount: 3,
      totalUSD: 336.0,
      totalLBP: 30072000,
      paymentTerms: '30 Days Net',
    },
  },
  {
    id: 'log-seed-05',
    timestamp: Date.now() - 3600 * 1000 * 2,
    component: 'POS / Sale',
    action: 'SALE_DISPENSED',
    level: 'success',
    title: 'Dispensed Sale #INV-2026-0001',
    description: 'Prescription sale for patient Ahmad Al-Sayed completed: Augmentin 1g & Panadol Extra ($14.60 / 1,306,700 L.L.).',
    user: {
      id: 'user-admin',
      name: 'Dr. Tarek El-Khoury (Chief Pharmacist)',
      role: 'admin',
    },
    device: 'Counter 1 (Main POS)',
    entityType: 'sale',
    entityId: 'sale-001',
    details: {
      invoiceNumber: 'INV-2026-0001',
      customer: 'Ahmad Al-Sayed',
      paymentMethod: 'cash_usd',
      amountPaidUSD: 20.0,
      changeGivenUSD: 5.4,
      items: [
        { name: 'Augmentin 1g Tablets', qty: 1, priceUSD: 11.2 },
        { name: 'Panadol Extra 500mg/65mg', qty: 1, priceUSD: 3.4 },
      ],
    },
  },
  {
    id: 'log-seed-06',
    timestamp: Date.now() - 3600 * 1000 * 1.5,
    component: 'System',
    action: 'SCIENTIFIC_LOOKUP',
    level: 'info',
    title: 'Scientific Monograph & Interactions Accessed',
    description: 'Drug monograph and generic alternatives for Augmentin 1g (Amoxicillin + Clavulanic Acid) reviewed.',
    user: {
      id: 'user-staff',
      name: 'Maya Zein (Pharmacy Technician)',
      role: 'staff',
    },
    device: 'Counter 1 (Main POS)',
    entityType: 'product',
    entityId: 'prod-001',
    details: {
      drugName: 'Augmentin 1g Tablets',
      activeIngredients: 'Amoxicillin 875mg + Clavulanic Acid 125mg',
      pregnancyCategory: 'B',
      genericsSuggested: ['Curam 1g', 'Klavox 1g', 'Megamox 1g', 'Julmentin 1g'],
    },
  },
  {
    id: 'log-seed-07',
    timestamp: Date.now() - 3600 * 1000 * 1,
    component: 'Sync / Network',
    action: 'PEER_BROADCAST',
    level: 'info',
    title: 'Peer-to-Peer State Synchronized',
    description: 'Multi-terminal sync broadcasted local mutation vector clock to peers on local network.',
    user: {
      name: 'Sync Engine',
      role: 'system',
    },
    device: 'Counter 1 (Main POS)',
    details: {
      channel: 'BroadcastChannel (WebRTC LAN fallback)',
      syncRole: 'peer',
      stateDigest: '48 items verified in synchronization',
    },
  },
  {
    id: 'log-seed-08',
    timestamp: Date.now() - 1800 * 1000,
    component: 'System',
    action: 'CUSTOMER_REGISTERED',
    level: 'success',
    title: 'Customer Profile Created',
    description: 'Registered new chronic therapy patient Zeina Trad with Penicillin allergy flag.',
    user: {
      id: 'user-admin',
      name: 'Dr. Tarek El-Khoury (Chief Pharmacist)',
      role: 'admin',
    },
    device: 'Counter 1 (Main POS)',
    entityType: 'customer',
    entityId: 'cust-002',
    details: {
      name: 'Zeina Trad',
      phone: '+961 3 889 123',
      chronicConditions: 'Hypertension, Dyslipidemia',
      allergies: 'Penicillin (Severe rash)',
      loyaltyPoints: 120,
    },
  }
];

// --- STORAGE MANAGER ---
const STORAGE_KEYS = {
  SETTINGS: 'pharmalebanon_settings_v1',
  USERS: 'pharmalebanon_users_v1',
  USER_SETUP_RESET: 'pharmalebanon_user_setup_reset_v1',
  PRODUCTS: 'pharmalebanon_products_v1',
  SUPPLIERS: 'pharmalebanon_suppliers_v1',
  CUSTOMERS: 'pharmalebanon_customers_v1',
  SALES: 'pharmalebanon_sales_v1',
  PURCHASES: 'pharmalebanon_purchases_v1',
  CONFLICTS: 'pharmalebanon_conflicts_v1',
  NOTIFICATIONS: 'pharmalebanon_notifications_v1',
  CURRENT_USER: 'pharmalebanon_current_user_v1',
  LOGS: 'pharmalebanon_app_logs_v1',
};

// Safe setItem that handles browser quota limits without crashing
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`localStorage quota limit reached when writing "${key}". Initiating safe eviction...`, err);
    try {
      // 1. Evict ephemeral app logs first to free up to 2-3MB
      localStorage.removeItem(STORAGE_KEYS.LOGS);
      localStorage.removeItem(STORAGE_KEYS.CONFLICTS);
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
      // Retry write
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      console.warn(`localStorage still full after clearing non-critical keys.`, retryErr);
      return false;
    }
  }
}

// Strip redundant verbose repetitive monograph text from localStorage
// Scientific data can be reconstructed on-the-fly dynamically by resolveStraightforwardScientificInfo
function compactProductsForStorage(products: Product[]): string {
  const compact = products.map((p) => {
    // If scientificInfo is not custom-enriched, strip it to save megabytes
    if (p.scientificInfo && !p.scientificInfo.onlineEnriched) {
      const { scientificInfo, ...rest } = p;
      return rest;
    }
    return p;
  });
  return JSON.stringify(compact);
}

// In-memory cache for ultra-fast and fail-safe product access
let memoryProducts: Product[] | null = null;

export class OfflineStorage {
  static resetUsersForFirstSetup(): void {
    try {
      if (localStorage.getItem(STORAGE_KEYS.USER_SETUP_RESET) === 'done') return;
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      safeSetItem(STORAGE_KEYS.USER_SETUP_RESET, 'done');
    } catch (e) {
      console.warn('Could not reset stored user accounts for first setup:', e);
    }
  }

  static getSettings(): PharmacySettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...INITIAL_SETTINGS, ...JSON.parse(data) } : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  }

  static saveSettings(settings: PharmacySettings): void {
    safeSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  static getUsers(): User[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      // No users yet means a brand new install: the app's first-run setup wizard
      // creates the first admin account (or pulls users from the Main PC's snapshot).
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveUsers(users: User[]): void {
    safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  static getProducts(): Product[] {
    if (memoryProducts !== null) {
      return memoryProducts;
    }

    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      // A fresh install has no key at all yet: start with zero products instead of demo data
      if (data === null) {
        safeSetItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
        memoryProducts = [];
        idbStorage.saveProducts([]).catch(() => {});
        return [];
      }

      let parsed: Product[] = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        memoryProducts = [];
        return [];
      }

      // Automatically migrate any legacy references
      let modified = false;
      parsed = parsed.map((p) => {
        if (p.scientificInfo && (p.scientificInfo.onlineSource === 'openFDA' || (p.scientificInfo.onlineSource as string) === 'Wikipedia')) {
          modified = true;
          return {
            ...p,
            scientificInfo: {
              ...p.scientificInfo,
              onlineEnriched: false,
              onlineSource: 'Standard Pharmacopoeia',
            },
          };
        }
        return p;
      });
      if (modified) {
        safeSetItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(parsed));
      }

      memoryProducts = parsed;

      // Asynchronously backup to IndexedDB
      idbStorage.saveProducts(parsed).catch(() => {});

      return parsed;
    } catch {
      memoryProducts = [];
      return [];
    }
  }

  static updateMemoryCache(products: Product[]): void {
    memoryProducts = products;
  }

  static saveProducts(products: Product[]): void {
    memoryProducts = products;

    // 1. Asynchronously persist full data to IndexedDB (unlimited offline capacity)
    idbStorage.saveProducts(products).catch(() => {});

    // 2. Persist to localStorage with intelligent quota handling
    try {
      const fullJson = JSON.stringify(products);
      const success = safeSetItem(STORAGE_KEYS.PRODUCTS, fullJson);
      
      if (!success) {
        // Full JSON exceeded 5MB quota: store compacted version (omitting auto-generatable scientific text)
        const compactJson = compactProductsForStorage(products);
        const compactSuccess = safeSetItem(STORAGE_KEYS.PRODUCTS, compactJson);
        
        if (!compactSuccess) {
          // If still exceeding, keep memory cache & IndexedDB as primary, prune to top 1500 items in localStorage
          const topSubset = compactProductsForStorage(products.slice(0, 1500));
          safeSetItem(STORAGE_KEYS.PRODUCTS, topSubset);
          console.warn('Full inventory stored in IndexedDB and memory; localStorage compacted.');
        }
      }
    } catch (e) {
      console.warn('saveProducts handled storage error safely:', e);
    }
  }

  static getSuppliers(): Supplier[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveSuppliers(suppliers: Supplier[]): void {
    safeSetItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
  }

  static getCustomers(): Customer[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveCustomers(customers: Customer[]): void {
    safeSetItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }

  static getSales(): SaleTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SALES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveSales(sales: SaleTransaction[]): void {
    safeSetItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  }

  static getPurchases(): PurchaseInvoice[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PURCHASES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static savePurchases(purchases: PurchaseInvoice[]): void {
    safeSetItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
  }

  static getConflicts(): SyncConflictLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFLICTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveConflicts(conflicts: SyncConflictLog[]): void {
    safeSetItem(STORAGE_KEYS.CONFLICTS, JSON.stringify(conflicts));
  }

  static getNotifications(): AppNotification[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveNotifications(notifications: AppNotification[]): void {
    safeSetItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }

  static getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static saveCurrentUser(user: User | null): void {
    if (user) {
      safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  static getLogs(): AppLogEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveLogs(logs: AppLogEntry[]): void {
    try {
      // Keep up to 100 recent logs in localStorage to conserve quota
      safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 100)));
    } catch (e) {
      console.warn('Could not save logs to localStorage', e);
    }
  }

  // Free non-critical temporary data to reclaim quota
  static freeTemporaryQuota(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.LOGS);
      localStorage.removeItem(STORAGE_KEYS.CONFLICTS);
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
      console.info('Temporary quota reclaimed successfully.');
    } catch (e) {
      console.warn('Error clearing temporary quota:', e);
    }
  }

  // Backup every persisted domain to JSON, using IndexedDB for the full inventory when available.
  static async exportFullBackup(): Promise<string> {
    const indexedProducts = await idbStorage.getProducts();
    const backupData = {
      schemaVersion: 2,
      exportTimestamp: Date.now(),
      exportDate: new Date().toISOString(),
      app: 'PharmaLeb Management System',
      version: '2.0.0',
      settings: this.getSettings(),
      users: this.getUsers(),
      products: indexedProducts || this.getProducts(),
      suppliers: this.getSuppliers(),
      customers: this.getCustomers(),
      sales: this.getSales(),
      purchases: this.getPurchases(),
      conflicts: this.getConflicts(),
      notifications: this.getNotifications(),
      currentUser: this.getCurrentUser(),
      logs: this.getLogs(),
    };
    return JSON.stringify(backupData, null, 2);
  }

  // Restore every persisted domain from JSON.
  static async restoreFullBackup(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      const requiredArrays = ['users', 'products', 'suppliers', 'customers', 'sales', 'purchases', 'logs'];
      const isSupportedVersion = data.schemaVersion === 2 || data.version === '1.0.0';
      if (!isSupportedVersion || !data.settings || requiredArrays.some((key) => !Array.isArray(data[key]))) {
        throw new Error('Invalid or incomplete backup format');
      }
      this.saveSettings(data.settings);
      this.saveUsers(data.users);
      this.saveProducts(data.products);
      this.saveSuppliers(data.suppliers);
      this.saveCustomers(data.customers);
      this.saveSales(data.sales);
      this.savePurchases(data.purchases);
      this.saveConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
      this.saveNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      this.saveCurrentUser(data.currentUser || null);
      this.saveLogs(data.logs);
      await idbStorage.saveProducts(data.products);
      return true;
    } catch (e) {
      console.error('Failed to restore backup:', e);
      return false;
    }
  }

  // Reset to demo data
  static resetToDemoData(): void {
    this.saveSettings(INITIAL_SETTINGS);
    this.saveUsers(INITIAL_USERS);
    this.saveProducts(INITIAL_PRODUCTS);
    this.saveSuppliers(INITIAL_SUPPLIERS);
    this.saveCustomers(INITIAL_CUSTOMERS);
    this.saveSales(INITIAL_SALES);
    this.savePurchases(INITIAL_PURCHASES);
    this.saveConflicts([]);
    this.saveLogs(INITIAL_LOGS);
  }

  static clearAllData(): void {
    // We keep settings and users so the current session remains valid
    this.saveProducts([]);
    this.saveSuppliers([]);
    this.saveCustomers([]);
    this.saveSales([]);
    this.savePurchases([]);
    this.saveConflicts([]);
    this.saveLogs([]);
  }
}
