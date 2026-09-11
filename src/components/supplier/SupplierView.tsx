import React, { useState } from 'react';
import { Building2, Plus, Phone, Mail, MapPin, DollarSign, Edit, Check, X, Trash2, AlertCircle, CloudDownload, Search } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Supplier } from '../../types/pharmacy';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import { fetchMOPHPriceList } from '../../services/mophApiService';

export const SupplierView: React.FC = () => {
  const { suppliers, addSupplier, bulkAddSuppliers, updateSupplier, deleteSupplier, formatLBP, formatUSD, addNotification } = usePharmacy();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedSuppliers = React.useMemo(() => {
    return suppliers
      .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, searchQuery]);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net');
  const [balanceUSD, setBalanceUSD] = useState('0');

  const openAddModal = () => {
    setEditingSupplierId(null);
    setName('');
    setCode(`SUP-${Math.floor(100 + Math.random() * 900)}`);
    setPhone('+961 1 ');
    setEmail('');
    setAddress('Beirut, Lebanon');
    setContactPerson('');
    setPaymentTerms('30 Days Net');
    setBalanceUSD('0');
    setIsModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplierId(sup.id);
    setName(sup.name);
    setCode(sup.code);
    setPhone(sup.phone);
    setEmail(sup.email);
    setAddress(sup.address);
    setContactPerson(sup.contactPerson);
    setPaymentTerms(sup.paymentTerms);
    setBalanceUSD(sup.balanceUSD.toString());
    setIsModalOpen(true);
  };

  const handleImportMOPHAgents = async () => {
    setIsImporting(true);
    try {
      const priceList = await fetchMOPHPriceList();
      const uniqueAgents = Array.from(new Set(priceList.map(item => item.agent).filter(a => a && a.trim() !== '')));
      
      const newSuppliers: Omit<Supplier, 'id'>[] = [];
      
      uniqueAgents.forEach(agentName => {
        const normalizedName = agentName.trim().toLowerCase();
        const exists = suppliers.some(s => s.name.trim().toLowerCase() === normalizedName);
        if (!exists) {
          newSuppliers.push({
            name: agentName.trim(),
            code: `MOPH-${Math.floor(1000 + Math.random() * 9000)}`,
            phone: '',
            email: '',
            address: 'Lebanon',
            contactPerson: '',
            paymentTerms: '30 Days Net',
            balanceUSD: 0,
            balanceLBP: 0,
          });
        }
      });
      
      if (newSuppliers.length > 0) {
        bulkAddSuppliers(newSuppliers);
        addNotification('Import Complete', `Successfully imported ${newSuppliers.length} new agents from MOPH.`, 'system', 'success');
      } else {
        addNotification('Import Complete', 'No new agents found. All MOPH agents are already registered.', 'system', 'info');
      }
    } catch (error) {
      console.error(error);
      addNotification('Import Failed', 'Could not fetch MOPH agents.', 'system', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const balUSD = parseFloat(balanceUSD) || 0;

    if (editingSupplierId) {
      updateSupplier(editingSupplierId, {
        name,
        code,
        phone,
        email,
        address,
        contactPerson,
        paymentTerms,
        balanceUSD: balUSD,
        balanceLBP: Math.round(balUSD * 89500),
      });
    } else {
      addSupplier({
        name,
        code,
        phone,
        email,
        address,
        contactPerson,
        paymentTerms,
        balanceUSD: balUSD,
        balanceLBP: Math.round(balUSD * 89500),
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 p-3.5 space-y-3 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center space-x-2">
            <SectionRestoreButton section="supplier" />
            <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              Suppliers & Pharmaceutical Distributors
            </h2>
            <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">
              {suppliers.length} Agents
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Lebanese drug agencies, agent directories, and pending payable balances.
          </p>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm min-w-[200px] px-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-slate-200 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImportMOPHAgents}
            disabled={isImporting}
            className="flex items-center space-x-1 rounded border border-teal-600 px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800 dark:hover:bg-teal-900 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isImporting ? (
              <div className="h-3.5 w-3.5 border-2 border-teal-600 dark:border-teal-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <CloudDownload className="h-3.5 w-3.5" />
            )}
            <span>Import MOPH Agents</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Grid of Suppliers */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredAndSortedSuppliers.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-400 text-xs">
              No suppliers found matching your criteria.
            </div>
          ) : (
            filteredAndSortedSuppliers.map((sup) => (
              <div
              key={sup.id}
              className="flex flex-col justify-between rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 hover:border-teal-400 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-900">
                    {sup.code}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(sup)}
                      className="p-1 text-gray-400 hover:text-teal-600 dark:hover:text-teal-300 cursor-pointer"
                      title="Edit Supplier"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setSupplierToDelete(sup)}
                      className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                      title="Delete Supplier"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {sup.name}
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-slate-400">
                  Contact: {sup.contactPerson || 'Sales Dept'}
                </p>

                <div className="mt-2.5 space-y-1 text-xs text-gray-600 dark:text-slate-300">
                  <div className="flex items-center space-x-1.5">
                    <Phone className="h-3 w-3 text-gray-400" />
                    <span className="text-[11px]">{sup.phone}</span>
                  </div>
                  {sup.email && (
                    <div className="flex items-center space-x-1.5">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <span className="text-[11px]">{sup.email}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <span className="text-[11px] truncate">{sup.address}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-gray-400">Balance Owed</span>
                  <span className={`font-bold ${sup.balanceUSD > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    ${sup.balanceUSD.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-semibold text-gray-400">Terms</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                    {sup.paymentTerms}
                  </span>
                </div>
              </div>
            </div>
          )))}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <DesktopWindow
          title={editingSupplierId ? 'Edit Supplier' : 'Register New Supplier'}
          isOpen={true}
          section="supplier"
          onClose={() => setIsModalOpen(false)}
          width="480px"
          height="auto"
        >
          <form onSubmit={handleSave} className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Supplier / Agency Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Mersaco Sal"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 uppercase font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Sales Rep"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sales@example.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Office Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Sin El Fil, Beirut"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="30 Days Net"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Initial Balance ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={balanceUSD}
                    onChange={(e) => setBalanceUSD(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
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
                <span>{editingSupplierId ? 'Update Agency' : 'Register Agency'}</span>
              </button>
            </div>
          </form>
        </DesktopWindow>
      )}

      {/* Delete Confirmation Modal */}
      {supplierToDelete && (
        <DesktopWindow
          title="Delete Supplier"
          isOpen={true}
          onClose={() => {
            setSupplierToDelete(null);
            setDeleteError(null);
          }}
        >
          <div className="p-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              Confirm Deletion
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete <span className="font-bold">{supplierToDelete.name}</span>? This action cannot be undone. 
              If there are any purchase records associated with this supplier, the deletion will be blocked.
            </p>
            
            {deleteError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSupplierToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteSupplier(supplierToDelete.id);
                  if (res.success) {
                    setSupplierToDelete(null);
                    setDeleteError(null);
                  } else {
                    setDeleteError(res.error || 'Failed to delete supplier');
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}
    </div>
  );
};
