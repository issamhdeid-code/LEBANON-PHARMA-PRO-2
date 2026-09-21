# WORKLOG — Lebanon Pharma Pro

This log tracks all architectural decisions, feature implementations, and module-level changes made to the project. It serves as persistent context across development sessions.

---

## Current Architecture & Operating Invariants

- **System Model**: 
  - **Main PC**: Express + Socket.IO server running on port 3000 (`server.ts`, bound to `0.0.0.0`), authoritative snapshot source.
  - **Secondary PC**: Live replica that pulls a full state snapshot on connect and receives live mutation broadcasts.
- **Local-First Storage**:
  - In-memory cache is the primary read source.
  - `localStorage` (via `OfflineStorage` in `storage.ts`) serves as the boot cache.
  - `IndexedDB` (`indexedDbStorage.ts`) provides full catalog and transaction backup.
  - Offline retry queue (capped at 500) flushes mutations automatically upon reconnection.
- **Currency & Formatting**:
  - Lebanese Pound (LBP): Integer formatting via `formatLBPValue` / `formatNumber` (no decimals).
  - US Dollar (USD): Two decimal places (`toFixed(2)`).
  - Exchange rate managed centrally and stored in settings.

---

## Log of Updates & Changes

### 2026-09-21

#### 1. Purchase Module — Strict Expiry Date Validation
- **Requirement**: Prevent entering expired products into purchase invoices. Highlight the expiry input in red and block navigation to subsequent inputs until a valid future expiry date is provided.
- **Implementation**:
  - Added core expiry validation utilities in `src/components/purchase/PurchaseView.tsx`:
    - `isProductExpired(expiryInputOrDate, referenceDate)`: Compares full ISO dates (`YYYY-MM-DD`) and month-based dates (`MM/YYYY`, `MM/YY`, `MMYYYY`) against the reference date. In pharmacy practice, an `MM/YYYY` expiry expires on the final day of that month.
    - `isFullExpiryInput(val)`: Distinguishes between completed date inputs (`MM/YYYY`, `YYYY-MM-DD`, 6-digit raw) and in-progress user typing (`05`, `05/`, `05/2`, `05/20`).
    - `isExpiryDenied(displayVal, isoVal, isFinishedEntering, referenceDate)`: Prevents premature validation errors while typing; evaluates only upon complete entry or on completion events (`onBlur`, `Enter`, `Tab`).
  - **UI & Interaction Updates**:
    - Replaced the intrusive top banner alert (`#scan-status-alert`) with a clean, high-contrast red border/background/ring styling on the `ExpiryTableInput` element itself.
    - Blocked keyboard navigation (`Enter` and `Tab`) when an expired date is present, keeping focus on the expiry box until corrected.
    - Enforced validation checks on:
      - Product selection auto-fill (marks input in red if the previous purchase had an expired date).
      - Row addition (`handleAddItemToInvoice`).
      - Inline table row editing (`handleSaveEditRow`).
      - Invoice submission (`handleSavePurchase`).
  - **Unit Testing**:
    - Created comprehensive test suite in `src/components/purchase/expiryUtils.test.ts` covering:
      - `isProductExpired` date boundary comparisons.
      - `isFullExpiryInput` partial typing vs. completed formats.
      - `isExpiryDenied` typing states and blur/enter behaviors.
      - Automatic slash insertion, cursor preservation, and ISO formatting.
    - All 41 tests passing.

#### 2. Purchase Returns & Stock Flow
- Implemented purchase returns workflow (`NewPurchaseReturnModal.tsx`, `PurchaseReturnDetailModal.tsx`, `PurchaseReturnTab.tsx`).
- Created unit tests in `src/components/purchase/purchaseReturn.test.ts`.

#### 3. Sales & POS Enhancements
- Enhanced sales flow and receipt generation in `SaleView.tsx`, `SalesTransactionLog.tsx`, and `ReceiptModal.tsx`.
- Refined sales settings in `SaleSettingsPanel.tsx` and updated cash drawer reconciliation in `CashDrawerView.tsx`.

#### 4. Reports & Analytics
- Added `OrderPreparationReport.tsx`, `VatSalesValueReport.tsx`, and `ChartsReportsView.tsx`.
- Updated `DailyCashierSummaryReport.tsx`, `DailySalesItemsReport.tsx`, and `CategoryProfitMarginReport.tsx`.

#### 5. Window Resizing & Desktop UI Enhancements
- **Supplier Payment Window Resizing Fix**:
  - Resolved root cause where window `y` position clamping (`window.innerHeight - 50`) previously allowed window bottom edges to extend off-screen below the viewport, rendering bottom resize handles unreachable.
  - Added support for `maxHeight` and `maxWidth` props in `DesktopWindow.tsx` and removed hard-coded `window.innerHeight - 24` height cap during drag resizing.
  - Increased `SupplierPaymentModal.tsx` vertical resizing limit (`maxHeight={2000}`, `minHeight={180}`), allowing completely unconstrained vertical expansion up to full screen and beyond.
  - Enforced strict viewport position clamping (`maxY = window.innerHeight - size.height - 12`) during initial state, modal open, viewport resize, and titlebar dragging.
  - Guaranteed bottom handles and corner grips remain 100% visible and accessible inside the viewport.
  - Expanded unpaid invoices list container in `SupplierPaymentModal.tsx` (`max-h-72`) to smoothly adapt as the modal is resized downward.
- **Bulk Inventory CSV Import Cleanup**:
  - Hidden top instructions banner, quick actions sidebar card, and raw CSV preview textarea in `CSVImportModal.tsx` for a clean import flow.

#### 6. Scientifics & Generic Alternatives
- Enhanced scientific monographs, ATC categorization, and ingredient lookup in `ScientificsView.tsx` and `scientificDataService.ts`.
- Added unit tests in `src/services/scientificDataService.test.ts`.

#### 6. Purchase Module — Payment Money Source Selection (Cash Drawer vs. Outside vs. Mixed)
- **Requirement**: Allow the user to specify the funding source when recording or editing a supplier payment in the "Record Payment" form:
  - **100% Cash Drawer (Ledger)**: Paid fully from the pharmacy's physical cash drawer register; balance deducted from the drawer ledger.
  - **100% Outside Cash Drawer**: Paid completely outside the cash drawer (personal funds, owner wallet, external bank account/wire, safe, cheque); zero impact on physical cash drawer balances while still crediting the supplier's balance and tracking invoice settlements.
  - **Mixed Sources (Split)**: Allocate custom split amounts between the cash drawer and external sources (with quick 50%/50%, all drawer, or all outside preset buttons). Supports dual currency (USD and LBP splits).
- **Implementation**:
  - **Data Model & Types** (`src/types/pharmacy.ts`):
    - Added `PaymentFundingSource = 'drawer' | 'outside' | 'mixed'`.
    - Enhanced `SupplierPayment` interface with `fundingSource`, `drawerAmountUSD`, `drawerAmountLBP`, `outsideAmountUSD`, `outsideAmountLBP`, and `outsideSourceNote`.
  - **UI & Form Handling** (`src/components/purchase/SupplierPaymentModal.tsx`):
    - Added high-contrast, interactive option cards for Cash Drawer, Outside Drawer, and Mixed Sources.
    - Added dynamic split inputs for USD and LBP with automatic complement calculations and preset buttons.
    - Added optional note field for external funding details (e.g. Bank wire, personal wallet).
    - Provided real-time summary indicators displaying exact deductions from cash drawer vs outside.
  - **Cash Drawer & Financial Ledger Integration** (`src/components/finance/CashDrawerView.tsx`):
    - Updated cash movement aggregation:
      - Drawer payments deduct full amount from cash drawer balance.
      - Outside payments record an audit trail entry with $0 drawer deduction, preserving physical cash drawer balance accuracy.
      - Mixed payments deduct only the `drawerAmountUSD` and `drawerAmountLBP` from the physical cash drawer.
  - **Purchase View & Payment History** (`src/components/purchase/PurchaseView.tsx`):
    - Added a "Money Source" badge column in the supplier payments table with clear visual indicators and tooltips detailing the funding breakdown.
  - **Unit Testing** (`src/components/purchase/supplierPaymentSource.test.ts`):
    - Verified legacy payment fallback (defaults to 'drawer'), 0 drawer deduction for outside payments, and mixed split computations across USD and LBP currencies.
    - All 107 unit tests passing.

#### 7. Finance Module — Operational Expenses Tab & Cash Drawer Flow Separation
- **Requirement**: Add an 'Expenses' tab under Finance to log pharmacy operational costs (rent, electricity/EDL, generator & fuel, salaries, maintenance, taxes, etc.) separated from the main cash drawer flow, with the option to deduct from the cash drawer ledger if paid from drawer funds.
- **Implementation**:
  - **Data Models & State Management** (`src/types/pharmacy.ts`, `src/services/storage.ts`, `src/context/PharmacyContext.tsx`):
    - Defined `Expense` interface and `ExpenseCategory` enum supporting dual-currency (USD, LBP, MIXED), category tagging, payee, paidBy, receipt references, notes, and the `paidFromDrawer` boolean flag.
    - Integrated with local storage (`OfflineStorage.getExpenses()`, `OfflineStorage.saveExpenses()`).
    - Added `expenses` state and operations (`recordExpense`, `updateExpense`, `deleteExpense`) to `PharmacyContext`.
    - Fully integrated with multi-terminal sync engine (`syncEngine.broadcast('EXPENSE_CREATED')`, `'EXPENSE_DELETED'`, snapshot request/response sync between Main and Secondary PCs).
  - **UI & Expense Management View** (`src/components/finance/ExpensesView.tsx`):
    - Built comprehensive operational cost management dashboard.
    - KPI cards: Total Operational Costs, Deducted from Drawer, Outside Funds, and Current Month Costs.
    - Filters: Time periods (All Time, Today, This Month, This Year), Category dropdown, and Funding Source filter (Drawer Only vs Outside Only).
    - Search bar: Full-text search across titles, payees, reference numbers, and notes.
    - Modal dialog: Record operational expenses with category selection, date, payee, USD/LBP amounts, and an explicit toggle for deducting from the cash drawer register vs logging as external funds.
    - Export to CSV and printable report functions.
  - **Cash Drawer & Financial Ledger Integration** (`src/components/finance/CashDrawerView.tsx`):
    - Expenses with `paidFromDrawer === true` are integrated directly into the physical cash drawer journal as cash outflows (`OUT`), automatically decrementing the running cash drawer balance.
    - Expenses with `paidFromDrawer === false` are included for audit transparency with $0 drawer deduction, ensuring total drawer accuracy.
    - Added dedicated "Operational Expenses Only" filter and custom category badges with icons in the cash drawer journal.
  - **Financial Dashboard Overview** (`src/components/finance/FinanceView.tsx`):
    - Added the "Operational Expenses" tab to the top navigation.
    - Enhanced performance overview cards to reflect Net Operating Profit (`Gross Profit - Operational Expenses`), Operational Expenses breakdown (Drawer vs Outside), and added a Recent Operational Expenses table with direct navigation.

#### 8. Customer Module — "Return On Sale" Subtab & Inventory/Cash Drawer Reconciliation
- **Requirement**: In the Customer tab, add a subtab called "Return On Sale" with a form to return goods from customers, adjusting warehouse stock quantities and the cash drawer accordingly.
- **Implementation**:
  - **Data Model & Synchronization** (`src/types/pharmacy.ts`, `src/services/storage.ts`, `src/context/PharmacyContext.tsx`):
    - Defined `SaleReturn` and `SaleReturnItem` models supporting dual currencies (USD and LBP), original sale linking, customer linking, refund execution methods (`cash_drawer` vs `customer_credit`), item condition, batch number, and expiry date.
    - Added storage methods (`OfflineStorage.getSaleReturns()`, `OfflineStorage.saveSaleReturns()`).
    - Added state and action handlers (`recordSaleReturn`, `deleteSaleReturn`) to `PharmacyContext` with multi-terminal sync engine broadcasting (`SALE_RETURN_CREATED`, `SALE_RETURN_DELETED`) and snapshot payload support.
    - **Stock Quantity Adjustment**: Automatically increments product inventory on return (converting piece quantities to boxes when `isPiece === true`), adding returned items back to their matching batch/expiry or oldest batch, and broadcasting stock mutations.
    - **Cash Drawer & Debt Balance Adjustment**:
      - `cash_drawer`: Automatically registers cash outflow (`OUT`) in the unified Cash Drawer journal (`src/components/finance/CashDrawerView.tsx`), immediately deducting the refund amount from the physical drawer balance.
      - `customer_credit`: Automatically decrements the patient's outstanding credit debt balance in `customers` state and syncs the update.
  - **User Interface Components**:
    - **Return On Sale Subtab** (`src/components/customer/ReturnOnSaleTab.tsx`): Added subtab to `CustomerView.tsx` with summary cards (Total Returns, Cash Drawer Refunded, Customer Account Credit), search/filter by method or patient, table of returned vouchers, view details modal, and delete voucher action with full inventory reversal.
    - **New Customer Return Form Modal** (`src/components/customer/NewCustomerReturnModal.tsx`): Desktop window form to select or search customer/walk-in patient, refund method (Cash Drawer vs Customer Credit), optional original sale invoice lookup to autofill sold items, search and add products/drugs with batch selection, calculate USD & LBP refund totals, and confirm restock.

#### 9. Stock Module — Bulk Inventory CSV Import UI Cleanup
- **Requirement**: Hide the selected elements from the "Bulk Inventory CSV Import" popup window.
- **Implementation**:
  - Hid the top requirements instruction banner (`CSS selector 1`).
  - Hid the "Quick Actions & Template" side card (`CSS selector 2`).
  - Hid the raw CSV preview and manual paste textarea block (`CSS selector 3`).

---

## Ongoing Backlog & Next Steps

1. **POS Grid Layout**:
   - Allow 4 product cards next to each other in POS mode.
   - Adjust card dimensions and text alignment.
2. **Scientifics Generic Alternatives Ordering & Filtering**:
   - In "4. Generic Alternatives in Lebanon", list single active ingredient alternatives matching the product first.
   - List multi-ingredient combinations containing the molecule second.
   - Prioritize in-stock alternatives while showing all alternatives regardless of stock status.
   - Audit molecule matching to ensure exact active ingredient correspondence.
3. **Multi-Terminal LAN Connectivity**:
   - Validate peer connection and developer view access for secondary PCs on the local network.
