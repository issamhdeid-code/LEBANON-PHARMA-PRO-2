const fs = require('fs');
const content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

// The best way to visualize is to look at the hierarchy of the DesktopWindow form.
// DesktopWindow renders a wrapper.
// Inside it:
// <form>
//   <div>Supplier Info</div>
//   <div>Add Items to Invoice... and the Upper div input grid</div>
//   <div>Items List in New Purchase</div>
// </form>
