const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

// 1. Inject state
const handleAddItemStr = 'const handleAddItemToInvoice = () => {';
const handleAddItemIdx = content.indexOf(handleAddItemStr);

const resizeStateStr = `
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    code: 80,
    barcode: 100,
    name: 200,
    unit: 70,
    qty: 70,
    free: 70,
    batch: 80,
    expiry: 80,
    pubPrice: 80,
    discount: 70,
    cost: 80,
    vat: 70,
    profit: 70,
    total: 90,
    action: 40,
  });

  const handleColResizeStart = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.pageX;
    const startWidth = colWidths[col] || 100;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.pageX - startX;
      setColWidths(prev => ({
        ...prev,
        [col]: Math.max(40, startWidth + delta)
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  `;

content = content.substring(0, handleAddItemIdx) + resizeStateStr + content.substring(handleAddItemIdx);

// 2. Replace table
const tableStartStr = '<table className="w-full min-w-max text-left border-collapse">';
const tbodyStartStr = '<tbody className="divide-y divide-slate-100 dark:divide-slate-800">';

const tStartIdx = content.indexOf(tableStartStr);
const tEndIdx = content.indexOf(tbodyStartStr);

const newTableHeaders = `
<table className="w-max min-w-full text-left border-collapse table-fixed">
  <colgroup>
    <col style={{ width: colWidths.code }} />
    <col style={{ width: colWidths.barcode }} />
    <col style={{ width: colWidths.name }} />
    <col style={{ width: colWidths.unit }} />
    <col style={{ width: colWidths.qty }} />
    <col style={{ width: colWidths.free }} />
    <col style={{ width: colWidths.batch }} />
    <col style={{ width: colWidths.expiry }} />
    <col style={{ width: colWidths.pubPrice }} />
    <col style={{ width: colWidths.discount }} />
    <col style={{ width: colWidths.cost }} />
    <col style={{ width: colWidths.vat }} />
    <col style={{ width: colWidths.profit }} />
    <col style={{ width: colWidths.total }} />
    <col style={{ width: colWidths.action }} />
  </colgroup>
  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
    <tr>
      {[
        { id: 'code', label: 'Code' },
        { id: 'barcode', label: 'Barcode' },
        { id: 'name', label: 'Name' },
        { id: 'unit', label: 'Unit' },
        { id: 'qty', label: 'Qty' },
        { id: 'free', label: 'Free' },
        { id: 'batch', label: 'Batch' },
        { id: 'expiry', label: 'Expiry' },
        { id: 'pubPrice', label: 'Pub Price' },
        { id: 'discount', label: 'Disc %' },
        { id: 'cost', label: 'Cost' },
        { id: 'vat', label: 'VAT' },
        { id: 'profit', label: 'Profit' },
        { id: 'total', label: 'Total' },
      ].map(col => (
        <th key={col.id} className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap relative group border-r border-slate-200 dark:border-slate-800 select-none">
          {col.label}
          <div
            onMouseDown={(e) => handleColResizeStart(e, col.id)}
            className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500/80 transition-colors z-10"
            title="Drag to resize"
          />
        </th>
      ))}
      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
        {/* Actions empty header */}
      </th>
    </tr>
  </thead>
  `;

content = content.substring(0, tStartIdx) + newTableHeaders + content.substring(tEndIdx);

// Remove min-w-[200px]
content = content.replace('min-w-[200px]', '');

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
console.log('Successfully injected resizer logic.');
