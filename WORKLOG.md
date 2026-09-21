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

#### 5. Scientifics & Generic Alternatives
- Enhanced scientific monographs, ATC categorization, and ingredient lookup in `ScientificsView.tsx` and `scientificDataService.ts`.
- Added unit tests in `src/services/scientificDataService.test.ts`.

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
