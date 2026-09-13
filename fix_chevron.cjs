const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');
content = content.replace(
  '<ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />',
  '<ChevronDown className="absolute right-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />'
);

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
