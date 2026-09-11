const fs = require('fs');
let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

const target = `<span className="truncate font-medium flex items-center gap-1">
              <span>{item.productName}</span>
              {productDetails && (
                <span className="font-normal text-slate-500 text-[10px] truncate ml-1">
                  {productDetails.dosage} {productDetails.presentation} {productDetails.form}
                </span>
              )}
            </span>`;

const replacement = `<span className="truncate font-medium flex-1 mr-2">
              <span>{item.productName}</span>
              {productDetails && (
                <span className="font-normal text-slate-500 text-[10px] ml-1.5">
                  {productDetails.dosage} {productDetails.presentation} {productDetails.form}
                </span>
              )}
            </span>`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
  console.log("Fixed truncation successfully");
} else {
  console.log("Target not found");
}
