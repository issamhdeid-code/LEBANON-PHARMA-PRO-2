const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

// Find the <td> with the ref
const search = '<td className="p-1.5 align-top relative z-50" ref={searchDropdownRef}>';
content = content.replace(search, '<td className="p-1.5 align-top relative z-50"><div ref={searchDropdownRef} className="relative">');

// Now we have to close the div before the </td>
// But there's only one searchDropdownRef in the table block, so let's find the </td> after it.

const startOfTd = content.indexOf('<td className="p-1.5 align-top relative z-50"><div ref={searchDropdownRef} className="relative">');
const endOfTd = content.indexOf('</td>', startOfTd);

if (startOfTd !== -1 && endOfTd !== -1) {
    content = content.substring(0, endOfTd) + '</div>\n                      ' + content.substring(endOfTd);
}

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
