const fs = require('fs');
let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

content = content.replace(
  'const newCurrency = e.target.value;',
  "const newCurrency = e.target.value as 'USD' | 'LBP';"
);

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
