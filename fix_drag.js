const fs = require('fs');
let code = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf-8');

// The divs to change:
// <div className="sm:col-span-3 relative z-50 resize overflow-auto" ref={searchDropdownRef}>
// <div className="resize overflow-auto">
// <div className="md:col-span-2 resize overflow-auto">
// ... and their matching </div>

// Instead of parsing, we can just replace the specific opening tags and the closing tags.
// Because it's a bit tricky to find the matching closing tag, we could use a simple stack parser.

function makeMotion(code) {
  const startIndex = code.indexOf('<div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(17,minmax(0,1fr))] gap-2 items-end min-w-[900px]">');
  const endIndex = code.indexOf('</div>', code.indexOf('Total', startIndex)); // After the last input
  
  // Actually, let's just find the closing tag of the grid.
  // It's the </div> before `{/* Selected Product Info & Lot Details */}`
  
  let gridStart = code.indexOf('<div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(17,minmax(0,1fr))] gap-2 items-end min-w-[900px]">');
  let gridEnd = code.indexOf('{/* Selected Product Info & Lot Details */}', gridStart);
  
  let gridContent = code.substring(gridStart, gridEnd);
  
  // Replace opening tags that have "resize overflow-auto"
  gridContent = gridContent.replace(/<div className="([^"]*resize overflow-auto[^"]*)"([^>]*)>/g, '<motion.div drag dragMomentum={false} className="$1" style={{ touchAction: "none" }}$2>');
  // Also we need to replace the closing </div> of these specific divs.
  // Since we know the structure: each opening tag corresponds to a child div.
  // But wait, there are other divs inside them!
  
  return gridContent;
}

// Easier: just do a regex replace if we know they don't have nested `<div className="...resize overflow-auto...">`
// Wait, we need to replace the CLOSING tags.
// Let's just use regex to match the blocks.

