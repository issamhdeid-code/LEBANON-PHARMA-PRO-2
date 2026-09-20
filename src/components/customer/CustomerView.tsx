import React, { useState, useMemo } from 'react';
import { Users, Plus, Phone, MapPin, HeartPulse, AlertCircle, Edit, Star, Search, Check, X, DollarSign, CreditCard, Trash2, Calendar, Banknote } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Customer } from '../../types/pharmacy';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import { useWindowContext } from '../../context/WindowContext';
import { formatLBPValue } from '../../utils/priceUtils';

const formatDateDDMMYYYY = (dateInput: string | Date | number): string => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const CustomerView: React.FC = () => {
  const { customers, addCustomer, updateCustomer, sales, settings, customerPayments, recordCustomerPayment, updateCustomerPayment, deleteCustomerPayment, exchangeRate, formatLBP, formatUSD } = usePharmacy();
  const { restoreWindow } = useWindowContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'directory' | 'payments'>('directory');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [amountUSDInput, setAmountUSDInput] = useState('');
  const [amountLBPInput, setAmountLBPInput] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'account'>('full');
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'LBP' | 'MIXED'>('USD');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedPaymentCustomerId, setSelectedPaymentCustomerId] = useState<string>('ALL');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+961 ');
  const [address, setAddress] = useState('');
  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');

  const currentPaymentCustomer = useMemo(() => {
    return customers.find(c => c.id === paymentCustomerId);
  }, [customers, paymentCustomerId]);

  const allPaidInvoiceIds = useMemo(() => {
    return new Set(customerPayments.flatMap(p => p.invoices || []));
  }, [customerPayments]);

  const saleRemainingMap = useMemo(() => {
    const map = new Map<
      string,
      {
        remainingUSD: number;
        remainingLBP: number;
        origUSD: number;
        origLBP: number;
        isSettled: boolean;
        isPartial: boolean;
      }
    >();

    const paymentsByCustomer = new Map<string, typeof customerPayments>();
    customerPayments.forEach(p => {
      if (!p.customerId) return;
      const list = paymentsByCustomer.get(p.customerId) || [];
      list.push(p);
      paymentsByCustomer.set(p.customerId, list);
    });

    const salesByCustomer = new Map<string, typeof sales>();
    sales.forEach(s => {
      if (!s.customerId) return;
      const list = salesByCustomer.get(s.customerId) || [];
      list.push(s);
      salesByCustomer.set(s.customerId, list);
    });

    salesByCustomer.forEach((custSales, custId) => {
      // 1. All non-credit sales were paid at checkout (cash/card) -> settled with 0 remaining
      custSales.forEach(s => {
        if (s.paymentMethod !== 'credit_debt') {
          const origLBP = s.totalLBP || Math.round(s.totalUSD * (exchangeRate || 1));
          map.set(s.id, {
            remainingUSD: 0,
            remainingLBP: 0,
            origUSD: s.totalUSD,
            origLBP,
            isSettled: true,
            isPartial: false,
          });
        }
      });

      // 2. Track credit sales
      const creditSales = custSales
        .filter(s => s.paymentMethod === 'credit_debt')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (creditSales.length === 0) return;

      // Track running state for each credit sale
      const salesState = creditSales.map(s => {
        const origUSD = s.totalUSD;
        const origLBP = s.totalLBP || Math.round(s.totalUSD * (exchangeRate || 1));
        return {
          sale: s,
          origUSD,
          origLBP,
          remainingUSD: origUSD,
          remainingLBP: origLBP,
        };
      });

      // Sort customer payments chronologically
      const custPayments = (paymentsByCustomer.get(custId) || []).slice().sort(
        (a, b) => (a.timestamp || new Date(a.date).getTime()) - (b.timestamp || new Date(b.date).getTime())
      );

      custPayments.forEach(p => {
        // Calculate payment value in USD and LBP
        let payUSD = 0;
        let payLBP = 0;
        if (p.currency === 'USD') {
          payUSD = p.amountUSD != null ? p.amountUSD : p.amount;
          payLBP = p.amountLBP != null ? p.amountLBP : payUSD * (exchangeRate || 1);
        } else if (p.currency === 'LBP') {
          payLBP = p.amountLBP != null ? p.amountLBP : p.amount;
          payUSD = p.amountUSD != null ? p.amountUSD : payLBP / (exchangeRate || 1);
        } else if (p.currency === 'MIXED') {
          const u = p.amountUSD != null ? p.amountUSD : 0;
          const l = p.amountLBP != null ? p.amountLBP : 0;
          payUSD = u + (l / (exchangeRate || 1));
          payLBP = l + (u * (exchangeRate || 1));
        } else {
          payUSD = p.amount || 0;
          payLBP = payUSD * (exchangeRate || 1);
        }

        if (payUSD <= 0.001 && payLBP <= 1) return;

        // Step A: If the payment specifically targets certain invoices, apply to them first
        const targetedInvRefs = p.invoices || [];
        if (targetedInvRefs.length > 0) {
          salesState.forEach(state => {
            if (payUSD <= 0.001 && payLBP <= 1) return;
            const matches = targetedInvRefs.some(
              invRef => invRef === state.sale.id || invRef === state.sale.invoiceNumber
            );
            if (matches && state.remainingUSD > 0.001) {
              const deductUSD = Math.min(state.remainingUSD, payUSD);
              const deductLBP = Math.min(state.remainingLBP, payLBP);
              state.remainingUSD = Math.max(0, state.remainingUSD - deductUSD);
              state.remainingLBP = Math.max(0, state.remainingLBP - deductLBP);
              payUSD = Math.max(0, payUSD - deductUSD);
              payLBP = Math.max(0, payLBP - deductLBP);
            }
          });
        }

        // Step B: If there is remaining unassigned payment value (or no specific invoices were selected),
        // apply to remaining unpaid credit sales in FIFO order
        if (payUSD > 0.001 || payLBP > 1) {
          salesState.forEach(state => {
            if (payUSD <= 0.001 && payLBP <= 1) return;
            if (state.remainingUSD > 0.001) {
              const deductUSD = Math.min(state.remainingUSD, payUSD);
              const deductLBP = Math.min(state.remainingLBP, payLBP);
              state.remainingUSD = Math.max(0, state.remainingUSD - deductUSD);
              state.remainingLBP = Math.max(0, state.remainingLBP - deductLBP);
              payUSD = Math.max(0, payUSD - deductUSD);
              payLBP = Math.max(0, payLBP - deductLBP);
            }
          });
        }
      });

      // Now save each credit sale's final remaining state into the map
      salesState.forEach(state => {
        let finalRemUSD = Number(state.remainingUSD.toFixed(2));
        let finalRemLBP = Math.round(state.remainingLBP);

        if (finalRemUSD <= 0.005) {
          finalRemUSD = 0;
          finalRemLBP = 0;
        } else if (state.origUSD > 0) {
          // Keep LBP and USD remaining in exact proportional sync
          finalRemLBP = Math.round(state.origLBP * (finalRemUSD / state.origUSD));
        }

        const isSettled = finalRemUSD <= 0.005;
        const isPartial = !isSettled && (finalRemUSD < state.origUSD - 0.005);

        map.set(state.sale.id, {
          remainingUSD: isSettled ? 0 : finalRemUSD,
          remainingLBP: isSettled ? 0 : finalRemLBP,
          origUSD: state.origUSD,
          origLBP: state.origLBP,
          isSettled,
          isPartial,
        });
      });
    });

    return map;
  }, [sales, customerPayments, exchangeRate]);

  const unpaidCustomerSales = useMemo(() => {
    if (!paymentCustomerId) return [];
    return sales.filter(s => {
      if (s.customerId !== paymentCustomerId || s.paymentMethod !== 'credit_debt') return false;
      const rem = saleRemainingMap.get(s.id);
      if (rem) {
        return !rem.isSettled && rem.remainingUSD > 0.005;
      }
      return s.totalUSD > 0;
    });
  }, [sales, paymentCustomerId, saleRemainingMap]);

  const selectedInvoicesTotal = useMemo(() => {
    let usd = 0;
    let lbp = 0;
    selectedInvoices.forEach(id => {
      const sale = unpaidCustomerSales.find(s => s.id === id);
      if (sale) {
        const rem = saleRemainingMap.get(sale.id);
        const remUSD = rem ? rem.remainingUSD : sale.totalUSD;
        const remLBP = rem ? rem.remainingLBP : (sale.totalLBP || Math.round(sale.totalUSD * (exchangeRate || 1)));
        usd += remUSD;
        lbp += remLBP;
      }
    });
    return { usd, lbp };
  }, [selectedInvoices, unpaidCustomerSales, saleRemainingMap, exchangeRate]);

  const targetDebtAmount = useMemo(() => {
    if (selectedInvoices.length > 0) {
      return {
        usd: selectedInvoicesTotal.usd,
        lbp: selectedInvoicesTotal.lbp,
      };
    }
    const custBalUSD = currentPaymentCustomer?.balanceUSD || 0;
    const custBalLBP = currentPaymentCustomer?.balanceLBP || 0;
    const totalUSD = custBalUSD > 0 ? custBalUSD : (custBalLBP / (exchangeRate || 1));
    const totalLBP = custBalLBP > 0 ? custBalLBP : Math.round(custBalUSD * (exchangeRate || 1));
    return {
      usd: totalUSD,
      lbp: totalLBP,
    };
  }, [selectedInvoices, selectedInvoicesTotal, currentPaymentCustomer, exchangeRate]);

  const currentEnteredUSD = parseFloat(amountUSDInput.replace(/,/g, '')) || 0;
  const currentEnteredLBP = parseFloat(amountLBPInput.replace(/,/g, '')) || 0;
  const totalEnteredInUSD = currentEnteredUSD + (currentEnteredLBP / (exchangeRate || 1));
  const totalEnteredInLBP = currentEnteredLBP + (currentEnteredUSD * (exchangeRate || 1));
  const remainingToSettleUSD = Math.max(0, Number((targetDebtAmount.usd - totalEnteredInUSD).toFixed(2)));
  const remainingToSettleLBP = Math.max(0, Math.round(targetDebtAmount.lbp - totalEnteredInLBP));

  const handleUSDChange = (rawVal: string) => {
    const clean = rawVal.replace(/[^0-9.]/g, '');
    setAmountUSDInput(clean);

    // Auto calculate companion currency if settling all amount
    if (paymentType === 'full' && targetDebtAmount.usd > 0) {
      if (clean.trim() === '') {
        setAmountLBPInput(formatLBPValue(Math.round(targetDebtAmount.lbp)));
      } else {
        const numUSD = parseFloat(clean);
        if (!isNaN(numUSD)) {
          const remUSD = Math.max(0, targetDebtAmount.usd - numUSD);
          const remLBP = Math.round(remUSD * (exchangeRate || 1));
          setAmountLBPInput(formatLBPValue(remLBP));
        }
      }
    }
  };

  const handleLBPChange = (rawVal: string) => {
    const clean = rawVal.replace(/[^0-9]/g, '');
    const formatted = clean ? formatLBPValue(parseInt(clean, 10)) : '';
    setAmountLBPInput(formatted);

    // Auto calculate companion currency if settling all amount
    if (paymentType === 'full' && targetDebtAmount.lbp > 0) {
      if (clean.trim() === '') {
        setAmountUSDInput(targetDebtAmount.usd.toFixed(2));
      } else {
        const numLBP = parseFloat(clean);
        if (!isNaN(numLBP)) {
          const remLBP = Math.max(0, targetDebtAmount.lbp - numLBP);
          const remUSD = Number((remLBP / (exchangeRate || 1)).toFixed(2));
          setAmountUSDInput(remUSD.toFixed(2));
        }
      }
    }
  };

  const openPaymentModal = (custId: string, paymentId?: string) => {
    restoreWindow('customer_payment');
    restoreWindow('record customer payment');
    setPaymentCustomerId(custId);

    const cust = customers.find(c => c.id === custId);
    const totalUSD = (cust?.balanceUSD || 0) > 0 ? (cust?.balanceUSD || 0) : ((cust?.balanceLBP || 0) / (exchangeRate || 1));
    const totalLBP = (cust?.balanceLBP || 0) > 0 ? (cust?.balanceLBP || 0) : Math.round((cust?.balanceUSD || 0) * (exchangeRate || 1));

    if (paymentId) {
      const p = customerPayments.find(p => p.id === paymentId);
      if (p) {
        setPaymentCurrency(p.currency);
        setPaymentMethod(p.method);
        setPaymentNumber(p.paymentNumber || '');
        setPaymentNotes(p.notes || '');
        setPaymentType(p.isPaymentOnAccount ? 'account' : 'full');
        setEditingPaymentId(paymentId);
        setSelectedInvoices(p.invoices || []);
        if (p.currency === 'MIXED') {
          setAmountUSDInput(p.amountUSD != null ? p.amountUSD.toString() : '');
          setAmountLBPInput(p.amountLBP != null ? formatLBPValue(p.amountLBP) : '');
          setPaymentAmount('');
        } else {
          setPaymentAmount(p.currency === 'USD' ? p.amount.toString() : formatLBPValue(p.amount));
          setAmountUSDInput('');
          setAmountLBPInput('');
        }
      }
    } else {
      setPaymentCurrency('USD');
      setPaymentMethod('cash');
      setPaymentNumber('');
      setPaymentNotes('');
      setPaymentType('full');
      setEditingPaymentId(null);
      setSelectedInvoices([]);
      setPaymentAmount(totalUSD > 0 ? totalUSD.toFixed(2) : '');
      setAmountUSDInput(totalUSD > 0 ? totalUSD.toFixed(2) : '');
      setAmountLBPInput('0');
    }
    setIsPaymentModalOpen(true);
  };
  
  const handleDeletePayment = (paymentId: string) => {
    // iframe safe deletion
    deleteCustomerPayment(paymentId);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomerId) return;
    
    const cust = customers.find(c => c.id === paymentCustomerId);
    if (!cust) return;
    
    let finalAmount = 0;
    let finalUSD = 0;
    let finalLBP = 0;

    if (paymentCurrency === 'MIXED') {
      finalUSD = currentEnteredUSD;
      finalLBP = currentEnteredLBP;
      if (finalUSD <= 0 && finalLBP <= 0) return;
      finalAmount = Number((finalUSD + (finalLBP / (exchangeRate || 1))).toFixed(2));
    } else if (paymentType === 'full') {
      finalAmount = paymentCurrency === 'USD' ? targetDebtAmount.usd : targetDebtAmount.lbp;
      if (finalAmount <= 0) return;
      if (paymentCurrency === 'USD') finalUSD = finalAmount;
      else finalLBP = finalAmount;
    } else {
      finalAmount = parseFloat(paymentAmount.replace(/,/g, '')) || 0;
      if (finalAmount <= 0) return;
      if (paymentCurrency === 'USD') finalUSD = finalAmount;
      else finalLBP = finalAmount;
    }
    
    const payload = {
      customerId: cust.id,
      customerName: cust.name,
      amount: finalAmount,
      currency: paymentCurrency,
      amountUSD: finalUSD,
      amountLBP: finalLBP,
      method: paymentMethod,
      paymentNumber: paymentMethod === 'card' && paymentNumber.trim() ? paymentNumber.trim() : undefined,
      notes: paymentNotes.trim() ? paymentNotes.trim() : undefined,
      date: new Date().toISOString(),
      invoices: selectedInvoices,
      isPaymentOnAccount: paymentType === 'account',
    };

    if (editingPaymentId) {
      updateCustomerPayment(editingPaymentId, payload);
    } else {
      recordCustomerPayment(payload);
    }
    
    setIsPaymentModalOpen(false);
    setPaymentCustomerId(null);
    setEditingPaymentId(null);
    setSelectedInvoices([]);
    setPaymentNumber('');
    setPaymentNotes('');
  };
  const openAddModal = () => {
    restoreWindow('new_patient_profile');
    restoreWindow('edit_patient_file');
    restoreWindow('patient');
    setEditingCustomerId(null);
    setName('');
    setPhone('+961 ');
    setAddress('Beirut, Lebanon');
    setBloodType('O+');
    setAllergies('');
    setChronicConditions('');
    setIsModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    restoreWindow('edit_patient_file');
    restoreWindow('new_patient_profile');
    restoreWindow('patient');
    setEditingCustomerId(cust.id);
    setName(cust.name);
    setPhone(cust.phone);
    setAddress(cust.address);
    setBloodType(cust.bloodType || 'O+');
    setAllergies(cust.allergies || '');
    setChronicConditions(cust.chronicConditions || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomerId) {
      updateCustomer(editingCustomerId, {
        name,
        phone,
        address,
        bloodType,
        allergies,
        chronicConditions,
      });
    } else {
      addCustomer({
        name,
        phone,
        address,
        bloodType,
        allergies,
        chronicConditions,
        balanceUSD: 0,
        balanceLBP: 0,
        loyaltyPoints: 10,
        lastVisit: new Date().toISOString().split('T')[0],
      });
    }
    setIsModalOpen(false);
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.allergies?.toLowerCase().includes(q) ||
      c.chronicConditions?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 p-3.5 space-y-3 select-none">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center space-x-2">
              <SectionRestoreButton section="customer" />
              <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                Patients & Customers
              </h2>
              <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">
                {customers.length} Patients
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Record patient drug allergies, chronic conditions, loyalty points, and counter account balances.
            </p>
          </div>
          {activeTab === 'directory' && (
            <button
              onClick={openAddModal}
              className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Patient Profile</span>
            </button>
          )}
        </div>

        {/* Subtabs */}
        <div className="flex space-x-4 border-b border-gray-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('directory')}
            className={`pb-2 text-xs font-bold cursor-pointer transition-colors ${
              activeTab === 'directory'
                ? 'border-b-2 border-teal-500 text-teal-600 dark:text-teal-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Directory
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-2 text-xs font-bold cursor-pointer transition-colors ${
              activeTab === 'payments'
                ? 'border-b-2 border-teal-500 text-teal-600 dark:text-teal-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Payments
          </button>
        </div>
      </div>

      {activeTab === 'directory' && (
        <>
          {/* Search Filter */}
          <div className="rounded border border-gray-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient by name, phone number, or known allergy (e.g. Penicillin)..."
            className="w-full rounded border border-gray-200 bg-gray-50 pl-8 pr-3 py-1 text-xs text-slate-800 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Grid of Patients */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredCustomers.map((cust) => {
            const customerSales = sales.filter((s) => s.customerId === cust.id);

            return (
              <div
                key={cust.id}
                className="flex flex-col justify-between rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 hover:border-teal-400 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-teal-50 font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300 text-xs border border-teal-200 dark:border-teal-900">
                        {cust.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {cust.name}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(cust)}
                      className="p-1 text-gray-400 hover:text-teal-600 dark:hover:text-teal-300 cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Medical Alerts: Allergies & Chronic Conditions */}
                  <div className="mt-2.5 space-y-1.5 text-xs">
                    {cust.allergies && (
                      <div className="flex items-start rounded bg-rose-50 p-1.5 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] border border-rose-200 dark:border-rose-900">
                        <AlertCircle className="mr-1.5 h-3 w-3 shrink-0 text-rose-600 mt-0.5" />
                        <span>
                          <strong className="font-bold">Allergy Warning: </strong>
                          {cust.allergies}
                        </span>
                      </div>
                    )}

                    {cust.chronicConditions && (
                      <div className="flex items-start rounded bg-blue-50 p-1.5 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[11px] border border-blue-200 dark:border-blue-900">
                        <HeartPulse className="mr-1.5 h-3 w-3 shrink-0 text-blue-600 mt-0.5" />
                        <span>
                          <strong className="font-bold">Chronic: </strong>
                          {cust.chronicConditions}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                      <span>Blood Type: <strong>{cust.bloodType || 'N/A'}</strong></span>
                      <span className="flex items-center text-amber-600 dark:text-amber-400 font-semibold">
                        <Star className="h-2.5 w-2.5 mr-1 fill-amber-400 text-amber-400" />
                        {cust.loyaltyPoints} Loyalty Pts
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-gray-400">Debt Balance</span>
                    <span
                      className={`font-bold text-[11px] ${
                        cust.balanceUSD > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      ${cust.balanceUSD.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-semibold text-gray-400">Total Visits</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      {customerSales.length} Rx Orders
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

        </>
      )}
      
      {activeTab === 'payments' && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Customer Filter */}
          <div className="flex items-center gap-2 rounded border border-gray-200 bg-white p-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Filter by Patient:</label>
            <select
              value={selectedPaymentCustomerId}
              onChange={(e) => setSelectedPaymentCustomerId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 flex-1 max-w-md"
            >
              <option value="ALL">-- All Patients --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — Balance: ${(c.balanceUSD || 0).toFixed(2)} / {formatLBPValue(c.balanceLBP || 0)} LBP
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden">
            {/* Left Column: Balances or Transactions */}
            <div className="flex-1 flex flex-col overflow-y-auto rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                 <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                   {selectedPaymentCustomerId === 'ALL' ? 'Customer Balances' : 'Customer Transactions (Sales)'}
                 </h3>
                 {selectedPaymentCustomerId !== 'ALL' && (
                   <div className="flex items-center gap-2">
                     {(() => {
                       const selCust = customers.find(c => c.id === selectedPaymentCustomerId);
                       if (!selCust) return null;
                       const balUSD = selCust.balanceUSD || 0;
                       const balLBP = selCust.balanceLBP || 0;
                       const hasDebt = balUSD > 0 || balLBP > 0;
                       return (
                         <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                           hasDebt
                             ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900'
                             : 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900'
                         }`}>
                           Remaining Debt: ${balUSD.toFixed(2)} / {formatLBPValue(balLBP)} LBP
                         </span>
                       );
                     })()}
                     <span className="text-[10px] text-gray-500 dark:text-gray-400">
                       Total Visits: {sales.filter(s => s.customerId === selectedPaymentCustomerId).length}
                     </span>
                   </div>
                 )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedPaymentCustomerId === 'ALL' ? (
                  <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 whitespace-nowrap align-middle">Patient</th>
                        <th className="px-4 py-2.5 text-right whitespace-nowrap align-middle">Debt (USD)</th>
                        <th className="px-4 py-2.5 text-right whitespace-nowrap align-middle">Debt (LBP)</th>
                        <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {filteredCustomers.filter(c => c.balanceUSD > 0 || c.balanceLBP > 0).map((cust) => (
                        <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-2.5 font-semibold whitespace-nowrap align-middle">{cust.name}</td>
                          <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap align-middle ${cust.balanceUSD > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            ${cust.balanceUSD.toFixed(2)}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap align-middle ${cust.balanceLBP > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {cust.balanceLBP.toLocaleString()} LBP
                          </td>
                          <td className="px-4 py-2.5 text-center whitespace-nowrap align-middle">
                            <button
                              onClick={() => openPaymentModal(cust.id)}
                              className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700 border border-teal-200 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 transition-colors cursor-pointer"
                            >
                              <DollarSign className="h-3 w-3" />
                              Pay
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredCustomers.filter(c => c.balanceUSD > 0 || c.balanceLBP > 0).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                            No outstanding balances.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 whitespace-nowrap align-middle">Date</th>
                        <th className="px-4 py-2.5 whitespace-nowrap align-middle">Invoice #</th>
                        <th className="px-4 py-2.5 text-right whitespace-nowrap align-middle">Remaining (USD)</th>
                        <th className="px-4 py-2.5 text-right whitespace-nowrap align-middle">Remaining (LBP)</th>
                        <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {sales.filter(s => s.customerId === selectedPaymentCustomerId).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                            No transactions found for this customer.
                          </td>
                        </tr>
                      ) : (
                        sales.filter(s => s.customerId === selectedPaymentCustomerId).map((sale) => {
                          const remData = saleRemainingMap.get(sale.id) || {
                            remainingUSD: sale.paymentMethod === 'credit_debt' ? sale.totalUSD : 0,
                            remainingLBP: sale.paymentMethod === 'credit_debt' ? (sale.totalLBP || Math.round(sale.totalUSD * (exchangeRate || 1))) : 0,
                            origUSD: sale.totalUSD,
                            origLBP: sale.totalLBP || Math.round(sale.totalUSD * (exchangeRate || 1)),
                            isSettled: sale.paymentMethod !== 'credit_debt',
                            isPartial: false,
                          };
                          const { remainingUSD, remainingLBP, origUSD, origLBP, isSettled, isPartial } = remData;

                          return (
                            <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap align-middle">{formatDateDDMMYYYY(sale.date)}</td>
                              <td className="px-4 py-2.5 font-semibold whitespace-nowrap align-middle">{sale.invoiceNumber}</td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap align-middle">
                                <div className={`font-bold ${isSettled ? 'text-slate-400 dark:text-slate-500' : 'text-rose-600 dark:text-rose-400'}`}>
                                  ${remainingUSD.toFixed(2)}
                                </div>
                                {isPartial && (
                                  <div className="text-[9px] text-slate-400 font-normal">Orig: ${origUSD.toFixed(2)}</div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap align-middle">
                                <div className={`font-bold ${isSettled ? 'text-slate-400 dark:text-slate-500' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {formatLBPValue(remainingLBP)} LBP
                                </div>
                                {isPartial && (
                                  <div className="text-[9px] text-slate-400 font-normal">Orig: {formatLBPValue(origLBP)} LBP</div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center whitespace-nowrap align-middle">
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap ${
                                    isSettled
                                      ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300'
                                      : isPartial
                                        ? 'bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950 dark:text-sky-300'
                                        : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                                  }`}
                                >
                                  {isSettled ? 'Settled (Paid)' : isPartial ? 'Partially Paid' : 'Pending Debt'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            
            {/* Right Column: Recent Payments */}
            <div className="flex-1 flex flex-col overflow-y-auto rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                 <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Recent Payments</h3>
                 {selectedPaymentCustomerId !== 'ALL' && (
                   <button
                     onClick={() => openPaymentModal(selectedPaymentCustomerId)}
                     className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700 border border-teal-200 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 transition-colors cursor-pointer"
                   >
                     <DollarSign className="h-3 w-3" />
                     New Payment
                   </button>
                 )}
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 whitespace-nowrap align-middle">Date</th>
                      {selectedPaymentCustomerId === 'ALL' && <th className="px-4 py-2.5 whitespace-nowrap align-middle">Patient</th>}
                      <th className="px-4 py-2.5 text-right whitespace-nowrap align-middle">Amount</th>
                      <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {customerPayments.filter(p => selectedPaymentCustomerId === 'ALL' || p.customerId === selectedPaymentCustomerId).length === 0 ? (
                      <tr>
                        <td colSpan={selectedPaymentCustomerId === 'ALL' ? 4 : 3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      customerPayments
                        .filter(p => selectedPaymentCustomerId === 'ALL' || p.customerId === selectedPaymentCustomerId)
                        .map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap align-middle">
                            {formatDateDDMMYYYY(payment.date)}
                          </td>
                          {selectedPaymentCustomerId === 'ALL' && (
                            <td className="px-4 py-2.5 font-semibold whitespace-nowrap align-middle">{payment.customerName}</td>
                          )}
                          <td className="px-4 py-2.5 text-right whitespace-nowrap align-middle">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <span className="font-bold text-teal-600 dark:text-teal-400">
                                {payment.currency === 'MIXED'
                                  ? `$${(payment.amountUSD || 0).toFixed(2)} + ${formatLBPValue(payment.amountLBP || 0)} LBP`
                                  : payment.currency === 'USD'
                                    ? `$${payment.amount.toFixed(2)}`
                                    : `${formatLBPValue(payment.amount)} LBP`}
                              </span>
                              {payment.method === 'card' && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  <CreditCard className="h-3 w-3 inline text-teal-600 dark:text-teal-400" />
                                  <span>{payment.paymentNumber ? `#${payment.paymentNumber}` : 'Card'}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center whitespace-nowrap align-middle">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openPaymentModal(payment.customerId, payment.id)}
                                className="p-1 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Patient Modal */}
      {isModalOpen && (
        <DesktopWindow
          title={editingCustomerId ? 'Edit Patient File' : 'New Patient Profile'}
          isOpen={true}
          section="customer"
          onClose={() => setIsModalOpen(false)}
          width="480px"
          height="auto"
        >
          <form onSubmit={handleSave} className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Patient Full Name
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Karim Haddad"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phone (Lebanon)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+961 70 123 456"
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Blood Type
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-rose-700 dark:text-rose-400 mb-1.5 flex items-center">
                <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                Drug Allergies (e.g. Penicillin)
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g. Penicillin, Aspirin, None"
                className="w-full rounded-lg border border-rose-200 bg-rose-50/40 px-3 py-2 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-hidden dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center">
                <HeartPulse className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                Chronic Conditions
              </label>
              <input
                type="text"
                value={chronicConditions}
                onChange={(e) => setChronicConditions(e.target.value)}
                placeholder="e.g. Hypertension, Diabetes Type 2"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center">
                <MapPin className="mr-1.5 h-3.5 w-3.5 text-gray-400" />
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Hamra, Beirut"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Discard
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition-all cursor-pointer active:scale-95"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{editingCustomerId ? 'Update Profile' : 'Create Profile'}</span>
              </button>
            </div>
          </form>
        </DesktopWindow>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && paymentCustomerId && (
        <DesktopWindow
          title={editingPaymentId ? "Edit Customer Payment" : "Settle Customer Debt / Record Payment"}
          isOpen={true}
          section="customer"
          onClose={() => setIsPaymentModalOpen(false)}
          width="540px"
          height="auto"
        >
          <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4 text-xs">
            {(() => {
              const cust = currentPaymentCustomer;
              if (!cust) return null;

              // Compute estimated remaining balance after applying this payment
              let deductUSD = 0;
              let deductLBP = 0;
              if (paymentCurrency === 'MIXED') {
                deductUSD = currentEnteredUSD + (currentEnteredLBP / (exchangeRate || 1));
                deductLBP = currentEnteredLBP + (currentEnteredUSD * (exchangeRate || 1));
              } else if (paymentCurrency === 'USD') {
                const amt = paymentType === 'full' ? targetDebtAmount.usd : (parseFloat(paymentAmount.replace(/,/g, '')) || 0);
                deductUSD = amt;
                deductLBP = amt * (exchangeRate || 1);
              } else {
                const amt = paymentType === 'full' ? targetDebtAmount.lbp : (parseFloat(paymentAmount.replace(/,/g, '')) || 0);
                deductLBP = amt;
                deductUSD = amt / (exchangeRate || 1);
              }

              const estimatedBalanceUSD = Math.max(0, Number((cust.balanceUSD - deductUSD).toFixed(2)));
              const estimatedBalanceLBP = Math.max(0, Math.round(cust.balanceLBP - deductLBP));

              return (
                <>
                  {/* Customer Info & Current Balance Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-teal-600" />
                        {cust.name}
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        Rate: 1$ = {formatLBPValue(exchangeRate || 1)} LBP
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                      <div className="bg-white dark:bg-slate-900/60 p-2 rounded border border-rose-100 dark:border-rose-950/40">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Outstanding USD:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">${cust.balanceUSD.toFixed(2)}</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900/60 p-2 rounded border border-rose-100 dark:border-rose-950/40">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Outstanding LBP:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">{formatLBPValue(cust.balanceLBP)} LBP</span>
                      </div>
                    </div>

                    {/* Unpaid Transactions List */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                          Select Invoices to Settle
                        </label>
                        {unpaidCustomerSales.length > 0 && (
                          <div className="flex gap-2 text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = unpaidCustomerSales.map(s => s.id);
                                setSelectedInvoices(allIds);
                              }}
                              className="text-teal-600 hover:underline cursor-pointer font-medium"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoices([])}
                              className="text-slate-500 hover:underline cursor-pointer font-medium"
                            >
                              Clear Selection
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                        {unpaidCustomerSales.length === 0 ? (
                          <p className="text-slate-500 dark:text-slate-400 text-center italic py-2 text-[11px]">
                            No separate credit invoices found. Payment will be credited directly to account balance.
                          </p>
                        ) : (
                          unpaidCustomerSales.map(sale => (
                            <label
                              key={sale.id}
                              className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                                selectedInvoices.includes(sale.id)
                                  ? 'bg-teal-50/70 border-teal-300 dark:bg-teal-950/30 dark:border-teal-800'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:checked:bg-teal-500"
                                  checked={selectedInvoices.includes(sale.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedInvoices(prev => [...prev, sale.id]);
                                    } else {
                                      setSelectedInvoices(prev => prev.filter(id => id !== sale.id));
                                    }
                                  }}
                                />
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{sale.invoiceNumber}</span>
                                  <span className="text-[9px] text-slate-500 dark:text-slate-400">{formatDateDDMMYYYY(sale.date)}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-rose-600 dark:text-rose-400">
                                  ${(saleRemainingMap.get(sale.id)?.remainingUSD ?? sale.totalUSD).toFixed(2)}
                                </div>
                                <div className="text-[9px] text-slate-500 dark:text-slate-400">
                                  {saleRemainingMap.get(sale.id)?.isPartial ? 'Rem: ' : ''}
                                  {formatLBPValue(saleRemainingMap.get(sale.id)?.remainingLBP ?? (sale.totalLBP || Math.round(sale.totalUSD * (exchangeRate || 1))))} LBP
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment Settlement Mode: 2 options (Settle All vs Pay on Account) */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Settlement Option
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          paymentType === 'full'
                            ? 'bg-teal-50 border-teal-400 dark:bg-teal-950/40 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-semibold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentType"
                          value="full"
                          checked={paymentType === 'full'}
                          onChange={() => {
                            setPaymentType('full');
                            if (paymentCurrency === 'USD') {
                              setPaymentAmount(targetDebtAmount.usd.toFixed(2));
                            } else if (paymentCurrency === 'LBP') {
                              setPaymentAmount(formatLBPValue(targetDebtAmount.lbp));
                            } else if (paymentCurrency === 'MIXED') {
                              setAmountUSDInput(targetDebtAmount.usd.toFixed(2));
                              setAmountLBPInput('0');
                            }
                          }}
                          className="text-teal-600 focus:ring-teal-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs">Settle All The Amount</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                            Full target: ${targetDebtAmount.usd.toFixed(2)}
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          paymentType === 'account'
                            ? 'bg-teal-50 border-teal-400 dark:bg-teal-950/40 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-semibold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentType"
                          value="account"
                          checked={paymentType === 'account'}
                          onChange={() => setPaymentType('account')}
                          className="text-teal-600 focus:ring-teal-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs">Payment on Account</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                            Custom / partial amount
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Currency & Payment Method */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Currency
                      </label>
                      <select
                        value={paymentCurrency}
                        onChange={(e) => {
                          const newCurr = e.target.value as 'USD' | 'LBP' | 'MIXED';
                          setPaymentCurrency(newCurr);
                          if (newCurr === 'MIXED') {
                            if (paymentType === 'full') {
                              setAmountUSDInput(targetDebtAmount.usd.toFixed(2));
                              setAmountLBPInput('0');
                            }
                          } else if (newCurr === 'USD') {
                            if (paymentType === 'full') {
                              setPaymentAmount(targetDebtAmount.usd.toFixed(2));
                            }
                          } else if (newCurr === 'LBP') {
                            if (paymentType === 'full') {
                              setPaymentAmount(formatLBPValue(targetDebtAmount.lbp));
                            }
                          }
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-medium"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="LBP">LBP (ل.ل)</option>
                        <option value="MIXED">Mixed ($ + L.L.)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card')}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card / Electronic</option>
                      </select>
                    </div>
                  </div>

                  {/* Card / Electronic Details: Payment Number & Note */}
                  {paymentMethod === 'card' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-teal-50/60 dark:bg-teal-950/20 rounded-lg border border-teal-200 dark:border-teal-800/60">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Payment / Transaction #
                        </label>
                        <input
                          type="text"
                          value={paymentNumber}
                          onChange={(e) => setPaymentNumber(e.target.value)}
                          placeholder="e.g. TXN-10482 / Slip #"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Payment Note / Details
                        </label>
                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="e.g. POS terminal, Visa, Whish, OMT"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  )}

                  {/* Payment Amount Input Section */}
                  {paymentCurrency === 'MIXED' ? (
                    <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Mixed Payment Breakdown
                        </span>
                        {paymentType === 'full' && (
                          <span className="text-teal-600 dark:text-teal-400 font-semibold">
                            Auto-calculating companion currency
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Amount in USD ($)
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              inputMode="decimal"
                              value={amountUSDInput}
                              onChange={(e) => handleUSDChange(e.target.value)}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 font-mono text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                          {paymentType === 'full' && remainingToSettleUSD > 0 && currentEnteredUSD < targetDebtAmount.usd && (
                            <button
                              type="button"
                              onClick={() => {
                                const newUSD = targetDebtAmount.usd;
                                setAmountUSDInput(newUSD.toFixed(2));
                                setAmountLBPInput('0');
                              }}
                              className="mt-1 text-[10px] text-teal-600 hover:underline cursor-pointer"
                            >
                              +Fill Full USD (${targetDebtAmount.usd.toFixed(2)})
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Amount in LBP (ل.ل)
                          </label>
                          <div className="relative">
                            <Banknote className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={amountLBPInput}
                              onChange={(e) => handleLBPChange(e.target.value)}
                              placeholder="0"
                              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 font-mono text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                          {paymentType === 'full' && remainingToSettleLBP > 0 && currentEnteredLBP < targetDebtAmount.lbp && (
                            <button
                              type="button"
                              onClick={() => {
                                const newLBP = targetDebtAmount.lbp;
                                setAmountLBPInput(formatLBPValue(newLBP));
                                setAmountUSDInput('0.00');
                              }}
                              className="mt-1 text-[10px] text-teal-600 hover:underline cursor-pointer"
                            >
                              +Fill Full LBP ({formatLBPValue(targetDebtAmount.lbp)} LBP)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mixed Total vs Target Calculation Indicator */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px] space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 dark:text-slate-400">Total Tendered:</span>
                          <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                            ${currentEnteredUSD.toFixed(2)} + {formatLBPValue(currentEnteredLBP)} LBP
                            <span className="text-slate-400 font-normal"> (≈ ${totalEnteredInUSD.toFixed(2)})</span>
                          </span>
                        </div>

                        {paymentType === 'full' && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">Status:</span>
                            {Math.abs(totalEnteredInUSD - targetDebtAmount.usd) < 0.02 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Target Fully Covered
                              </span>
                            ) : totalEnteredInUSD > targetDebtAmount.usd ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                Over target (+${(totalEnteredInUSD - targetDebtAmount.usd).toFixed(2)})
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">
                                Remaining: ${remainingToSettleUSD.toFixed(2)} ({formatLBPValue(remainingToSettleLBP)} LBP)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Amount to Pay ({paymentCurrency === 'USD' ? 'USD $' : 'LBP ل.ل'})
                      </label>
                      <div className="relative">
                        {paymentCurrency === 'USD' ? (
                          <DollarSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <Banknote className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        )}
                        <input
                          type="text"
                          inputMode={paymentCurrency === 'USD' ? 'decimal' : 'numeric'}
                          value={paymentAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (paymentCurrency === 'USD') {
                              setPaymentAmount(val.replace(/[^0-9.]/g, ''));
                            } else {
                              const clean = val.replace(/[^0-9]/g, '');
                              setPaymentAmount(clean ? formatLBPValue(parseInt(clean, 10)) : '');
                            }
                          }}
                          required
                          placeholder={paymentCurrency === 'USD' ? '0.00' : '0'}
                          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 font-mono text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  )}

                  {/* Summary / Resulting Balance Preview */}
                  <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Estimated Balance After Payment:
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      ${estimatedBalanceUSD.toFixed(2)} / {formatLBPValue(estimatedBalanceLBP)} LBP
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsPaymentModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition-all cursor-pointer"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Process Payment</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </form>
        </DesktopWindow>
      )}
    </div>
  );
};
