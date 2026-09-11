const fs = require('fs');
let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

const badModal = `      {showCloseConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Unsaved Changes</h3>
            </div>
            <div className="p-5 text-sm text-slate-600 dark:text-slate-300">
              <p>You have items in this invoice.</p>
              <p className="mt-1">Are you sure you want to close without saving?</p>
            </div>
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
              >
                Discard the close process
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  setIsCreateOpen(false);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Close without save
              </button>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(badModal, '');

const goodModal = `      {/* Close Confirm Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Unsaved Changes</h3>
            </div>
            <div className="p-5 text-sm text-slate-600 dark:text-slate-300">
              <p>You have items in this invoice.</p>
              <p className="mt-1">Are you sure you want to close without saving?</p>
            </div>
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
              >
                Discard the close process
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  setIsCreateOpen(false);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Close without save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};`;

// replace at the end of the file
const eofRegex = /    <\/div>\n  \);\n};\s*$/;
if (content.match(eofRegex)) {
  content = content.replace(eofRegex, goodModal + '\n');
  fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
  console.log("Fixed successfully");
} else {
  console.log("Failed to find EOF pattern");
}
