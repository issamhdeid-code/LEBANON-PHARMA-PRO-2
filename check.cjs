const fs = require('fs');
let content = fs.readFileSync('/tmp/PurchaseView.tsx', 'utf8');
const searchString = '<div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(19,minmax(0,1fr))] gap-2 items-end min-w-[900px]">';
let startIndex = content.indexOf(searchString);
let endIndex = content.indexOf('{/* Selected Product Info & Lot Details */}', startIndex);
console.log(startIndex, endIndex);
