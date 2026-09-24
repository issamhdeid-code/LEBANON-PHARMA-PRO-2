import React, { useState } from 'react';
import {
  Star,
  Award,
  DollarSign,
  TrendingUp,
  Percent,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Calculator,
  RotateCcw,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  DEFAULT_LOYALTY_SETTINGS,
  pointsToUSD,
  pointsToLBP,
  usdToPoints,
} from '../../utils/loyaltyUtils';
import { formatLBPValue } from '../../utils/priceUtils';

export const LoyaltySettingsPanel: React.FC = () => {
  const { settings, updateSettings, customers, exchangeRate, addNotification } = usePharmacy();

  const [enabled, setEnabled] = useState<boolean>(
    settings.loyaltyProgramEnabled !== false
  );
  const [pointsPerUSD, setPointsPerUSD] = useState<number>(
    settings.loyaltyPointsPerUSD ?? DEFAULT_LOYALTY_SETTINGS.pointsPerUSD
  );
  const [redeemRatePoints, setRedeemRatePoints] = useState<number>(
    settings.loyaltyRedeemRatePoints ?? DEFAULT_LOYALTY_SETTINGS.redeemRatePoints
  );
  const [redeemRateUSD, setRedeemRateUSD] = useState<number>(
    settings.loyaltyRedeemRateUSD ?? DEFAULT_LOYALTY_SETTINGS.redeemRateUSD
  );
  const [minPointsToRedeem, setMinPointsToRedeem] = useState<number>(
    settings.loyaltyMinPointsToRedeem ?? DEFAULT_LOYALTY_SETTINGS.minPointsToRedeem
  );
  const [maxRedemptionPercent, setMaxRedemptionPercent] = useState<number>(
    settings.loyaltyMaxRedemptionPercent ?? DEFAULT_LOYALTY_SETTINGS.maxRedemptionPercent
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Live calculator tester states
  const [testPoints, setTestPoints] = useState<string>('200');
  const [testUSD, setTestUSD] = useState<string>('5.00');

  // Community statistics
  const totalCustomersWithPoints = customers.filter((c) => (c.loyaltyPoints || 0) > 0).length;
  const totalCirculatingPoints = customers.reduce(
    (sum, c) => sum + (c.loyaltyPoints || 0),
    0
  );
  const totalCirculatingUSD = pointsToUSD(
    totalCirculatingPoints,
    redeemRatePoints,
    redeemRateUSD
  );
  const totalCirculatingLBP = pointsToLBP(
    totalCirculatingPoints,
    exchangeRate,
    redeemRatePoints,
    redeemRateUSD
  );

  const handleSave = () => {
    setIsSaving(true);
    updateSettings({
      loyaltyProgramEnabled: enabled,
      loyaltyPointsPerUSD: Math.max(0.1, Number(pointsPerUSD) || 1),
      loyaltyRedeemRatePoints: Math.max(1, Number(redeemRatePoints) || 100),
      loyaltyRedeemRateUSD: Math.max(0.01, Number(redeemRateUSD) || 1.0),
      loyaltyMinPointsToRedeem: Math.max(0, Number(minPointsToRedeem) || 0),
      loyaltyMaxRedemptionPercent: Math.min(100, Math.max(1, Number(maxRedemptionPercent) || 100)),
    });

    setIsSaving(false);
    setIsSaved(true);
    addNotification('Loyalty Program & Redemption rules saved successfully', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleApplyPreset = (pts: number, usd: number, minPts: number) => {
    setRedeemRatePoints(pts);
    setRedeemRateUSD(usd);
    setMinPointsToRedeem(minPts);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Program Status */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Star className="h-5 w-5 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Patient Loyalty &amp; Rewards Program
                {enabled ? (
                  <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    Active
                  </span>
                ) : (
                  <span className="text-xs bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                    Disabled
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reward customer purchases with points and enable cash discounts at POS checkout
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
            <span className="ml-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              {enabled ? 'Program Enabled' : 'Program Disabled'}
            </span>
          </label>
        </div>

        {/* Live Circulation Stats */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/30 dark:bg-amber-950/10 border-b border-slate-200 dark:border-slate-700">
          <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50">
            <span className="text-[11px] font-bold uppercase text-slate-400 block">
              Active Loyalty Members
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {totalCustomersWithPoints}{' '}
              <span className="text-xs font-normal text-slate-500">patients</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50">
            <span className="text-[11px] font-bold uppercase text-slate-400 block">
              Points In Circulation
            </span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 flex items-baseline gap-1">
              <span>{totalCirculatingPoints.toLocaleString()}</span>
              <span className="text-xs font-normal text-slate-500">pts</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50">
            <span className="text-[11px] font-bold uppercase text-slate-400 block">
              Community Redeem Value
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ${totalCirculatingUSD.toFixed(2)}{' '}
              <span className="text-[11px] font-normal text-slate-500 block sm:inline">
                ({formatLBPValue(totalCirculatingLBP)} LBP)
              </span>
            </div>
          </div>
        </div>

        {/* Settings Form Body */}
        <div className="p-5 space-y-6">
          {/* Section 1: Earning Rules */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              1. Points Earning Rule (Spending to Points)
            </h3>
            <p className="text-xs text-slate-500">
              Define how many loyalty points patients automatically earn when spending money at POS.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Points Earned per $1.00 USD Spent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="100"
                    value={pointsPerUSD}
                    onChange={(e) => setPointsPerUSD(parseFloat(e.target.value) || 1)}
                    className="w-32 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500">
                    points for every $1.00 spent
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Example: A customer purchasing $24.00 of medicines earns{' '}
                  <strong className="text-amber-600 font-bold">
                    {Math.floor(24 * pointsPerUSD)} points
                  </strong>.
                </span>
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Section 2: Redemption Rules */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                2. Points Redemption Rule (Points to Money)
              </h3>
              <p className="text-xs text-slate-500">
                Define the conversion exchange rate for redeeming points into cash discounts at checkout.
              </p>
            </div>

            {/* Quick Conversion Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Quick Presets:
              </span>
              <button
                type="button"
                onClick={() => handleApplyPreset(100, 1.0, 10)}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-amber-100 dark:hover:bg-amber-950/60 font-semibold cursor-pointer transition-colors"
              >
                100 pts = $1.00 USD
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(200, 1.0, 20)}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-amber-100 dark:hover:bg-amber-950/60 font-semibold cursor-pointer transition-colors"
              >
                200 pts = $1.00 USD
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(50, 1.0, 10)}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-amber-100 dark:hover:bg-amber-950/60 font-semibold cursor-pointer transition-colors"
              >
                50 pts = $1.00 USD (Generous)
              </button>
            </div>

            {/* Rate Definition Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Points Redeemed
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      step="5"
                      value={redeemRatePoints}
                      onChange={(e) => setRedeemRatePoints(parseInt(e.target.value, 10) || 100)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <span className="text-xs font-bold text-slate-500">Points</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cash Discount Value
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500">= $</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0.1"
                      value={redeemRateUSD}
                      onChange={(e) => setRedeemRateUSD(parseFloat(e.target.value) || 1.0)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <span className="text-xs font-bold text-slate-500">USD</span>
                  </div>
                </div>
              </div>

              {/* Live Conversion Callout */}
              <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                  Active Conversion Summary:
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                  • Every <strong>{redeemRatePoints} points</strong> ={' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    ${redeemRateUSD.toFixed(2)} USD
                  </strong>{' '}
                  ({formatLBPValue(Math.round(redeemRateUSD * exchangeRate))} LBP) discount.
                  <br />
                  • Each point is worth{' '}
                  <strong>
                    ${(redeemRateUSD / redeemRatePoints).toFixed(4)} USD
                  </strong>{' '}
                  (
                  {formatLBPValue(
                    Math.round((redeemRateUSD / redeemRatePoints) * exchangeRate)
                  )}{' '}
                  LBP).
                </p>
              </div>

              {/* Thresholds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Minimum Points to Redeem
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={minPointsToRedeem}
                    onChange={(e) => setMinPointsToRedeem(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Patients must reach this balance before redemption is allowed.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Max Order Coverage (%)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={maxRedemptionPercent}
                      onChange={(e) =>
                        setMaxRedemptionPercent(
                          Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 100))
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    100% allows points to pay for entire order.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Section 3: Interactive Conversion Tester */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-indigo-600" />
              3. Interactive Conversion Calculator (Test Rates)
            </h3>
            <p className="text-xs text-slate-500">
              Verify how your configured rules translate points to money in real-time.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                  Test Points → Money:
                </label>
                <input
                  type="number"
                  min="0"
                  value={testPoints}
                  onChange={(e) => setTestPoints(e.target.value)}
                  className="w-full rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold font-mono"
                  placeholder="200"
                />
                <div className="mt-2 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                  Yields:{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                    $
                    {pointsToUSD(
                      parseInt(testPoints, 10) || 0,
                      redeemRatePoints,
                      redeemRateUSD
                    ).toFixed(2)}{' '}
                    USD
                  </span>{' '}
                  (
                  {formatLBPValue(
                    pointsToLBP(
                      parseInt(testPoints, 10) || 0,
                      exchangeRate,
                      redeemRatePoints,
                      redeemRateUSD
                    )
                  )}{' '}
                  LBP)
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                  Test Money ($) → Points Required:
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-indigo-700">$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={testUSD}
                    onChange={(e) => setTestUSD(e.target.value)}
                    className="w-full rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold font-mono"
                    placeholder="5.00"
                  />
                </div>
                <div className="mt-2 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                  Requires:{' '}
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                    {usdToPoints(
                      parseFloat(testUSD) || 0,
                      redeemRatePoints,
                      redeemRateUSD
                    ).toLocaleString()}{' '}
                    points
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save Action */}
          <div className="pt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md transition-colors flex items-center gap-2"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Loyalty Rules</span>
                </>
              )}
            </button>

            {isSaved && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Updated rules active across POS and Customer Directory
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
