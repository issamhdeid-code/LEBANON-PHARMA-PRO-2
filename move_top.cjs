const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

// 1. Change form padding
content = content.replace(
  'className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-start overflow-auto min-h-0"',
  'className="p-3 space-y-3 text-xs flex-1 flex flex-col justify-start overflow-auto min-h-0"'
);

// 2. Change grid gap
content = content.replace(
  '<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">',
  '<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">'
);

// 3. Make inputs smaller and tighter
content = content.replace(
  /className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2/g,
  'className="w-full rounded border border-slate-200 bg-white px-2 py-1'
);

content = content.replace(
  /className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800/g,
  'className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800'
);

// The label margins: mb-1.5 -> mb-1
content = content.replace(
  /className="block font-bold text-slate-700 dark:text-slate-300 mb-1\.5"/g,
  'className="block font-bold text-slate-700 dark:text-slate-300 mb-1"'
);


fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
