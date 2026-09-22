import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  Printer,
  Search,
  Building2,
  AlertTriangle,
  FileCheck2,
  UserCheck,
  Stethoscope,
  Pill,
  ShieldCheck,
  FileSpreadsheet,
  Edit2,
  Check,
  X,
  Filter,
  Layers
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatTime } from '../../utils/dateUtils';

// Common psychotropic, narcotic, sedative, controlled keywords & molecules in Lebanon
const SCHEDULED_PATTERNS = [
  'diazepam', 'valium', 'alprazolam', 'xanax', 'bromazepam', 'lexotanil',
  'clonazepam', 'rivotril', 'lorazepam', 'ativan', 'zolpidem', 'stilnox',
  'tramadol', 'tramal', 'codeine', 'morphine', 'fentanyl', 'ritalin',
  'methylphenidate', 'pregabalin', 'lyrica', 'gabapentin', 'neurontin',
  'ketamine', 'phenobarbital', 'midazolam', 'clobazam', 'urbanyl',
  'oxazepam', 'seresta', 'buprenorphine', 'subutex', 'methadone'
];

const ANTIBIOTIC_PATTERNS = [
  'amoxicillin', 'augmentin', 'clav', 'ciprofloxacin', 'cipro', 'azithromycin',
  'zithromax', 'ceftriaxone', 'rocephin', 'cefixime', 'suprax', 'clarithromycin',
  'klacid', 'levofloxacin', 'tavanic', 'doxycycline', 'vibramycin', 'metronidazole',
  'flagyl', 'gentamicin', 'amikacin', 'meropenem', 'vancomycin'
];

export interface ControlledDispensationItem {
  id: string;
  saleId: string;
  receiptNumber: string;
  timestamp: number;
  dateStr: string;
  patientName: string;
  patientPhone: string;
  productName: string;
  productCode: string;
  dosage: string;
  form: string;
  presentation: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  isPiece: boolean;
  totalUSD: number;
  cashierName: string;
  classification: 'Narcotic / Schedule II' | 'Psychotropic / Schedule III-IV' | 'Antibiotic Rx' | 'Prescription Drug';
  doctorName: string;
  rxNumber: string;
  rxStatus: 'Verified Original' | 'Chronic Refill' | 'Telephone Emergency' | 'Hospital Discharge';
}

export const ControlledDispensationReport: React.FC = () => {
  const { sales, products, customers, settings, exchangeRate } = usePharmacy();

  // Date filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [datePreset, setDatePreset] = useState<'today' | '7days' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Filter scopes
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL_CONTROLLED');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Editable Doctor & Rx override map for report session compliance
  const [doctorOverrides, setDoctorOverrides] = useState<Record<string, { doctorName?: string; rxNumber?: string; rxStatus?: any }>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempDoctor, setTempDoctor] = useState<string>('');
  const [tempRxNum, setTempRxNum] = useState<string>('');
  const [tempStatus, setTempStatus] = useState<string>('Verified Original');

  const handleDatePreset = (preset: 'today' | '7days' | 'month' | 'custom') => {
    setDatePreset(preset);
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  // Build product lookup map
  const productLookup = useMemo(() => {
    const map = new Map<string, typeof products[0]>();
    products.forEach((p) => {
      map.set(p.id, p);
      map.set(p.code, p);
    });
    return map;
  }, [products]);

  // Customer phone lookup
  const customerLookup = useMemo(() => {
    const map = new Map<string, typeof customers[0]>();
    customers.forEach((c) => {
      map.set(c.id, c);
      map.set(c.name.toLowerCase(), c);
    });
    return map;
  }, [customers]);

  // Scan all sales to find controlled, psychotropic, narcotic, or prescription dispenses
  const controlledRecords = useMemo<ControlledDispensationItem[]>(() => {
    const records: ControlledDispensationItem[] = [];

    sales.forEach((sale) => {
      if (sale.isUnreal) return;
      const saleDate = new Date(sale.timestamp || sale.date).toISOString().split('T')[0];
      if (saleDate < startDate || saleDate > endDate) return;

      const matchedCustomer = sale.customerId
        ? customerLookup.get(sale.customerId)
        : sale.customerName
        ? customerLookup.get(sale.customerName.toLowerCase())
        : undefined;

      sale.items.forEach((item, idx) => {
        const prod = productLookup.get(item.productId) || productLookup.get(item.productCode);
        const nameLower = (item.productName || '').toLowerCase();
        const ingredientsLower = (prod?.ingredients || '').toLowerCase();
        const scientificLower = (prod?.scientificInfo?.indications || '').toLowerCase();

        // Check Narcotic / Controlled
        const isNarcotic =
          nameLower.includes('morphine') ||
          nameLower.includes('fentanyl') ||
          nameLower.includes('tramadol') ||
          nameLower.includes('tramal') ||
          nameLower.includes('codeine') ||
          nameLower.includes('ritalin') ||
          nameLower.includes('buprenorphine');

        const isPsychotropic =
          !isNarcotic &&
          SCHEDULED_PATTERNS.some(
            (term) =>
              nameLower.includes(term) ||
              ingredientsLower.includes(term) ||
              scientificLower.includes(term)
          );

        const isAntibiotic =
          !isNarcotic &&
          !isPsychotropic &&
          ANTIBIOTIC_PATTERNS.some(
            (term) =>
              nameLower.includes(term) ||
              ingredientsLower.includes(term)
          );

        // Prescription drug
        const isDrug = item.category === 'drug';

        let classification: ControlledDispensationItem['classification'] | null = null;
        if (isNarcotic) {
          classification = 'Narcotic / Schedule II';
        } else if (isPsychotropic) {
          classification = 'Psychotropic / Schedule III-IV';
        } else if (isAntibiotic) {
          classification = 'Antibiotic Rx';
        } else if (isDrug) {
          classification = 'Prescription Drug';
        }

        if (!classification) return;

        const recordId = `${sale.id}_${item.productId || item.productCode}_${idx}`;
        const override = doctorOverrides[recordId];

        // Parse doctor from sale notes if present (e.g. "Dr. Samir - Rx #104")
        let docName = override?.doctorName || 'Attending Physician';
        let rxNum = override?.rxNumber || (sale.invoiceNumber || sale.receiptNumber || 'RX-LOC');
        let rxStat = override?.rxStatus || 'Verified Original';

        if (!override && sale.notes && sale.notes.toLowerCase().includes('dr')) {
          docName = sale.notes;
        }

        records.push({
          id: recordId,
          saleId: sale.id,
          receiptNumber: sale.invoiceNumber || sale.receiptNumber || 'N/A',
          timestamp: sale.timestamp || new Date(sale.date).getTime(),
          dateStr: saleDate,
          patientName: sale.customerName || matchedCustomer?.name || 'Walk-in Patient',
          patientPhone: matchedCustomer?.phone || '-',
          productName: item.productName,
          productCode: item.productCode,
          dosage: prod?.dosage || '-',
          form: prod?.form || '-',
          presentation: prod?.presentation || '-',
          batchNumber: item.selectedBatchNumber || prod?.batchNumber || 'MOPH-BATCH',
          expiryDate: item.selectedExpiryDate || prod?.expiryDate || 'N/A',
          quantity: item.quantity,
          isPiece: !!item.isPiece,
          totalUSD: item.totalUSD,
          cashierName: sale.cashierName || 'Pharmacist',
          classification,
          doctorName: docName,
          rxNumber: rxNum,
          rxStatus: rxStat,
        });
      });
    });

    return records.sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, startDate, endDate, productLookup, customerLookup, doctorOverrides]);

  // Filtered by classification and search
  const filteredRecords = useMemo(() => {
    return controlledRecords.filter((rec) => {
      // Classification filter
      if (classificationFilter === 'NARCOTIC_ONLY' && rec.classification !== 'Narcotic / Schedule II') {
        return false;
      }
      if (
        classificationFilter === 'ALL_CONTROLLED' &&
        rec.classification !== 'Narcotic / Schedule II' &&
        rec.classification !== 'Psychotropic / Schedule III-IV'
      ) {
        return false;
      }
      if (classificationFilter === 'ANTIBIOTIC_ONLY' && rec.classification !== 'Antibiotic Rx') {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          rec.patientName.toLowerCase().includes(q) ||
          rec.productName.toLowerCase().includes(q) ||
          rec.doctorName.toLowerCase().includes(q) ||
          rec.batchNumber.toLowerCase().includes(q) ||
          rec.receiptNumber.toLowerCase().includes(q) ||
          rec.rxNumber.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [controlledRecords, classificationFilter, searchTerm]);

  // Summary Metrics
  const summary = useMemo(() => {
    let narcoticCount = 0;
    let psychotropicCount = 0;
    let antibioticCount = 0;
    let prescriptionCount = 0;
    const patientSet = new Set<string>();

    filteredRecords.forEach((r) => {
      patientSet.add(r.patientName.toLowerCase());
      if (r.classification === 'Narcotic / Schedule II') narcoticCount += r.quantity;
      if (r.classification === 'Psychotropic / Schedule III-IV') psychotropicCount += r.quantity;
      if (r.classification === 'Antibiotic Rx') antibioticCount += r.quantity;
      if (r.classification === 'Prescription Drug') prescriptionCount += r.quantity;
    });

    return {
      totalEntries: filteredRecords.length,
      distinctPatients: patientSet.size,
      narcoticCount,
      psychotropicCount,
      antibioticCount,
      totalUnits: narcoticCount + psychotropicCount + antibioticCount + prescriptionCount,
    };
  }, [filteredRecords]);

  // Start inline edit
  const handleStartEdit = (rec: ControlledDispensationItem) => {
    setEditingItemId(rec.id);
    setTempDoctor(rec.doctorName);
    setTempRxNum(rec.rxNumber);
    setTempStatus(rec.rxStatus);
  };

  const handleSaveEdit = (recId: string) => {
    setDoctorOverrides((prev) => ({
      ...prev,
      [recId]: {
        doctorName: tempDoctor.trim() || 'Attending Physician',
        rxNumber: tempRxNum.trim() || 'RX-MOPH',
        rxStatus: tempStatus as any,
      },
    }));
    setEditingItemId(null);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Time',
      'Rx / Receipt #',
      'Patient Name',
      'Patient Phone',
      'Prescribing Doctor',
      'Medication Name',
      'Code',
      'Dosage',
      'Batch Number',
      'Expiry Date',
      'Quantity Dispensed',
      'Unit Type',
      'Classification',
      'Dispensing Pharmacist',
      'Status',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.dateStr}"`,
      `"${formatTime(r.timestamp)}"`,
      `"${r.rxNumber}"`,
      `"${r.patientName.replace(/"/g, '""')}"`,
      `"${r.patientPhone}"`,
      `"${r.doctorName.replace(/"/g, '""')}"`,
      `"${r.productName.replace(/"/g, '""')}"`,
      `"${r.productCode}"`,
      `"${r.dosage}"`,
      `"${r.batchNumber}"`,
      `"${r.expiryDate}"`,
      r.quantity,
      r.isPiece ? 'Piece' : 'Box',
      `"${r.classification}"`,
      `"${r.cashierName}"`,
      `"${r.rxStatus}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Controlled_Drugs_Register_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Ribbon Controls */}
      <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 rounded border border-gray-200 bg-gray-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => handleDatePreset('today')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'today'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('7days')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === '7days'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('month')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'month'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('custom')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'custom'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Custom
              </button>
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-gray-500">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center space-x-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Register CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={filteredRecords.length === 0}
              className="flex items-center space-x-1.5 rounded bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Official Register</span>
            </button>
          </div>
        </div>

        {/* Filter Selection Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2.5">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Regulatory Classification Scope
            </label>
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="w-full rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL_CONTROLLED">Scheduled Psychotropics & Narcotics (Audit Scope)</option>
              <option value="NARCOTIC_ONLY">Schedule II (Narcotics & Opioids only)</option>
              <option value="ANTIBIOTIC_ONLY">Restricted Antibiotics Log</option>
              <option value="ALL_RX">All Prescriptions & Dispensed Medications</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Search Patient, Drug, Batch or Doctor
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search patient, medication, batch #, doctor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded border border-gray-200 bg-white pl-7 pr-2.5 py-1 text-xs text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
            </div>
          </div>

          <div className="flex items-center justify-end text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              <span>Complies with Lebanese MOPH Pharmacy Inspection Protocol</span>
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 no-print">
        <div className="rounded border border-red-200 bg-red-50/50 p-2.5 shadow-2xs dark:border-red-950 dark:bg-red-950/20">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-red-700 dark:text-red-400">
            <span>Narcotics (Sched II)</span>
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          </div>
          <div className="mt-1 text-base font-black text-red-700 dark:text-red-400">
            {summary.narcoticCount} units
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Strict locked safe inventory
          </div>
        </div>

        <div className="rounded border border-amber-200 bg-amber-50/50 p-2.5 shadow-2xs dark:border-amber-950 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
            <span>Psychotropics (Sched III-IV)</span>
            <Pill className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="mt-1 text-base font-black text-amber-700 dark:text-amber-400">
            {summary.psychotropicCount} units
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Sedatives & tranquilizers
          </div>
        </div>

        <div className="rounded border border-blue-200 bg-blue-50/50 p-2.5 shadow-2xs dark:border-blue-950 dark:bg-blue-950/20">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400">
            <span>Distinct Patients</span>
            <UserCheck className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="mt-1 text-base font-black text-blue-700 dark:text-blue-400">
            {summary.distinctPatients}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Patients verified with Rx
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Total Logged Entries</span>
            <FileCheck2 className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            {summary.totalEntries} entries
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Total units dispensed: {summary.totalUnits}
          </div>
        </div>
      </div>

      {/* Main Printable Register Block */}
      <div
        id="printable-report"
        className="rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-gray-200 bg-gray-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  {settings.pharmacyName || 'Lebanon Pharma Pro'}
                </h3>
              </div>
              <div className="text-[11px] text-gray-600 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                {settings.pharmacyAddress && <span>{settings.pharmacyAddress}</span>}
                {settings.pharmacyPhone && <span>Tel: {settings.pharmacyPhone}</span>}
                {settings.licenseNumber && <span>MOPH License: #{settings.licenseNumber}</span>}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-black uppercase text-red-800 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-900 inline-block">
                Prescriptions & Controlled Drugs Official Dispensing Register
              </div>
              <div className="text-[10px] text-gray-600 dark:text-slate-400 mt-1">
                Registry Period: <span className="font-bold text-slate-900 dark:text-slate-200">{startDate}</span> to{' '}
                <span className="font-bold text-slate-900 dark:text-slate-200">{endDate}</span>
              </div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">
                In Compliance with Ministry of Public Health (MOPH) Drug Law Regulations
              </div>
            </div>
          </div>
        </div>

        {/* Register Table */}
        <div className="p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-gray-200 bg-gray-100/80 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-2 w-8 text-center">#</th>
                  <th className="py-2 px-2">Date & Time</th>
                  <th className="py-2 px-2">Rx / Receipt</th>
                  <th className="py-2 px-2">Patient Full Name</th>
                  <th className="py-2 px-2">Prescribing Doctor</th>
                  <th className="py-2 px-2">Medication & Dosage</th>
                  <th className="py-2 px-2">Batch / Lot #</th>
                  <th className="py-2 px-2">Expiry</th>
                  <th className="py-2 px-2 text-center">Qty</th>
                  <th className="py-2 px-2">Classification</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-center no-print">Audit Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-6 text-center text-gray-500 italic">
                      No controlled or scheduled medications found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec, idx) => {
                    const isEditing = editingItemId === rec.id;
                    return (
                      <tr key={rec.id} className="hover:bg-teal-50/30 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-center text-[10px] font-mono text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2 font-mono text-[10px] text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {rec.dateStr}{' '}
                          <span className="text-gray-400 text-[9px]">
                            {formatTime(rec.timestamp)}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {rec.rxNumber}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{rec.patientName}</div>
                          <div className="text-[9px] text-gray-400">{rec.patientPhone}</div>
                        </td>
                        <td className="py-2 px-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={tempDoctor}
                              onChange={(e) => setTempDoctor(e.target.value)}
                              className="rounded border border-teal-500 px-1 py-0.5 text-xs text-slate-900 dark:text-white dark:bg-slate-800"
                              placeholder="Doctor Name"
                            />
                          ) : (
                            <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-300">
                              <Stethoscope className="h-3 w-3 text-gray-400" />
                              <span className="truncate max-w-[130px]">{rec.doctorName}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                            {rec.productName}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate max-w-[180px]">
                            {rec.dosage !== '-' ? rec.dosage : ''} {rec.form !== '-' ? `• ${rec.form}` : ''}
                          </div>
                        </td>
                        <td className="py-2 px-2 font-mono text-[10px] text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {rec.batchNumber}
                        </td>
                        <td className="py-2 px-2 font-mono text-[10px] text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {rec.expiryDate}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold whitespace-nowrap">
                          {rec.quantity} {rec.isPiece ? 'p' : 'bx'}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              rec.classification === 'Narcotic / Schedule II'
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
                                : rec.classification === 'Psychotropic / Schedule III-IV'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                : rec.classification === 'Antibiotic Rx'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {rec.classification}
                          </span>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={tempStatus}
                              onChange={(e) => setTempStatus(e.target.value)}
                              className="rounded border border-teal-500 px-1 py-0.5 text-[10px] text-slate-900 dark:text-white dark:bg-slate-800"
                            >
                              <option value="Verified Original">Verified Original</option>
                              <option value="Chronic Refill">Chronic Refill</option>
                              <option value="Telephone Emergency">Telephone Emergency</option>
                              <option value="Hospital Discharge">Hospital Discharge</option>
                            </select>
                          ) : (
                            <span className="text-[10px] text-gray-600 dark:text-slate-400">{rec.rxStatus}</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap no-print">
                          {isEditing ? (
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(rec.id)}
                                className="p-1 rounded bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
                                title="Save"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                className="p-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(rec)}
                              className="p-1 rounded text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Doctor / Rx details"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Printable Official Stamp & Signature Block */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-6 text-[11px] text-gray-600 dark:text-slate-400">
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200">Official Register Certification</div>
            <div>Duly entered in accordance with the Lebanese Ministry of Public Health Regulations.</div>
          </div>
          <div className="flex items-center space-x-10">
            <div className="text-center">
              <div>Licensed Pharmacist Signature</div>
              <div className="mt-3 font-mono text-slate-400">________________________</div>
            </div>
            <div className="text-center">
              <div>Official Pharmacy Stamp</div>
              <div className="mt-3 font-mono text-slate-400">[ PHARMACY STAMP ]</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
