const fs = require('fs');
let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

const addedItemGridTarget = `className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-12 gap-3"`;
const addedItemGridRepl = `className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(15,minmax(0,1fr))] gap-2 items-end min-w-[900px]"`;
content = content.replace(addedItemGridTarget, addedItemGridRepl);

const formGridTarget = `className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(15,minmax(0,1fr))] gap-2 items-end"`;
const formGridRepl = `className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(15,minmax(0,1fr))] gap-2 items-end min-w-[900px]"`;
content = content.replace(formGridTarget, formGridRepl);

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
console.log("All grids fixed successfully");
