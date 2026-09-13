const fs = require('fs');
let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

// 1. Add state
const stateToAdd = `
  const [itemCode, setItemCode] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
`;
content = content.replace(
  "const [currentProductId, setCurrentProductId] = useState('');",
  "const [currentProductId, setCurrentProductId] = useState('');" + stateToAdd
);

// 2. Add refs
const refsToAdd = `
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
`;
content = content.replace(
  "const qtyInputRef = useRef<HTMLInputElement | null>(null);",
  refsToAdd + "  const qtyInputRef = useRef<HTMLInputElement | null>(null);"
);

// 3. Update selectProduct
const selectProductUpdate = `
    setItemCode(prod.code || '');
    setItemBarcode(prod.barcode || '');
`;
content = content.replace(
  "setItemUnit('box');",
  "setItemUnit('box');\n" + selectProductUpdate
);

// 4. Update resets
const resets = ["setItemQty('0');", "setItemQty('0');", "setItemQty('0');"];
// We need to replace all instances of setItemQty('0') that are in reset blocks
content = content.replace(
  /setItemQty\('0'\);/g,
  "setItemQty('0');\n    setItemCode('');\n    setItemBarcode('');"
);

// 5. Add to table headers
content = content.replace(
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[25%]">Product</th>',
  '<th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[8%]">Code</th>\n                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[10%]">Barcode</th>\n                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[25%]">Product</th>'
);

// 6. Add to table cells before product cell
const productCellIndex = content.indexOf('<td className="p-1.5 align-top relative z-50" ref={searchDropdownRef}>');
if (productCellIndex !== -1) {
  const newCells = `
                      <td className="p-1.5 align-top">
                        <input
                          ref={codeInputRef}
                          type="text"
                          value={itemCode}
                          onChange={(e) => setItemCode(e.target.value)}
                          placeholder="Code"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                        />
                      </td>
                      <td className="p-1.5 align-top">
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={itemBarcode}
                          onChange={(e) => setItemBarcode(e.target.value)}
                          placeholder="Barcode"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                        />
                      </td>
`;
  content = content.substring(0, productCellIndex) + newCells + content.substring(productCellIndex);
}

// 7. Widen table min-w
content = content.replace('min-w-[1200px]', 'min-w-[1400px]');

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
