const fs = require('fs');
let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

const insertLabel = (content, refOrId, labelText) => {
  const labelHtml = '                  <div className="flex items-center justify-between mb-1">\n                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">\n                      ' + labelText + '\n                    </label>\n                  </div>';

  const regex = new RegExp('(<div>\\s*)(<select\\s+ref=\\{?' + refOrId + '\\}?|<input\\s+ref=\\{?' + refOrId + '\\}?|<div className="relative">\\s*<select\\s+ref=\\{?' + refOrId + '\\}?)');
  
  if (content.match(regex)) {
    content = content.replace(regex, '$1' + labelHtml + '\n                  $2');
    console.log("Replaced for " + labelText);
  } else {
    console.log("Could not find regex match for " + labelText);
  }
  return content;
}

content = insertLabel(content, 'unitInputRef', 'Unit');
content = insertLabel(content, 'expiryInputRef', 'Expiry');
content = insertLabel(content, 'batchInputRef', 'Batch');
content = insertLabel(content, 'qtyInputRef', 'Qty');
content = insertLabel(content, 'vatInputRef', 'VAT');
content = insertLabel(content, 'publicPriceInputRef', 'Pub Price');
content = insertLabel(content, 'discountInputRef', 'Disc %');
content = insertLabel(content, 'costInputRef', 'Cost');
content = insertLabel(content, 'totalInputRef', 'Total');

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
