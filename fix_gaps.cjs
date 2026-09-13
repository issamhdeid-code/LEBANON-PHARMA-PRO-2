const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

// 1. Remove the extra padding/margins on table cells and table head to make it tighter
// We can change `pb-2 px-1` to `p-1` on headers.
content = content.replace(/className="pb-2 px-1/g, 'className="p-1 pb-1.5');
// Change `p-1.5 align-top` to `p-1 align-top`
content = content.replace(/className="p-1\.5 align-top"/g, 'className="p-0.5 align-top"');
content = content.replace(/className="p-1\.5 align-top relative z-50"/g, 'className="p-0.5 align-top relative z-50"');

// 2. Adjust widths to use min-w and no explicit w-[X%] to let them flow naturally side-by-side, or adjust w- percentages
// For now, let's just make the min-w of the table smaller or remove it so it fits the screen better.
content = content.replace('min-w-[1400px]', 'min-w-[900px] w-full');

// 3. Make all the input fields use a tighter padding to save space.
content = content.replace(/px-3 py-1\.5/g, 'px-2 py-1');

// 4. Also adjust the `min-w-[900px]` to `w-full min-w-max` to ensure it only takes what it needs but is scrollable
content = content.replace('min-w-[900px] w-full', 'w-full min-w-max');

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
