const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

const targetStr = '            <div className="mt-auto flex items-end justify-between w-full pt-2">';
const targetIdx = content.indexOf(targetStr);

if (targetIdx !== -1) {
  const newTable = `
            {/* Items Input/Import Table */}
            <div className="flex-1 w-full overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/40 shadow-sm flex flex-col">
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-max text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Code</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Barcode</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Unit</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Qty</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Free</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Batch</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Expiry</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Pub Price</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Disc %</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Cost</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">VAT</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Profit</th>
                      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Placeholder for items/inputs */}
                    <tr>
                      <td colSpan={14} className="p-6 text-center text-slate-400">
                        Items form will go here
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

`;
  content = content.substring(0, targetIdx) + newTable + content.substring(targetIdx);
  fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
  console.log('Successfully added table structure.');
} else {
  console.log('Could not find target index.');
}
