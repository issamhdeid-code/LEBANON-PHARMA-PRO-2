const fs = require('fs');

let content = fs.readFileSync('/tmp/PurchaseView.tsx', 'utf8');

const startIndex = content.indexOf('<div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(19,minmax(0,1fr))] gap-2 items-end min-w-[900px]">');
const endIndex = content.indexOf('{/* Selected Product Info & Lot Details */}');

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end index.");
  process.exit(1);
}

let originalBlock = content.substring(startIndex, endIndex);

// We want to transform originalBlock into a table, but preserve the inner HTML of the motion.divs.
// First, extract the content of each motion.div.

const motionDivRegex = /<motion\.div[^>]*>([\s\S]*?)<\/motion\.div>/g;
let matches = [];
let match;
while ((match = motionDivRegex.exec(originalBlock)) !== null) {
  matches.push(match[1]);
}

// matches[0] = search input block (but wait, there's a label inside it? No, in my code earlier, the search input didn't have a label in the motion.div. Wait, I should check /tmp/PurchaseView.tsx for the exact contents.)

const labels = [
  "Product",
  "Unit",
  "Expiry",
  "Batch",
  "Qty",
  "Free",
  "Profit %",
  "VAT",
  "Pub Price",
  "Disc %",
  "Cost",
  "Total"
];

let newTableBlock = `
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[25%]">Product</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Unit</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[9%]">Expiry</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[8%]">Batch</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Qty</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Free</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Profit %</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[7%]">VAT</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[7%]">Pub Price</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[6%]">Disc %</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[7%]">Cost</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-center w-[7%]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
`;

for (let i = 0; i < matches.length; i++) {
  let cellContent = matches[i];
  
  // Strip out the label div inside the cellContent because we moved it to the table headers
  // The labels are inside `<div className="flex items-center justify-between mb-1">...</div>`
  const labelDivStart = cellContent.indexOf('<div className="flex items-center justify-between mb-1">');
  if (labelDivStart !== -1) {
    const labelDivEnd = cellContent.indexOf('</div>', labelDivStart) + 6;
    cellContent = cellContent.substring(0, labelDivStart) + cellContent.substring(labelDivEnd);
  }

  // The first item also has `ref={searchDropdownRef}` in the `motion.div`. Let's move it to the `td`.
  let tdProps = 'className="p-1 align-top"';
  if (i === 0) {
    tdProps = 'className="p-1 align-top relative z-50" ref={searchDropdownRef}';
  }

  newTableBlock += `                      <td ${tdProps}>\n${cellContent}\n                      </td>\n`;
}

newTableBlock += `                    </tr>
                  </tbody>
                </table>
              </div>
`;

let newContent = content.replace(originalBlock, newTableBlock);

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', newContent);
