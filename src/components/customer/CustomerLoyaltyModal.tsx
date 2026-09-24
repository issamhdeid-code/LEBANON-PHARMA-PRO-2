import React, { useState, useMemo } from 'react';
import {
  Star,
  Award,
  TrendingUp,
  History,
  PlusCircle,
  MinusCircle,
  X,
  Receipt,
  Calendar,
  DollarSign,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Customer, SaleTransaction, PharmacySettings } from '../../types/pharmacy';
import { DesktopWindow } from '../common/DesktopWindow';
import {
  getLoyaltyTier,
  pointsToUSD,
  pointsToLBP,
  DEFAULT_LOYALTY_SETTINGS,
} from '../../utils/loyaltyUtils';
import { formatLBPValue } from '../../utils/priceUtils';

interface CustomerLoyaltyModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  sales: SaleTransaction[];
  settings: PharmacySettings;
  exchangeRate: number;
  onUpdateCustomerPoints: (customerId: string, newPoints: number, note?: string) => void;
}

export const CustomerLoyaltyModal: React.FC<CustomerLoyaltyModalProps> = ({
  customer,
  isOpen,
  onClose,
  sales,
  settings,
  exchangeRate,
  onUpdateCustomerPoints,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'adjust'>('overview');
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustAmount, setAdjustAmount] = useState<string>('50');
  const [adjustReason, setAdjustReason] = useState<string>('Customer Appreciation Bonus');
  const [successMessage, setSuccessMessage] = useState<string>('');

  if (!isOpen || !customer) return null;

  const currentPoints = customer.loyaltyPoints || 0;
  const tierInfo = getLoyaltyTier(currentPoints);

  const ratePoints = settings.loyaltyRedeemRatePoints || DEFAULT_LOYALTY_SETTINGS.redeemRatePoints;
  const rateUSD = settings.loyaltyRedeemRateUSD || DEFAULT_LOYALTY_SETTINGS.redeemRateUSD;
  const pointsPerUSD = settings.loyaltyPointsPerUSD || DEFAULT_LOYALTY_SETTINGS.pointsPerUSD;

  const usdValue = pointsToUSD(currentPoints, ratePoints, rateUSD);
  const lbpValue = pointsToLBP(currentPoints, exchangeRate, ratePoints, rateUSD);

  // Filter sales for this customer
  const customerSales = useMemo(() => {
    return sales
      .filter((s) => s.customerId === customer.id && !s.isUnreal)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, customer.id]);

  // Aggregate lifetime points earned and redeemed
  const { lifetimeEarned, lifetimeRedeemed } = useMemo(() => {
    let earned = 0;
    let redeemed = 0;
    customerSales.forEach((s) => {
      if (s.pointsEarned !== undefined) {
        earned += s.pointsEarned;
      } else {
        earned += Math.floor(s.totalUSD * pointsPerUSD);
      }
      if (s.pointsRedeemed) {
        redeemed += s.pointsRedeemed;
      }
    });
    return { lifetimeEarned: earned, lifetimeRedeemed: redeemed };
  }, [customerSales, pointsPerUSD]);

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(adjustAmount, 10);
    if (isNaN(qty) || qty <= 0) return;

    let newTotal = currentPoints;
    if (adjustType === 'add') {
      newTotal += qty;
    } else {
      newTotal = Math.max(0, newTotal - qty);
    }

    onUpdateCustomerPoints(customer.id, newTotal, adjustReason);
    setSuccessMessage(
      `Points updated! ${adjustType === 'add' ? `+${qty}` : `-${qty}`} points applied (New Balance: ${newTotal}).`
    );
    setTimeout(() => setSuccessMessage(''), 3500);
    setAdjustAmount('50');
  };

  return (
    <DesktopWindow
      id={`cust_loyalty_${customer.id}`}
      title={`Loyalty Points Studio — ${customer.name}`}
      isOpen={isOpen}
      onClose={onClose}
      initialWidth={700}
      initialHeight={550}
      minWidth={520}
      minHeight={420}
    >
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
        {/* Header Ribbon */}
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xl shadow-inner border border-amber-300 dark:border-amber-700">
              <Star className="h-6 w-6 fill-amber-500 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {customer.name}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold border ${tierInfo.badgeBg} ${tierInfo.borderColor}`}
                >
                  {tierInfo.tier} Member
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-0.5">
                <span>{customer.phone || 'No phone'}</span>
                <span>•</span>
                <span>Visits: {customerSales.length} orders</span>
                {customer.lastVisit && (
                  <>
                    <span>•</span>
                    <span>Last: {customer.lastVisit}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Balance Callout */}
          <div className="text-right">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
              <span>{currentPoints.toLocaleString()}</span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">pts</span>
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              ≈ ${usdValue.toFixed(2)} USD • {formatLBPValue(lbpValue)} LBP
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-3 text-xs font-bold border-b-2 cursor-pointer flex items-center gap-1.5 transition-colors ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            Overview & Tier Status
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-3 text-xs font-bold border-b-2 cursor-pointer flex items-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Points Ledger ({customerSales.length})
          </button>
          <button
            onClick={() => setActiveTab('adjust')}
            className={`py-2 px-3 text-xs font-bold border-b-2 cursor-pointer flex items-center gap-1.5 transition-colors ${
              activeTab === 'adjust'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Manual Adjust Points
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-between">
              <span>{successMessage}</span>
              <button
                onClick={() => setSuccessMessage('')}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                    Current Points
                  </span>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 flex items-baseline gap-1">
                    <span>{currentPoints.toLocaleString()}</span>
                    <span className="text-xs font-normal text-slate-500">pts</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium">
                    Available for checkout discount
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                    Lifetime Earned
                  </span>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 flex items-baseline gap-1">
                    <span>+{lifetimeEarned.toLocaleString()}</span>
                    <span className="text-xs font-normal text-slate-500">pts</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    From purchases (${(lifetimeEarned / pointsPerUSD).toFixed(0)} spent)
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                    Points Redeemed
                  </span>
                  <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 flex items-baseline gap-1">
                    <span>-{lifetimeRedeemed.toLocaleString()}</span>
                    <span className="text-xs font-normal text-slate-500">pts</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ${pointsToUSD(lifetimeRedeemed, ratePoints, rateUSD).toFixed(2)} in discounts
                  </span>
                </div>
              </div>

              {/* Tier Progress Card */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Award className={`h-4 w-4 ${tierInfo.color}`} />
                      {tierInfo.tier} Status Level
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {tierInfo.nextTierName
                        ? `${tierInfo.pointsToNextTier} more points to unlock ${tierInfo.nextTierName} tier`
                        : 'Highest loyalty status achieved!'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {tierInfo.progressPercent}% to next goal
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.max(5, tierInfo.progressPercent)}%` }}
                  />
                </div>

                {/* Tier Scale */}
                <div className="grid grid-cols-4 text-center text-[11px] pt-1 border-t border-slate-100 dark:border-slate-700/60 font-semibold">
                  <div className={tierInfo.tier === 'Bronze' ? 'text-amber-600 font-bold' : 'text-slate-400'}>
                    Bronze (0+)
                  </div>
                  <div className={tierInfo.tier === 'Silver' ? 'text-amber-600 font-bold' : 'text-slate-400'}>
                    Silver (100+)
                  </div>
                  <div className={tierInfo.tier === 'Gold' ? 'text-amber-600 font-bold' : 'text-slate-400'}>
                    Gold (250+)
                  </div>
                  <div className={tierInfo.tier === 'Platinum' ? 'text-purple-600 font-bold' : 'text-slate-400'}>
                    Platinum (500+)
                  </div>
                </div>
              </div>

              {/* Conversion Rule Explanation */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-lg border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-1">
                <span className="font-bold text-amber-900 dark:text-amber-300 block">
                  Active Redemption & Earning Rules
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  • <strong>Earning</strong>: Customer receives <strong>{pointsPerUSD} point</strong> for every <strong>$1.00 USD</strong> spent at checkout.
                  <br />
                  • <strong>Redemption</strong>: Every <strong>{ratePoints} points</strong> can be redeemed for <strong>${rateUSD.toFixed(2)} USD</strong> ({formatLBPValue(Math.round(rateUSD * exchangeRate))} LBP) discount.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
                Transaction history showing points earned on spending and discounts redeemed:
              </div>

              {customerSales.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No completed sales recorded for this customer yet.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">Date / Invoice</th>
                        <th className="p-2.5">Spent Amount</th>
                        <th className="p-2.5 text-center">Points Earned</th>
                        <th className="p-2.5 text-center">Points Redeemed</th>
                        <th className="p-2.5 text-right">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {customerSales.map((sale) => {
                        const earned =
                          sale.pointsEarned !== undefined
                            ? sale.pointsEarned
                            : Math.floor(sale.totalUSD * pointsPerUSD);
                        const redeemed = sale.pointsRedeemed || 0;
                        const discountUSD = sale.pointsDiscountUSD || 0;

                        return (
                          <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="p-2.5">
                              <span className="font-bold block text-slate-800 dark:text-slate-200">
                                {sale.invoiceNumber}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(sale.date).toLocaleDateString()} {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">
                              ${sale.totalUSD.toFixed(2)}
                              <span className="block text-[10px] text-slate-400">
                                {formatLBPValue(sale.totalLBP)} LBP
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              {earned > 0 ? (
                                <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-[11px]">
                                  +{earned} pts
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {redeemed > 0 ? (
                                <span className="inline-flex items-center text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded text-[11px]">
                                  -{redeemed} pts (${discountUSD.toFixed(2)})
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-medium text-slate-600 dark:text-slate-400 capitalize text-[11px]">
                              {sale.paymentMethod.replace('_', ' ')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'adjust' && (
            <form onSubmit={handleApplyAdjustment} className="space-y-4 max-w-lg mx-auto bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Manual Points Adjustment
                  </h4>
                  <p className="text-xs text-slate-500">
                    Grant bonus promotional points or deduct points directly
                  </p>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                  Current: {currentPoints} pts
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Action Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                      adjustType === 'add'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <PlusCircle className="h-4 w-4 text-emerald-600" />
                    Add Bonus Points
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                      adjustType === 'deduct'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <MinusCircle className="h-4 w-4 text-rose-600" />
                    Deduct Points
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Points Quantity
                </label>
                <div className="flex gap-2">
                  {[25, 50, 100, 250].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setAdjustAmount(quick.toString())}
                      className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-2.5 py-1 rounded font-semibold cursor-pointer"
                    >
                      {quick} pts
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="mt-2 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Reason / Adjustment Note
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. VIP Customer Reward, Birthday Bonus, Correction"
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4" />
                  Confirm & Apply {adjustType === 'add' ? `+${adjustAmount}` : `-${adjustAmount}`} Points
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </DesktopWindow>
  );
};
