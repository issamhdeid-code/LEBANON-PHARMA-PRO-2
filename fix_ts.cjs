const fs = require('fs');
let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');
content = content.replace(/style=\{\{ fieldSizing: "content", minWidth: "100%" \}\}/g, `style={{ fieldSizing: "content", minWidth: "100%" } as any}`);
fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
