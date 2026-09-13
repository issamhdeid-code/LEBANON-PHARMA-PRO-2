const fs = require('fs');

let content = fs.readFileSync('/tmp/PurchaseView.tsx', 'utf8');

const searchString = '<div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(19,minmax(0,1fr))] gap-2 items-end min-w-[900px]">';
const startIndex = content.indexOf(searchString);
const endIndex = content.indexOf('{/* Selected Product Info & Lot Details */}', startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end index.");
  process.exit(1);
}

// Ensure we only replace the specific grid div. The div itself ends a bit before endIndex.
// Let's find the closing `</div>` of the grid.
let originalBlock = content.substring(startIndex, endIndex);
let closingDivIndex = originalBlock.lastIndexOf('</div>');
if (closingDivIndex !== -1) {
    originalBlock = originalBlock.substring(0, closingDivIndex + 6);
} else {
    console.log("Could not find closing div");
}

const motionDivRegex = /<motion\.div[^>]*>([\s\S]*?)<\/motion\.div>/g;
let matches = [];
let match;
while ((match = motionDivRegex.exec(originalBlock)) !== null) {
  matches.push(match[1]);
}

console.log("Found motion divs:", matches.length);

const headers = [
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[25%]">Product</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Unit</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[9%]">Expiry</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[8%]">Batch</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Qty</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Free</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Profit %</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[7%]">VAT</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[7%]">Pub Price</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Disc %</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[7%]">Cost</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-center w-[7%]">Total</th>'
];

let newTableBlock = `
              <div className="overflow-x-auto w-full mb-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
`;
for (const h of headers) {
    newTableBlock += `                      ${h}\n`;
}
newTableBlock += `                    </tr>
                  </thead>
                  <tbody>
                    <tr>
`;

for (let i = 0; i < matches.length; i++) {
  let cellContent = matches[i];
  
  const labelDivStart = cellContent.indexOf('<div className="flex items-center justify-between mb-1">');
  if (labelDivStart !== -1) {
    const labelDivEnd = cellContent.indexOf('</div>', labelDivStart) + 6;
    cellContent = cellContent.substring(0, labelDivStart) + cellContent.substring(labelDivEnd);
  }

  let tdProps = 'className="p-1.5 align-top"';
  if (i === 0) {
    tdProps = 'className="p-1.5 align-top relative z-50" ref={searchDropdownRef}';
  }

  newTableBlock += `                      <td ${tdProps}>\n${cellContent}\n                      </td>\n`;
}

newTableBlock += `                    </tr>
                  </tbody>
                </table>
              </div>`;

let newContent = content.replace(originalBlock, newTableBlock);
fs.writeFileSync('src/components/purchase/PurchaseView.tsx', newContent);
console.log("Replaced successfully");
