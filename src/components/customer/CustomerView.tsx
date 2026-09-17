import React, { useState } from 'react';
import { Users, Plus, Phone, MapPin, HeartPulse, AlertCircle, Edit, Star, Search, Check, X, DollarSign, CreditCard, Trash2, Calendar } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Customer } from '../../types/pharmacy';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';

export const CustomerView: React.FC = () => {
  const { customers, addCustomer, updateCustomer, sales, settings, customerPayments, recordCustomerPayment, updateCustomerPayment, deleteCustomerPayment, formatLBP, formatUSD } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'directory' | 'payments'>('directory');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'LBP'>('USD');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
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


  const openPaymentModal = (custId: string, paymentId?: string) => {
    setPaymentCustomerId(custId);
    if (paymentId) {
      const p = customerPayments.find(p => p.id === paymentId);
      if (p) {
        setPaymentAmount(p.amount.toString());
        setPaymentCurrency(p.currency);
        setPaymentMethod(p.method);
        setEditingPaymentId(paymentId);
        setSelectedInvoices(p.invoices || []);
      }
    } else {
      setPaymentAmount('');
      setPaymentCurrency('USD');
      setPaymentMethod('cash');
      setEditingPaymentId(null);
      setSelectedInvoices([]);
    }
    setIsPaymentModalOpen(true);
  };
  
  const handleDeletePayment = (paymentId: string) => {
    // iframe safe deletion
    deleteCustomerPayment(paymentId);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomerId || !paymentAmount) return;
    
    const cust = customers.find(c => c.id === paymentCustomerId);
    if (!cust) return;
    
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) return;
    
    if (editingPaymentId) {
      updateCustomerPayment(editingPaymentId, {
        amount,
        currency: paymentCurrency,
        method: paymentMethod,
        date: new Date().toISOString(),
        invoices: selectedInvoices
      });
    } else {
      recordCustomerPayment({
        customerId: cust.id,
        customerName: cust.name,
        amount,
        currency: paymentCurrency,
        method: paymentMethod,
        date: new Date().toISOString(),
        invoices: selectedInvoices
      });
    }
    
    setIsPaymentModalOpen(false);
    setPaymentCustomerId(null);
    setEditingPaymentId(null);
      setSelectedInvoices([]);
  };
  const openAddModal = () => {
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
                        <span className="text-[10px] text-gray-400 flex items-center">
                          <Phone className="h-2.5 w-2.5 mr-1" />
                          {cust.phone}
                        </span>
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
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 flex-1 max-w-sm"
            >
              <option value="ALL">-- All Patients --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
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
                   <span className="text-[10px] text-gray-500 dark:text-gray-400">
                     Total Visits: {sales.filter(s => s.customerId === selectedPaymentCustomerId).length}
                   </span>
                 )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedPaymentCustomerId === 'ALL' ? (
                  <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Patient</th>
                        <th className="px-4 py-3 text-right">Debt (USD)</th>
                        <th className="px-4 py-3 text-right">Debt (LBP)</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {filteredCustomers.filter(c => c.balanceUSD > 0 || c.balanceLBP > 0).map((cust) => (
                        <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 font-semibold">{cust.name}</td>
                          <td className={`px-4 py-3 text-right font-bold ${cust.balanceUSD > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            ${cust.balanceUSD.toFixed(2)}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${cust.balanceLBP > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {cust.balanceLBP.toLocaleString()} LBP
                          </td>
                          <td className="px-4 py-3 text-center">
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
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3 text-right">Total (USD)</th>
                        <th className="px-4 py-3 text-right">Total (LBP)</th>
                        <th className="px-4 py-3 text-center">Method</th>
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
                        sales.filter(s => s.customerId === selectedPaymentCustomerId).map((sale) => (
                          <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 text-gray-500">{new Date(sale.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-semibold">{sale.invoiceNumber}</td>
                            <td className="px-4 py-3 text-right font-bold">${sale.totalUSD.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">{sale.totalLBP.toLocaleString()} LBP</td>
                            <td className="px-4 py-3 text-center text-gray-500 uppercase text-[10px]">{sale.paymentMethod.replace('_', ' ')}</td>
                          </tr>
                        ))
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
                      <th className="px-4 py-3">Date</th>
                      {selectedPaymentCustomerId === 'ALL' && <th className="px-4 py-3">Patient</th>}
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Actions</th>
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
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(payment.date).toLocaleDateString()}
                          </td>
                          {selectedPaymentCustomerId === 'ALL' && (
                            <td className="px-4 py-3 font-semibold">{payment.customerName}</td>
                          )}
                          <td className="px-4 py-3 text-right font-bold text-teal-600 dark:text-teal-400">
                            {payment.currency === 'USD' ? `$${payment.amount.toFixed(2)}` : `${payment.amount.toLocaleString()} LBP`}
                          </td>
                          <td className="px-4 py-3 text-center">
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
          title={editingPaymentId ? "Edit Payment" : "Add Payment"}
          isOpen={true}
          section="customer"
          onClose={() => setIsPaymentModalOpen(false)}
          width="450px"
          height="auto"
        >
          <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4 text-xs">
            {(() => {
              const cust = customers.find(c => c.id === paymentCustomerId);
              if (!cust) return null;
              return (
                <>
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 mb-4">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{cust.name}</p>
                    <div className="flex justify-between mt-2 text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Current Debt USD:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">${cust.balanceUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1 text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Current Debt LBP:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{cust.balanceLBP.toLocaleString()} LBP</span>
                    </div>
                    
                    <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3">
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Select Transactions to Pay
                      </label>
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                        {(() => {
                          const paidInvoiceIds = new Set(customerPayments.filter(p => p.id !== editingPaymentId).flatMap(p => p.invoices || []));
                          const unpaidSales = sales.filter(s => s.customerId === cust.id && s.paymentMethod === 'credit_debt' && !paidInvoiceIds.has(s.id));
                          
                          if (unpaidSales.length === 0) {
                            return <p className="text-slate-500 dark:text-slate-400 text-center italic py-2">No unpaid credit sales.</p>;
                          }
                          
                          return unpaidSales.map(sale => (
                            <label key={sale.id} className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:checked:bg-teal-500"
                                  checked={selectedInvoices.includes(sale.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedInvoices(prev => [...prev, sale.id]);
                                      // Optional: auto-add to amount
                                      if (!editingPaymentId) {
                                        const currentAmt = parseFloat(paymentAmount) || 0;
                                        setPaymentAmount((currentAmt + sale.totalUSD).toFixed(2));
                                      }
                                    } else {
                                      setSelectedInvoices(prev => prev.filter(id => id !== sale.id));
                                      // Optional: subtract from amount
                                      if (!editingPaymentId) {
                                        const currentAmt = parseFloat(paymentAmount) || 0;
                                        setPaymentAmount(Math.max(0, currentAmt - sale.totalUSD).toFixed(2));
                                      }
                                    }
                                  }}
                                />
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{sale.invoiceNumber}</span>
                                  <span className="text-[9px] text-slate-500 dark:text-slate-400">{new Date(sale.date).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-rose-600 dark:text-rose-400">${sale.totalUSD.toFixed(2)}</div>
                                <div className="text-[9px] text-slate-500 dark:text-slate-400">{sale.totalLBP.toLocaleString()} LBP</div>
                              </div>
                            </label>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Amount to Pay
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          required
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <select
                        value={paymentCurrency}
                        onChange={(e) => setPaymentCurrency(e.target.value as 'USD' | 'LBP')}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="USD">USD</option>
                        <option value="LBP">LBP</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
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
