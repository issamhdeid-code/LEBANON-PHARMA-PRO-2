const fs = require('fs');
let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

const startIndex = content.indexOf('{/* Add Items Row */}');
const endIndex = content.indexOf('{/* Items List in New Purchase */}');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) +
    `{/* Add Items Row */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-800/40 shadow-sm relative z-40 flex items-center justify-center text-slate-400">
              {/* Form removed - Ready to be recreated from scratch */}
              <p>Add Items Form (Recreate from scratch here)</p>
            </div>

            ` + content.substring(endIndex);
  fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
  console.log("Removed form successfully.");
} else {
  console.log("Could not find start or end index.");
}
