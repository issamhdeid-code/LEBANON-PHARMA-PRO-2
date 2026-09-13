const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

// Find the start of the Inputs section
const gridStartStr = '            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">';
const gridStartIdx = content.indexOf(gridStartStr);

// Find the end of the Add Items Row placeholder
// It's followed by {/* Items List in New Purchase */}
const listStartStr = '            {/* Items List in New Purchase */}';
const listStartIdx = content.indexOf(listStartStr);

if (gridStartIdx !== -1 && listStartIdx !== -1) {
  content = content.substring(0, gridStartIdx) + content.substring(listStartIdx);
  fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
  console.log('Successfully deleted the requested components.');
} else {
  console.log('Could not find the target sections.');
}
