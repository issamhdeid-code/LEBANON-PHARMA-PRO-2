const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

const listStartStr = '            {/* Items List in New Purchase */}';
const listStartIdx = content.indexOf(listStartStr);

const listEndStr = '            <div className="mt-auto flex items-end justify-between w-full pt-2">';
const listEndIdx = content.indexOf(listEndStr);

if (listStartIdx !== -1 && listEndIdx !== -1) {
  content = content.substring(0, listStartIdx) + content.substring(listEndIdx);
  fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
  console.log('Successfully deleted the requested components.');
} else {
  console.log('Could not find the target sections.');
}
