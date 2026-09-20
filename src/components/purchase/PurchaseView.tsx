import { SupplierPaymentModal } from './SupplierPaymentModal';
import { motion } from "motion/react";
import React, { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect, useImperativeHandle } from 'react';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Package,
  Check,
  X,
  FileText,
  Barcode,
  Edit2,
  ScanBarcode,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Eye,
  Pencil,
  Trash2,
Receipt,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { Product, PurchaseItem, PurchaseInvoice } from '../../types/pharmacy';
import { filterProductsByMultiWordQuery } from '../../utils/searchUtils';
import { DesktopWindow } from '../common/DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';
import { resolveProductBatches } from '../../utils/stockUtils';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import { AddStockProductModal } from '../stock/AddStockProductModal';
import { useWindowContext } from '../../context/WindowContext';

const formatWithCommas = (val: string | number) => {
  if (val === null || val === undefined) return '';
  const parts = val.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

interface PurchaseAddedItemRowProps {
  item: PurchaseItem;
  index: number;
  productDetails?: Product;
  purchaseCurrency: 'USD' | 'LBP';
  exchangeRate: number;
  vatRate: number;
  onChange: (index: number, updated: PurchaseItem) => void;
  onRemove: (index: number) => void;
}

const PurchaseAddedItemRow: React.FC<PurchaseAddedItemRowProps> = ({
  item,
  index,
  productDetails,
  purchaseCurrency,
  exchangeRate,
  vatRate,
  onChange,
  onRemove
}) => {
  const [costInput, setCostInput] = useState(() => (purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP).toString());
  const [discountInput, setDiscountInput] = useState(() => (item.discount || 0).toString());
  const [priceInput, setPriceInput] = useState(() => {
    const val = purchaseCurrency === 'USD' ? item.sellingPriceUSD : item.sellingPriceLBP;
  

  return (val || 0).toString();
  });

  const total = (purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP) * item.quantity;
  const [totalInput, setTotalInput] = useState(total.toString());

  useEffect(() => {
    setCostInput((purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP).toString());
    setPriceInput(((purchaseCurrency === 'USD' ? item.sellingPriceUSD : item.sellingPriceLBP) || 0).toString());
    setDiscountInput((item.discount || 0).toString());
  }, [purchaseCurrency, item.unitCostUSD, item.unitCostLBP, item.sellingPriceUSD, item.sellingPriceLBP, item.discount]);

  useEffect(() => {
    setTotalInput(((purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP) * item.quantity).toString());
  }, [purchaseCurrency, item.unitCostUSD, item.unitCostLBP, item.quantity]);

  const flushCost = (str: string) => {
    const val = parseFloat(str) || 0;
    let costUSD = 0, costLBP = 0;
    if (purchaseCurrency === 'USD') {
      costUSD = val; costLBP = Math.round(val * exchangeRate);
    } else {
      costLBP = val; costUSD = val / exchangeRate;
    }
    onChange(index, { ...item, unitCostUSD: costUSD, unitCostLBP: costLBP });
  };
  
  const flushPrice = (str: string) => {
    const val = parseFloat(str) || 0;
    let pUSD = 0, pLBP = 0;
    if (purchaseCurrency === 'USD') {
      pUSD = val; pLBP = Math.round(val * exchangeRate);
    } else {
      pLBP = val; pUSD = val / exchangeRate;
    }
    onChange(index, { ...item, sellingPriceUSD: pUSD, sellingPriceLBP: pLBP });
  };

  return (
    <div className="p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(19,minmax(0,1fr))] gap-2 items-end min-w-[900px]">
        <div className="sm:col-span-3 relative">
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 flex items-center justify-between">
            <span className="truncate font-medium flex-1 mr-2">
              <span>{item.productName}</span>
              {productDetails && (
                <span className="font-normal text-slate-500 text-[10px] ml-1.5">
                  {productDetails.dosage} {productDetails.presentation} {productDetails.form}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-1 text-rose-500 hover:bg-rose-100 rounded-md transition-colors dark:hover:bg-rose-900/40 cursor-pointer"
              title="Remove Item"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        
        <div>
          <select
            value={item.isPiece ? 'piece' : 'box'}
            onChange={(e) => onChange(index, { ...item, isPiece: e.target.value === 'piece' })}
            disabled={!productDetails?.isDivisible}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
          >
            <option value="box">Box</option>
            {productDetails?.isDivisible && <option value="piece">{productDetails.pieceName || 'Piece'}</option>}
          </select>
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={item.expiryDate ? item.expiryDate.split('-').reverse().join('/') : ''}
            onChange={(e) => {
               const val = e.target.value;
               // simple passthrough for now, complex parsing can be added if needed on blur
               onChange(index, { ...item, expiryDate: val });
            }}
            onBlur={(e) => {
               let val = e.target.value.trim();
               const digits = val.replace(/[^\d]/g, '');
               let d = 0, m = 0, y = 0;
               if (digits.length === 4) { m = parseInt(digits.slice(0, 2), 10); y = 2000 + parseInt(digits.slice(2, 4), 10); }
               else if (digits.length === 6) {
                 const p1 = parseInt(digits.slice(0, 2), 10), p2 = parseInt(digits.slice(2, 4), 10), p3 = parseInt(digits.slice(4, 6), 10);
                 if (p1 <= 12 && p2 === 20) { m = p1; y = parseInt(digits.slice(2, 6), 10); }
                 else if (p2 <= 12) { d = p1; m = p2; y = 2000 + p3; }
                 else { m = p1; y = parseInt(digits.slice(2, 6), 10); }
               } else if (digits.length === 8) {
                 d = parseInt(digits.slice(0, 2), 10); m = parseInt(digits.slice(2, 4), 10); y = parseInt(digits.slice(4, 8), 10);
               } else { return; }
               if (m >= 1 && m <= 12) {
                 if (d === 0 || d > 31) d = new Date(y, m, 0).getDate();
                 onChange(index, { ...item, expiryDate: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}` });
               }
            }}
            placeholder="DD/MM/YYYY"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 text-center"
          />
        </div>

        <div>
          <input
            type="text"
            value={item.batchNumber}
            onChange={(e) => onChange(index, { ...item, batchNumber: e.target.value })}
            placeholder="Batch"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <input
            type="number"
            value={item.quantity === 0 ? '' : item.quantity}
            onChange={(e) => onChange(index, { ...item, quantity: parseInt(e.target.value) || 0 })}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 cursor-not-allowed">
            {vatRate > 0 ? `${vatRate}%` : '0 VAT'}
          </div>
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={formatWithCommas(priceInput.split('.')[0])}
            onChange={(e) => setPriceInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => flushPrice(priceInput)}
            onFocus={(e) => e.target.select()}
            style={{ fieldSizing: "content", minWidth: "100%" } as any}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <input
            type="text"
            value={formatWithCommas(discountInput.split('.')[0])}
            onChange={(e) => setDiscountInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => onChange(index, { ...item, discount: parseFloat(discountInput) || 0 })}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={formatWithCommas(costInput.split('.')[0])}
            onChange={(e) => setCostInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => flushCost(costInput)}
            onFocus={(e) => e.target.select()}
            style={{ fieldSizing: "content", minWidth: "100%" } as any}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={formatWithCommas(totalInput.split('.')[0])}
            onChange={(e) => setTotalInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => {
              const newTotal = parseFloat(totalInput) || 0;
              const safeQty = item.quantity <= 0 ? 1 : item.quantity;
              let newCost = newTotal / safeQty;
              if (purchaseCurrency === 'LBP') newCost = Math.round(newCost);
              setCostInput(newCost.toString());
              flushCost(newCost.toString());
            }}
            onFocus={(e) => e.target.select()}
            style={{ fieldSizing: "content", minWidth: "100%" } as any}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-bold"
          />
        </div>
      </div>


    </div>
  );
};

export const parseNumber = (val: string | number): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const num = parseFloat(val.toString().replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};



export const formatInvoiceDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export const formatExpiryToMMYYYY = (dateStr: string | undefined): string => {
  if (!dateStr || !dateStr.trim() || dateStr === '-') return '';
  const trimmed = dateStr.trim();

  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length >= 2) {
      let y = parts[0].trim();
      let m = parts[1].trim();
      if (y.length <= 2 && m.length === 4) {
        const tmp = y;
        y = m;
        m = tmp;
      }
      if (y.length === 2) y = `20${y}`;
      if (m.length === 1) m = `0${m}`;
      return `${m}/${y}`;
    }
  }

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length >= 2) {
      let p1 = parts[0].trim();
      let p2 = parts[1].trim();
      if (p1.length === 4) {
        if (p2.length === 1) p2 = `0${p2}`;
        return `${p2}/${p1}`;
      }
      if (p1.length === 1) p1 = `0${p1}`;
      if (p2.length === 2) p2 = `20${p2}`;
      return `${p1}/${p2}`;
    }
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 4) {
    const m = digits.slice(0, 2);
    const y = `20${digits.slice(2, 4)}`;
    return `${m}/${y}`;
  }
  if (digits.length === 6) {
    const m = digits.slice(0, 2);
    const y = digits.slice(2, 6);
    return `${m}/${y}`;
  }

  return trimmed;
};

export const parseExpiryDate = (input: string): { mm: string; yyyy: string; fullDate: string } | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let m = 0;
  let y = 0;

  const normalized = trimmed.replace(/[-.]/g, '/');

  if (normalized.includes('/')) {
    const parts = normalized.split('/');
    if (parts.length >= 2) {
      const p0Str = parts[0].replace(/\D/g, '');
      const p1Str = parts[1].replace(/\D/g, '');
      const p0 = parseInt(p0Str, 10);
      const p1 = parseInt(p1Str, 10);

      if (p0Str.length === 4) {
        y = p0;
        m = p1;
      } else {
        m = p0;
        if (p1Str.length === 2) {
          y = 2000 + p1;
        } else if (p1Str.length === 4) {
          y = p1;
        }
      }
    }
  } else {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 4) {
      m = parseInt(digits.slice(0, 2), 10);
      y = 2000 + parseInt(digits.slice(2, 4), 10);
    } else if (digits.length === 6) {
      m = parseInt(digits.slice(0, 2), 10);
      y = parseInt(digits.slice(2, 6), 10);
    } else if (digits.length === 8) {
      const first4 = parseInt(digits.slice(0, 4), 10);
      if (first4 >= 2000 && first4 <= 2100) {
        y = first4;
        m = parseInt(digits.slice(4, 6), 10);
      } else {
        m = parseInt(digits.slice(2, 4), 10);
        y = parseInt(digits.slice(4, 8), 10);
      }
    }
  }

  if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
    const mm = m.toString().padStart(2, '0');
    const yyyy = y.toString();
    const d = new Date(y, m, 0).getDate();
    const dd = d.toString().padStart(2, '0');
    return {
      mm,
      yyyy,
      fullDate: `${yyyy}-${mm}-${dd}`
    };
  }

  return null;
};

export const formatExpiryInput = (
  rawInput: string,
  prevValue: string = '',
  isDelete: boolean = false
): string => {
  if (!rawInput) return '';

  // If user is deleting and backspaced the slash (e.g. prev was '05/' and raw is '05')
  if (isDelete && prevValue.endsWith('/') && prevValue.slice(0, -1) === rawInput) {
    return rawInput;
  }

  // If user pasted or entered an ISO date like YYYY-MM or YYYY-MM-DD
  if (/^\d{4}-\d{2}/.test(rawInput.trim())) {
    const formatted = formatExpiryToMMYYYY(rawInput);
    if (formatted) return formatted;
  }

  // Normalize delimiters (- and . to /)
  const normalized = rawInput.replace(/[-.]/g, '/');

  // Handle delimiter typed after 1 or 2 digits
  if (normalized.endsWith('/') && !prevValue.endsWith('/')) {
    const beforeSlash = normalized.slice(0, -1).replace(/\D/g, '');
    if (beforeSlash.length === 1) {
      const d = parseInt(beforeSlash, 10);
      if (d >= 1 && d <= 9) {
        return `0${d}/`;
      }
    } else if (beforeSlash.length === 2) {
      let m = parseInt(beforeSlash, 10);
      let mStr = beforeSlash;
      if (m === 0) mStr = '01';
      else if (m > 12) mStr = '12';
      return `${mStr}/`;
    }
  }

  const onlyDigits = normalized.replace(/\D/g, '');
  if (onlyDigits.length === 0) {
    if (normalized.includes('/')) {
      const parts = normalized.split('/');
      const yyPart = parts.slice(1).join('').replace(/\D/g, '').slice(0, 4);
      if (yyPart.length > 0) {
        return `/${yyPart}`;
      }
    }
    return '';
  }

  // Single digit input with no delimiter
  if (onlyDigits.length === 1 && !normalized.includes('/')) {
    if (!isDelete) {
      const d = parseInt(onlyDigits, 10);
      if (d >= 2 && d <= 9) {
        return `0${d}/`;
      }
    }
    return onlyDigits;
  }

  // Two digits input with no delimiter
  if (onlyDigits.length === 2 && !normalized.includes('/')) {
    if (isDelete) return onlyDigits;
    let m = parseInt(onlyDigits, 10);
    if (m === 0) return '01/';
    if (m > 12) {
      return `01/${onlyDigits[1]}`;
    }
    return `${onlyDigits}/`;
  }

  // If slash exists
  if (normalized.includes('/')) {
    const parts = normalized.split('/');
    const mPart = parts[0].replace(/\D/g, '');
    const yyStr = parts.slice(1).join('').replace(/\D/g, '').slice(0, 4);

    let mmStr = '';
    if (mPart.length === 0) {
      mmStr = '';
    } else if (mPart.length === 1) {
      if (isDelete) {
        mmStr = mPart;
      } else {
        const d = parseInt(mPart, 10);
        if (d >= 2 && d <= 9) {
          mmStr = `0${d}`;
        } else {
          mmStr = mPart;
        }
      }
    } else if (mPart.length >= 2) {
      let m = parseInt(mPart.slice(0, 2), 10);
      if (m === 0) mmStr = '01';
      else if (m > 12) mmStr = '12';
      else mmStr = mPart.slice(0, 2);
    }

    if (!mmStr && !yyStr) return '';
    if (!mmStr && yyStr) return `/${yyStr}`;
    if (!yyStr && !normalized.endsWith('/')) {
      return mmStr;
    }
    return `${mmStr}/${yyStr}`;
  }

  // Pure digits >= 3 (no delimiter typed)
  let mmStr = '';
  let yyStr = '';
  let m = parseInt(onlyDigits.slice(0, 2), 10);
  if (m === 0) {
    mmStr = '01';
    yyStr = onlyDigits.slice(2, 6);
  } else if (m > 12) {
    mmStr = '01';
    yyStr = onlyDigits.slice(1, 5);
  } else {
    mmStr = onlyDigits.slice(0, 2);
    yyStr = onlyDigits.slice(2, 6);
  }

  if (!mmStr) return '';
  if (!yyStr && !normalized.endsWith('/')) {
    return mmStr;
  }
  return `${mmStr}/${yyStr}`;
};

export const getExpiryCursorPosition = (
  prevVal: string,
  rawVal: string,
  rawCursor: number,
  formattedVal: string,
  isDelete: boolean
): number => {
  if (!formattedVal) return 0;
  if (rawCursor === 0) return 0;

  // If user typed 2nd digit of month (cursor at 2) and formatted string has slash at index 2, step over slash
  if (!isDelete && rawCursor === 2 && formattedVal.length >= 3 && formattedVal[2] === '/') {
    return 3;
  }

  if (formattedVal === rawVal) {
    return Math.min(rawCursor, formattedVal.length);
  }

  // Auto-padded single digit month (e.g. 8 -> 08/ or 8/2028 -> 08/2028)
  if (!isDelete && rawCursor <= 2) {
    const rawMonthDigits = rawVal.split('/')[0].replace(/\D/g, '');
    const formattedMonthDigits = formattedVal.split('/')[0].replace(/\D/g, '');
    if (rawMonthDigits.length === 1 && formattedMonthDigits.length === 2 && formattedMonthDigits.startsWith('0')) {
      return formattedVal.includes('/') ? formattedVal.indexOf('/') + 1 : formattedVal.length;
    }
  }

  // Count digits before the cursor in rawVal
  const digitsBefore = rawVal.slice(0, rawCursor).replace(/\D/g, '').length;
  if (digitsBefore === 0) {
    return formattedVal.includes('/') && rawVal.startsWith('/') ? 0 : 0;
  }

  let count = 0;
  for (let i = 0; i < formattedVal.length; i++) {
    if (/\d/.test(formattedVal[i])) {
      count++;
      if (count === digitsBefore) {
        if (i === 1 && formattedVal[2] === '/' && !isDelete) {
          return 3;
        }
        return i + 1;
      }
    }
  }

  return Math.min(rawCursor, formattedVal.length);
};

export interface ExpiryTableInputProps {
  id?: string;
  value: string;
  onChange: (formattedValue: string, parsedExpiryISO: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const ExpiryTableInput = React.forwardRef<HTMLInputElement, ExpiryTableInputProps>(({
  id,
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  placeholder = 'MM/YYYY',
  disabled = false,
}, forwardedRef) => {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const cursorRef = useRef<number | null>(null);
  const isMouseFocusRef = useRef(false);

  useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

  useLayoutEffect(() => {
    if (cursorRef.current !== null && innerRef.current) {
      const pos = Math.max(0, Math.min(cursorRef.current, innerRef.current.value.length));
      innerRef.current.setSelectionRange(pos, pos);
      cursorRef.current = null;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawCursor = input.selectionStart ?? input.value.length;
    const inputType = (e.nativeEvent as InputEvent)?.inputType;
    const isDelete = inputType
      ? inputType.startsWith('delete')
      : input.value.length < value.length;

    const formatted = formatExpiryInput(input.value, value, isDelete);
    const targetCursor = getExpiryCursorPosition(value, input.value, rawCursor, formatted, isDelete);
    cursorRef.current = targetCursor;

    requestAnimationFrame(() => {
      if (innerRef.current && document.activeElement === innerRef.current) {
        const pos = Math.max(0, Math.min(targetCursor, innerRef.current.value.length));
        innerRef.current.setSelectionRange(pos, pos);
      }
    });

    const parsed = parseExpiryDate(formatted);
    onChange(formatted, parsed ? parsed.fullDate : '');
  };

  const handleBlur = () => {
    if (value.trim()) {
      const parsed = parseExpiryDate(value);
      if (parsed) {
        onChange(`${parsed.mm}/${parsed.yyyy}`, parsed.fullDate);
      }
    }
    onBlur?.();
  };

  const handleMouseDown = () => {
    if (document.activeElement !== innerRef.current) {
      isMouseFocusRef.current = true;
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isMouseFocusRef.current) {
      e.target.select();
    }
    isMouseFocusRef.current = false;
  };

  return (
    <input
      ref={innerRef}
      id={id}
      type="text"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onMouseDown={handleMouseDown}
      onFocus={handleFocus}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
});
ExpiryTableInput.displayName = 'ExpiryTableInput';

export const formatExpiryDate = (dateStr: string | undefined): string => {
  if (!dateStr || !dateStr.trim() || dateStr === '-') return '-';
  const formatted = formatExpiryToMMYYYY(dateStr);
  return formatted || dateStr;
};
export const formatNumber = (val: string | number): string => {
  if (val === undefined || val === null || val === '') return '';

  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const rounded = parseFloat(absVal.toFixed(4));
    const str = rounded.toString();
    const parts = str.split('.');
    const intPart = parseInt(parts[0], 10);
    const formattedInt = isNaN(intPart) ? '0' : intPart.toLocaleString('en-US');
    const res = parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;
    return isNegative ? `-${res}` : res;
  }

  const rawStr = val.toString().trim();
  if (!rawStr) return '';

  const isNegative = rawStr.startsWith('-');
  // Clean characters: keep only digits and dots
  let cleaned = '';
  let hasDot = false;
  for (let i = 0; i < rawStr.length; i++) {
    const char = rawStr[i];
    if (char >= '0' && char <= '9') {
      cleaned += char;
    } else if (char === '.' && !hasDot) {
      cleaned += '.';
      hasDot = true;
    }
  }

  if (!cleaned && !hasDot) return '';

  const parts = cleaned.split('.');
  const intStr = parts[0];
  const decStr = parts.length > 1 ? parts[1] : undefined;

  let formattedInt = '';
  if (intStr) {
    const parsedInt = parseInt(intStr, 10);
    if (!isNaN(parsedInt)) {
      formattedInt = parsedInt.toLocaleString('en-US');
    }
  } else if (hasDot) {
    formattedInt = '0';
  }

  let result = formattedInt;
  if (decStr !== undefined) {
    result = `${formattedInt}.${decStr}`;
  }

  return isNegative ? `-${result}` : result;
};
export const PurchaseView: React.FC = () => {
  const { purchases, supplierPayments, suppliers, products, recordPurchase, updatePurchase, deletePurchase, updateProduct, recordSupplierPayment, updateSupplierPayment, deleteSupplierPayment, exchangeRate, formatLBP, formatUSD, settings, addNotification } = usePharmacy();
  const { restoreWindow, restoreSectionWindows } = useWindowContext();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [selectedPaymentSupplierId, setSelectedPaymentSupplierId] = useState<string>('ALL');
  const [initialSupplierIdForModal, setInitialSupplierIdForModal] = useState<string | undefined>(undefined);

  const sortedSuppliersForPayment = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const aHasBalance = (a.balanceUSD || 0) >= 0.01 || (a.balanceLBP || 0) >= 1;
      const bHasBalance = (b.balanceUSD || 0) >= 0.01 || (b.balanceLBP || 0) >= 1;
      if (aHasBalance && !bHasBalance) return -1;
      if (!aHasBalance && bHasBalance) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [suppliers]);

  // Filter invoices and payments based on search query
  const filteredPurchases = purchases.filter(p => {
    if (!historySearchQuery.trim()) return true;
    const query = historySearchQuery.toLowerCase();
    const shortId = p.id.replace('pur-', '');
    return (
      (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(query)) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(query)) ||
      (shortId.includes(query))
    );
  });

  const filteredPayments = supplierPayments.filter(p => {
    if (!historySearchQuery.trim()) return true;
    const query = historySearchQuery.toLowerCase();
    const shortId = p.id.startsWith('RCT-') ? p.id : p.id.split('-')[0];
    return (
      (p.receiptNumber && p.receiptNumber.toLowerCase().includes(query)) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(query)) ||
      (shortId.includes(query))
    );
  });

  const suppliersForBalances = useMemo(() => {
    return sortedSuppliersForPayment.filter(s => {
      const hasBalance = (s.balanceUSD || 0) >= 0.01 || (s.balanceLBP || 0) >= 1;
      if (!historySearchQuery.trim()) return hasBalance;
      const q = historySearchQuery.toLowerCase();
      return hasBalance && (s.name.toLowerCase().includes(q) || (s.code && s.code.toLowerCase().includes(q)));
    });
  }, [sortedSuppliersForPayment, historySearchQuery]);

  const supplierInvoicesForView = useMemo(() => {
    if (selectedPaymentSupplierId === 'ALL') return [];
    return purchases.filter(p => p.supplierId === selectedPaymentSupplierId);
  }, [purchases, selectedPaymentSupplierId]);

  const paymentsForView = useMemo(() => {
    return filteredPayments.filter(p => selectedPaymentSupplierId === 'ALL' || p.supplierId === selectedPaymentSupplierId);
  }, [filteredPayments, selectedPaymentSupplierId]);

  const openSupplierPaymentModal = (supplierId?: string, payment?: any) => {
    restoreWindow('supplier_payment_window');
    restoreWindow('supplier_payment_modal');
    restoreWindow('supplier payment');
    restoreSectionWindows('purchase');
    if (payment) {
      setPaymentToEdit(payment);
      setInitialSupplierIdForModal(payment.supplierId);
    } else {
      setPaymentToEdit(null);
      setInitialSupplierIdForModal(supplierId && supplierId !== 'ALL' ? supplierId : undefined);
    }
    setIsPaymentModalOpen(true);
  };

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editRowData, setEditRowData] = useState<{
    code: string;
    barcode: string;
    name: string;
    unit: 'box' | 'piece';
    qty: string;
    free: string;
    batch: string;
    expiry: string;
    displayExpiry: string;
    unitPrice: string;
    pubPrice: string;
    discount: string;
    cost: string;
    vat: string;
    profit: string;
    total: string;
  } | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);

  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(0);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const supplierListContainerRef = useRef<HTMLDivElement>(null);
  const supplierItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (isCreateOpen) {
      setTimeout(() => supplierInputRef.current?.focus(), 100);
    }
  }, [isCreateOpen]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(supplierSearchQuery.toLowerCase())
    );
  }, [suppliers, supplierSearchQuery]);

  useEffect(() => {
    setSupplierHighlightedIndex(0);
  }, [supplierSearchQuery]);

  useEffect(() => {
    if (!isSupplierDropdownOpen) return;
    const activeEl = supplierItemRefs.current[supplierHighlightedIndex];
    const container = supplierListContainerRef.current;
    if (!activeEl || !container) return;

    const activeTop = activeEl.offsetTop;
    const activeHeight = activeEl.offsetHeight;
    const activeBottom = activeTop + activeHeight;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    if (activeTop < containerScrollTop) {
      container.scrollTop = activeTop;
    } else if (activeBottom > containerScrollTop + containerHeight) {
      container.scrollTop = activeBottom - containerHeight;
    }
  }, [supplierHighlightedIndex, isSupplierDropdownOpen]);

  const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSupplierDropdownOpen) {
        setIsSupplierDropdownOpen(true);
        setSupplierHighlightedIndex(0);
      } else if (filteredSuppliers.length > 0) {
        setSupplierHighlightedIndex((prev) =>
          Math.min(prev + 1, filteredSuppliers.length - 1)
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isSupplierDropdownOpen) {
        setSupplierHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isSupplierDropdownOpen && filteredSuppliers[supplierHighlightedIndex]) {
        const s = filteredSuppliers[supplierHighlightedIndex];
        setSelectedSupplierId(s.id);
        setSupplierSearchQuery(s.name);
        setIsSupplierDropdownOpen(false);
      }
      setTimeout(() => invoiceDateRef.current?.focus(), 0);
    } else if (e.key === 'Escape') {
      setIsSupplierDropdownOpen(false);
    }
  };

  const invoiceDateRef = useRef<HTMLInputElement>(null);
  const paymentStatusRef = useRef<HTMLSelectElement>(null);
  const currencyRef = useRef<HTMLSelectElement>(null);
  const invoiceNumberRef = useRef<HTMLInputElement>(null);
  const receiptNumberRef = useRef<HTMLInputElement>(null);

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [paymentReceiptNumber, setPaymentReceiptNumber] = useState('');
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [invoiceDiscountAmount, setInvoiceDiscountAmount] = useState('0');
  const [manualTotal, setManualTotal] = useState('');
  

  useEffect(() => {
    if (!isSupplierDropdownOpen) {
      const sel = suppliers.find(s => s.id === selectedSupplierId);
      if (sel) {
        setSupplierSearchQuery(sel.name);
      }
    }
  }, [selectedSupplierId, isSupplierDropdownOpen, suppliers]);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        supplierDropdownRef.current &&
        !supplierDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // New Purchase Items
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [currentProductId, setCurrentProductId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');

  const [itemQty, setItemQty] = useState('0');
  const [itemFree, setItemFree] = useState('0');
  const [itemProfitPercent, setItemProfitPercent] = useState('0');

  const [itemVATChoice, setItemVATChoice] = useState<'setting' | 'none'>('setting');
  const [itemCostUSD, setItemCostUSD] = useState('0');
  const [itemTotalInput, setItemTotalInput] = useState('0');
  const [isTotalFocused, setIsTotalFocused] = useState(false);
  const [isPublicPriceFocused, setIsPublicPriceFocused] = useState(false);
  const [isDiscountFocused, setIsDiscountFocused] = useState(false);
  const [itemDiscount, setItemDiscount] = useState('0');
  const [itemUnitPrice, setItemUnitPrice] = useState('0');
  const [isUnitPriceFocused, setIsUnitPriceFocused] = useState(false);
  const [itemPublicPrice, setItemPublicPrice] = useState('0');
  const [itemBatch, setItemBatch] = useState('');
  const [itemExpiry, setItemExpiry] = useState('');
  const [displayExpiry, setDisplayExpiry] = useState('');
  const [itemUnit, setItemUnit] = useState<'box' | 'piece'>('box');
  const [purchaseCurrency, setPurchaseCurrency] = useState<'USD' | 'LBP'>('LBP');

  // Medication Search & Barcode Scanner State
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [scanStatusMessage, setScanStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Add Stock Product from Purchase Form
  const [isAddStockProductModalOpen, setIsAddStockProductModalOpen] = useState(false);
  const [addStockInitialData, setAddStockInitialData] = useState<{
    barcode?: string;
    code?: string;
    name?: string;
    batch?: string;
    expiry?: string;
  }>({});

  const handleOpenAddStockProduct = () => {
    restoreWindow('stock_add_new_inventory_item');
    restoreWindow('add-stock-product-window');
    restoreWindow('add new item');
    setAddStockInitialData({
      barcode: itemBarcode.trim(),
      code: itemCode.trim(),
      name: productSearchQuery.trim(),
      batch: itemBatch.trim(),
      expiry: itemExpiry.trim() || displayExpiry.trim(),
    });
    setIsAddStockProductModalOpen(true);
  };

  const handleStockProductAdded = (newProd: Product) => {
    selectProduct(newProd, true);
    setScanStatusMessage({
      type: 'success',
      text: `Added "${newProd.name}" (${newProd.code}) to stock inventory and loaded to purchase invoice!`,
    });
    setTimeout(() => {
      setScanStatusMessage((curr) => (curr?.text.includes(newProd.name) ? null : curr));
    }, 5000);
  };

  const showFeedback = (type: 'success' | 'error', text: string, duration = type === 'error' ? 8000 : 4000) => {
    setScanStatusMessage({ type, text });

    setTimeout(() => {
      setScanStatusMessage((curr) => (curr?.text === text ? null : curr));
    }, duration);
  };

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const unitInputRef = useRef<HTMLSelectElement | null>(null);
  const expiryInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const freeInputRef = useRef<HTMLInputElement | null>(null);
  const profitPercentInputRef = useRef<HTMLInputElement | null>(null);
  const vatInputRef = useRef<HTMLSelectElement | null>(null);
  const costInputRef = useRef<HTMLInputElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);
  const publicPriceInputRef = useRef<HTMLInputElement | null>(null);
  const totalInputRef = useRef<HTMLInputElement | null>(null);

  const selectedProduct = products.find((p) => p.id === currentProductId);

  const formatWithCommas = (val: string) => {
    if (!val) return '';
    const parts = val.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to find the expiry date and batch number from the most recent purchase for a given product
  const getLastPurchaseDetails = (prod: Product): { expiryDate: string, batchNumber: string, lastItem?: PurchaseItem } => {
    let expiryDate = '';
    let batchNumber = '';
    let lastItem: PurchaseItem | undefined;
    
    if (!purchases || purchases.length === 0) return { expiryDate, batchNumber };

    // Sort purchases by timestamp or date descending (newest first)
    const sorted = [...purchases].sort((a, b) => {
      const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
      const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
      return timeB - timeA;
    });

    for (const p of sorted) {
      if (!p.items || p.items.length === 0) continue;
      const foundItem = p.items.find(
        (it) =>
          (it.productId && it.productId === prod.id) ||
          (it.productCode && prod.code && it.productCode.toLowerCase() === prod.code.toLowerCase())
      );
      if (foundItem) {
        if (!lastItem) {
          lastItem = foundItem;
        }
        if (!expiryDate && foundItem.expiryDate && foundItem.expiryDate.trim()) {
          expiryDate = foundItem.expiryDate.trim();
        }
        if (!batchNumber && foundItem.batchNumber && foundItem.batchNumber.trim()) {
          batchNumber = foundItem.batchNumber.trim();
        }
        
        // If we found both, we can break early
        if (expiryDate && batchNumber) break;
      }
    }

    return { expiryDate, batchNumber, lastItem };
  };

  // Helper to format stock in "X box Y pieces" format using product's pieceName
  const formatStockBoxesAndPieces = (prod: Product): string => {
    const isDivisible = Boolean(prod.isDivisible && prod.piecesPerBox && prod.piecesPerBox > 1);

    if (!isDivisible) {
      const qty = Number.isInteger(prod.stockQuantity) ? prod.stockQuantity : prod.stockQuantity.toFixed(2);
      return `${qty} box`;
    }

    const piecesPerBox = prod.piecesPerBox || 1;
    const totalPieces = Math.round((prod.stockQuantity || 0) * piecesPerBox);
    const boxes = Math.floor(totalPieces / piecesPerBox);
    const pieces = totalPieces % piecesPerBox;

    const rawPieceName = prod.pieceName?.trim() || 'piece';
    const pieceLabel =
      pieces > 1 && !rawPieceName.toLowerCase().endsWith('s')
        ? `${rawPieceName}s`
        : rawPieceName;

    if (pieces > 0) {
      return `${boxes} box ${pieces} ${pieceLabel}`;
    }
    return `${boxes} box`;
  };

  const selectProduct = (prod: Product, autoFocusQty = true) => {
    setCurrentProductId(prod.id);
    const defaultCost = prod.costPriceUSD != null ? prod.costPriceUSD : 0;
    setItemCostUSD(purchaseCurrency === 'USD' ? defaultCost.toString() : Math.round(defaultCost * exchangeRate).toString());
    setItemUnit('box');

    setItemCode(prod.code || '');
    setItemBarcode(prod.barcode || '');

    const additionalDetails = [prod.dosage, prod.presentation, prod.form].filter(Boolean).join(' ');
    setProductSearchQuery(`${prod.name}${additionalDetails ? ` ${additionalDetails}` : ''}`);
    setIsSearchDropdownOpen(false);
    setScanStatusMessage(null);

    // Fetch last purchase details (batch and expiry)
    const lastDetails = getLastPurchaseDetails(prod);

    // Auto-fill batch
    if (lastDetails.batchNumber) {
      setItemBatch(lastDetails.batchNumber);
    } else if (prod.batches && prod.batches.length > 0) {
      setItemBatch(prod.batches[0].batchNumber || '');
    } else {
      setItemBatch(prod.batchNumber || '');
    }

    // Expiry date: use expiry from the last purchase for this product directly, or keep blank if not found
    const lastExpiry = lastDetails.expiryDate;

    if (lastExpiry) {
      const parsed = parseExpiryDate(lastExpiry);
      if (parsed) {
        setItemExpiry(parsed.fullDate);
        setDisplayExpiry(`${parsed.mm}/${parsed.yyyy}`);
      } else {
        const formatted = formatExpiryToMMYYYY(lastExpiry);
        setItemExpiry(lastExpiry);
        setDisplayExpiry(formatted || lastExpiry);
      }
    } else {
      // If not found, keep it blank
      setItemExpiry('');
      setDisplayExpiry('');
    }

    if (autoFocusQty) {
      // Always focus the expiry input so user can review or enter the date
      setTimeout(() => {
        expiryInputRef.current?.focus();
        expiryInputRef.current?.select();
      }, 50);
    }

    // Discount & Public Price logic
    let initialDiscount = 0;
    if (lastDetails.lastItem && lastDetails.lastItem.discount !== undefined) {
      initialDiscount = lastDetails.lastItem.discount;
    } else {
      initialDiscount = prod.pharmacistMarginProfit || 0;
    }
    setItemDiscount(initialDiscount.toString());

    const parsedCostForUnit = purchaseCurrency === 'USD' ? defaultCost : Math.round(defaultCost * exchangeRate);
    const lastUnitPrice = purchaseCurrency === 'USD'
      ? (lastDetails.lastItem?.unitPriceUSD || (lastDetails.lastItem?.discount ? (lastDetails.lastItem.unitCostUSD / (1 - lastDetails.lastItem.discount / 100)) : (lastDetails.lastItem?.unitCostUSD || defaultCost)))
      : (lastDetails.lastItem?.unitPriceLBP || (lastDetails.lastItem?.discount ? Math.round(lastDetails.lastItem.unitCostLBP / (1 - lastDetails.lastItem.discount / 100)) : (lastDetails.lastItem?.unitCostLBP || Math.round(defaultCost * exchangeRate))));
    const initialUnitPrice = lastUnitPrice > 0 ? lastUnitPrice : (initialDiscount < 100 && initialDiscount > 0 ? (parsedCostForUnit / (1 - initialDiscount / 100)) : parsedCostForUnit);
    const finalUnitPrice = purchaseCurrency === 'LBP' ? Math.round(initialUnitPrice) : Number(initialUnitPrice.toFixed(2));
    setItemUnitPrice(finalUnitPrice.toString());

    // Public price formula: [unit price + (unit price * vat%)]
    const vatRate = itemVATChoice === 'setting' ? (settings.vatRates?.[prod.category] || 0) : 0;
    let derivedPublicPrice = finalUnitPrice + (finalUnitPrice * (vatRate / 100));
    if (purchaseCurrency === 'LBP') {
      derivedPublicPrice = Math.round(derivedPublicPrice);
    } else {
      derivedPublicPrice = Number(derivedPublicPrice.toFixed(2));
    }
    setItemPublicPrice(derivedPublicPrice.toString());

    if (autoFocusQty) {
      setTimeout(() => unitInputRef.current?.focus(), 50);
    }
  };

  // Comprehensive product lookup by barcode or code with fuzzy / clean matching
  const findProductByBarcode = useCallback((query: string): Product | undefined => {
    const clean = query.trim().toLowerCase();
    if (!clean) return undefined;

    // 1. Direct barcode match
    let found = products.find((p) => (p.barcode || '').trim().toLowerCase() === clean);
    if (found) return found;

    // 2. Direct code match
    found = products.find((p) => p.code.trim().toLowerCase() === clean);
    if (found) return found;

    // 3. Match without spaces, hyphens, or underscores
    const noDashes = clean.replace(/[\s-_]/g, '');
    if (noDashes.length >= 3) {
      found = products.find((p) => {
        const pBarcode = (p.barcode || '').trim().toLowerCase().replace(/[\s-_]/g, '');
        const pCode = p.code.trim().toLowerCase().replace(/[\s-_]/g, '');
        return pBarcode === noDashes || pCode === noDashes;
      });
      if (found) return found;
    }

    // 4. Strip leading zeros (common with UPC-A vs EAN-13 conversions)
    const noLeadingZeros = clean.replace(/^0+/, '');
    if (noLeadingZeros.length >= 4) {
      found = products.find((p) => {
        const pBarcode = (p.barcode || '').trim().toLowerCase().replace(/^0+/, '');
        const pCode = p.code.trim().toLowerCase().replace(/^0+/, '');
        return (pBarcode && pBarcode === noLeadingZeros) || (pCode && pCode === noLeadingZeros);
      });
      if (found) return found;
    }

    return undefined;
  }, [products]);

  // Barcode input scanner tracking & processing
  const barcodeLastKeyTimeRef = useRef<number>(0);
  const barcodeKeyCountRef = useRef<number>(0);
  const barcodeScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProcessBarcode = useCallback((rawInputVal?: string) => {
    if (barcodeScanTimeoutRef.current) {
      clearTimeout(barcodeScanTimeoutRef.current);
      barcodeScanTimeoutRef.current = null;
    }

    const inputEl = barcodeInputRef.current;
    const raw = (rawInputVal !== undefined ? rawInputVal : (inputEl ? inputEl.value : itemBarcode)).trim();
    if (!raw) {
      searchInputRef.current?.focus();
      return;
    }

    const match = findProductByBarcode(raw);
    if (match) {
      selectProduct(match, false);
      showFeedback('success', `Found: ${match.name} (${match.barcode || match.code})`);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    } else {
      showFeedback('error', `Barcode "${raw}" not found in stock list.`);
      if (inputEl) {
        inputEl.select();
      }
    }
  }, [findProductByBarcode, itemBarcode, selectProduct, showFeedback]);

  // Global Barcode Scanner Listener when New Purchase modal is open
  useBarcodeScanner({
    onScan: (scanned) => {
      if (!isCreateOpen) return;
      const clean = scanned.trim();
      if (!clean) return;

      const match = findProductByBarcode(clean);
      if (match) {
        selectProduct(match, false);
        showFeedback('success', `Scanned: ${match.name} (${match.barcode || match.code})`);
        setTimeout(() => unitInputRef.current?.focus(), 60);
      } else {
        showFeedback('error', `Barcode "${clean}" not found in inventory. You can search by name or code.`);
      }
    },
  });

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    const interval = now - barcodeLastKeyTimeRef.current;
    if (interval < 60) {
      barcodeKeyCountRef.current += 1;
    } else {
      barcodeKeyCountRef.current = 1;
    }
    barcodeLastKeyTimeRef.current = now;

    if (e.key === 'Enter' || e.key === 'Tab') {
      const val = (e.currentTarget.value || itemBarcode).trim();
      if (val) {
        e.preventDefault();
        e.stopPropagation();
        handleProcessBarcode(val);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
  };

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setItemBarcode(newVal);

    if (barcodeScanTimeoutRef.current) {
      clearTimeout(barcodeScanTimeoutRef.current);
    }

    const trimmed = newVal.trim();
    const isRapid = barcodeKeyCountRef.current >= 3;

    if (trimmed.length >= 4) {
      const delay = isRapid ? 80 : 350;
      barcodeScanTimeoutRef.current = setTimeout(() => {
        const match = findProductByBarcode(trimmed);
        if (match && (isRapid || trimmed === match.barcode || trimmed === match.code)) {
          handleProcessBarcode(trimmed);
        }
      }, delay);
    }
  };

  const handleBarcodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (pasted) {
      e.preventDefault();
      setItemBarcode(pasted);
      handleProcessBarcode(pasted);
    }
  };

  // Public price formula: [unit price + (unit price * vat%)]
  useEffect(() => {
    if (isPublicPriceFocused) return;
    const up = parseNumber(itemUnitPrice) || 0;
    const vatRate = itemVATChoice === 'setting' && selectedProduct ? (settings.vatRates?.[selectedProduct.category] || 0) : 0;
    let calc = up + (up * (vatRate / 100));
    if (purchaseCurrency === 'LBP') calc = Math.round(calc);
    else calc = Number(calc.toFixed(2));
    setItemPublicPrice(calc.toString());
  }, [itemUnitPrice, itemVATChoice, selectedProduct, settings, purchaseCurrency, isPublicPriceFocused]);

  useEffect(() => {
    if (isUnitPriceFocused || isDiscountFocused) {
      const unitPr = parseNumber(itemUnitPrice) || 0;
      const discount = parseFloat(itemDiscount) || 0;
      let newCost = unitPr - (unitPr * (discount / 100));
      if (purchaseCurrency === 'LBP') newCost = Math.round(newCost);
      else newCost = Number(newCost.toFixed(2));
      setItemCostUSD(newCost.toString());
    }
  }, [itemUnitPrice, itemDiscount, isUnitPriceFocused, isDiscountFocused, purchaseCurrency]);

  useEffect(() => {
    if (!isTotalFocused) {
      const qty = parseInt(itemQty, 10) || 0;
      const cost = parseNumber(itemCostUSD) || 0;
      let calculated = qty * cost;
      if (purchaseCurrency !== 'USD') {
        calculated = Math.round(calculated);
      } else {
        calculated = Number(calculated.toFixed(2));
      }
      setItemTotalInput(calculated.toString());
    }
  }, [itemCostUSD, itemQty, isTotalFocused, purchaseCurrency]);

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputType = (e.nativeEvent as InputEvent)?.inputType;
    const isDelete = inputType
      ? inputType.startsWith('delete')
      : e.target.value.length < displayExpiry.length;
    const formatted = formatExpiryInput(e.target.value, displayExpiry, isDelete);
    setDisplayExpiry(formatted);
    const parsed = parseExpiryDate(formatted);
    if (parsed) {
      setItemExpiry(parsed.fullDate);
    } else if (!formatted.trim()) {
      setItemExpiry('');
    }
  };

  const handleExpiryBlur = () => {
    const input = displayExpiry.trim();
    if (!input) {
      setItemExpiry('');
      return;
    }

    const parsed = parseExpiryDate(input);
    if (parsed) {
      setDisplayExpiry(`${parsed.mm}/${parsed.yyyy}`);
      setItemExpiry(parsed.fullDate);
    }
  };

  // Filter products by query: name, code, barcode, ingredients, or agent
  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) {
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);
      const supplierName = supplier?.name.toLowerCase() || '';
      return [...products]
        .sort((a, b) => {
          const aMatchesSupplier =
            supplierName && (a.agent || '').toLowerCase().includes(supplierName) ? -1 : 1;
          const bMatchesSupplier =
            supplierName && (b.agent || '').toLowerCase().includes(supplierName) ? -1 : 1;
          return aMatchesSupplier - bMatchesSupplier;
        })
        .slice(0, 30);
    }

    return filterProductsByMultiWordQuery(products, q, 'all').slice(0, 50);
  }, [products, productSearchQuery, selectedSupplierId, suppliers]);

  // Auto-scroll highlighted item into view within the dropdown so it is 100% visible at all times
  useEffect(() => {
    if (!isSearchDropdownOpen) return;
    const activeEl = itemRefs.current[highlightedIndex];
    const container = listContainerRef.current;
    if (!activeEl || !container) return;

    const activeTop = activeEl.offsetTop;
    const activeHeight = activeEl.offsetHeight;
    const activeBottom = activeTop + activeHeight;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const containerScrollBottom = containerScrollTop + containerHeight;

    if (activeTop < containerScrollTop) {
      // Scrolled above visible viewport: align with top plus comfortable cushion
      container.scrollTo({
        top: Math.max(0, activeTop - 6),
        behavior: 'auto',
      });
    } else if (activeBottom > containerScrollBottom) {
      // Scrolled below visible viewport: align with bottom plus comfortable cushion
      container.scrollTo({
        top: activeBottom - containerHeight + 8,
        behavior: 'auto',
      });
    }
  }, [highlightedIndex, isSearchDropdownOpen]);

  // Reset highlight index to 0 when search query or supplier changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [productSearchQuery, selectedSupplierId]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchDropdownOpen) {
        setIsSearchDropdownOpen(true);
        setHighlightedIndex(0);
      } else if (filteredProducts.length > 0) {
        setHighlightedIndex((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSearchDropdownOpen) {
        setIsSearchDropdownOpen(true);
        setHighlightedIndex(filteredProducts.length > 0 ? filteredProducts.length - 1 : 0);
      } else if (filteredProducts.length > 0) {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredProducts.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      const q = productSearchQuery.trim().toLowerCase();
      
      // If product is already selected and they press enter, just move to unit
      if (currentProductId) {
        const prod = products.find(p => p.id === currentProductId);
        if (prod && productSearchQuery.startsWith(prod.name)) {
          unitInputRef.current?.focus();
          return;
        }
      }

      // If nothing is typed, just open the dropdown and do not auto-select
      if (!q) {
        setIsSearchDropdownOpen(true);
        return;
      }

      // 1. Exact barcode or code match takes priority if user typed or scanned
      const exactMatch = products.find(
        (p) =>
          (p.barcode || '').toLowerCase() === q ||
          p.code.toLowerCase() === q
      );

      if (exactMatch) {
        selectProduct(exactMatch, true);
        setScanStatusMessage({
          type: 'success',
          text: `Found: ${exactMatch.name} (${exactMatch.barcode || exactMatch.code})`,
        });
        setTimeout(() => setScanStatusMessage(null), 3000);
        return;
      }

      // 2. Select highlighted item from dropdown list
      // BUT ONLY IF the dropdown was already open and user is explicitly highlighting something.
      // If they just typed "a" and pressed enter, we should open the dropdown so they can see the list.
      if (filteredProducts.length > 0 && isSearchDropdownOpen) {
        const safeIndex =
          highlightedIndex >= 0 && highlightedIndex < filteredProducts.length
            ? highlightedIndex
            : 0;
        const targetProduct = filteredProducts[safeIndex];
        if (targetProduct) {
          selectProduct(targetProduct, true);
          setScanStatusMessage({
            type: 'success',
            text: `Selected: ${targetProduct.name} (${targetProduct.code})`,
          });
          setTimeout(() => setScanStatusMessage(null), 2500);
          return;
        }
      } else {
         // Open dropdown if it wasn't open so user can pick
         setIsSearchDropdownOpen(true);
         return;
      }

      // 3. Fallback message if no match found
      if (q) {
        setScanStatusMessage({
          type: 'error',
          text: `No item matches "${productSearchQuery.trim()}". Try another name, code, or barcode.`,
        });
        setTimeout(() => setScanStatusMessage(null), 3500);
      }
    } else if (e.key === 'Escape') {
      setIsSearchDropdownOpen(false);
    }
  };

  
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    code: 80,
    barcode: 100,
    name: 200,
    unit: 70,
    qty: 70,
    free: 70,
    batch: 80,
    expiry: 80,
    unitPrice: 80,
    discount: 70,
    cost: 80,
    vat: 70,
    pubPrice: 80,
    profit: 70,
    total: 90,
    action: 60,
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

  const handleAddItemToInvoice = () => {
    if (!selectedProduct) {
      setScanStatusMessage({
        type: 'error',
        text: 'Please select or scan an item first.',
      });
      searchInputRef.current?.focus();
      return;
    }
    const parsedQty = parseInt(itemQty, 10);
    const qty = isNaN(parsedQty) ? 0 : parsedQty;
    const parsedFree = parseInt(itemFree, 10);
    const free = isNaN(parsedFree) ? 0 : parsedFree;
    const parsedCost = parseNumber(itemCostUSD);
    const parsedDiscount = parseFloat(itemDiscount) || 0;
    const parsedUnitPrice = parseNumber(itemUnitPrice) || 0;
    const parsedPublicPrice = parseNumber(itemPublicPrice) || 0;
    
    let costUSD = 0;
    let costLBP = 0;
    let unitPriceUSD = 0;
    let unitPriceLBP = 0;
    let publicPriceUSD = 0;
    let publicPriceLBP = 0;
    
    if (purchaseCurrency === 'USD') {
      costUSD = isNaN(parsedCost) ? (selectedProduct.costPriceUSD || 0) : parsedCost;
      costLBP = Math.round(costUSD * exchangeRate);
      unitPriceUSD = parsedUnitPrice;
      unitPriceLBP = Math.round(parsedUnitPrice * exchangeRate);
      publicPriceUSD = parsedPublicPrice;
      publicPriceLBP = Math.round(parsedPublicPrice * exchangeRate);
    } else {
      costLBP = isNaN(parsedCost) ? Math.round((selectedProduct.costPriceUSD || 0) * exchangeRate) : parsedCost;
      costUSD = costLBP / exchangeRate;
      unitPriceLBP = parsedUnitPrice;
      unitPriceUSD = parsedUnitPrice / exchangeRate;
      publicPriceLBP = parsedPublicPrice;
      publicPriceUSD = parsedPublicPrice / exchangeRate;
    }

    let finalExpiry = itemExpiry;
    if (displayExpiry.trim()) {
      const parsed = parseExpiryDate(displayExpiry);
      if (parsed) {
        finalExpiry = parsed.fullDate;
      } else if (!finalExpiry) {
        finalExpiry = displayExpiry.trim();
      }
    }

    setItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        productName: selectedProduct.name,
        quantity: qty,
        freeQty: free,
        unitPriceUSD,
        unitPriceLBP,
        unitCostUSD: costUSD,
        unitCostLBP: costLBP,
        sellingPriceLBP: publicPriceLBP,
        sellingPriceUSD: publicPriceUSD,
        discount: parsedDiscount,
        batchNumber: itemBatch || selectedProduct.batchNumber || '',
        expiryDate: finalExpiry || '',
        isPiece: itemUnit === 'piece',
      },
    ]);

    // Reset current item inputs & search query for fast next entry
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('0');
    setItemCode('');
    setItemBarcode('');
    setItemFree('0');
    setItemProfitPercent('0');
    setItemVATChoice('setting');
    setItemCostUSD('0');
    setItemTotalInput('0');
    setItemDiscount('0');
    setItemUnitPrice('0');
    setItemPublicPrice('0');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setItemUnit('box');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);

    setTimeout(() => {
      codeInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number) => {
    const item = items[index];
    const match = products.find(p => p.id === item.productId);
    const vatRate = match ? (settings.vatRates?.[match.category] || 0) : 0;
    const unitCost = purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP;
    const unitPrice = purchaseCurrency === 'USD' 
      ? (item.unitPriceUSD ?? item.sellingPriceUSD ?? item.unitCostUSD) 
      : (item.unitPriceLBP ?? item.sellingPriceLBP ?? item.unitCostLBP);
    const pubPrice = purchaseCurrency === 'USD' ? (item.sellingPriceUSD || 0) : item.sellingPriceLBP;
    const total = unitCost * item.quantity;
    const totalQty = item.quantity + (item.freeQty || 0);
    
    const profitPerc = (pubPrice > 0 && totalQty > 0) 
      ? (100 - ((((unitCost * item.quantity) / totalQty) * 100) / pubPrice)).toFixed(2)
      : '0.00';

    setEditingRowIndex(index);
    setEditRowData({
      code: item.productCode,
      barcode: match?.barcode || '',
      name: item.productName,
      unit: item.isPiece ? 'piece' : 'box',
      qty: item.quantity.toString(),
      free: (item.freeQty || 0).toString(),
      cost: unitCost.toString(),
      unitPrice: unitPrice.toString(),
      pubPrice: pubPrice.toString(),
      discount: (item.discount || 0).toString(),
      batch: item.batchNumber || '',
      expiry: item.expiryDate || '',
      displayExpiry: formatExpiryToMMYYYY(item.expiryDate) || item.expiryDate || '',
      vat: vatRate.toString(),
      profit: profitPerc.toString(),
      total: total.toString()
    });
  };

  const handleSaveEditRow = () => {
    if (editingRowIndex === null || !editRowData) return;
    const item = items[editingRowIndex];
    const match = products.find(p => p.id === item.productId);
    if (!match) return;

    const parsedQty = parseInt(editRowData.qty, 10);
    const qty = isNaN(parsedQty) ? 0 : parsedQty;
    const parsedFree = parseInt(editRowData.free, 10);
    const freeQty = isNaN(parsedFree) ? 0 : parsedFree;
    const parsedCost = parseNumber(editRowData.cost);
    const parsedDiscount = parseFloat(editRowData.discount) || 0;
    const parsedUnitPrice = parseNumber(editRowData.unitPrice) || 0;
    const parsedPublicPrice = parseNumber(editRowData.pubPrice) || 0;
    
    let costUSD = 0;
    let costLBP = 0;
    let unitPriceUSD = 0;
    let unitPriceLBP = 0;
    let publicPriceUSD = 0;
    let publicPriceLBP = 0;
    
    if (purchaseCurrency === 'USD') {
      costUSD = isNaN(parsedCost) ? (match.costPriceUSD || 0) : parsedCost;
      costLBP = Math.round(costUSD * exchangeRate);
      unitPriceUSD = parsedUnitPrice;
      unitPriceLBP = Math.round(parsedUnitPrice * exchangeRate);
      publicPriceUSD = parsedPublicPrice;
      publicPriceLBP = Math.round(parsedPublicPrice * exchangeRate);
    } else {
      costLBP = isNaN(parsedCost) ? Math.round((match.costPriceUSD || 0) * exchangeRate) : parsedCost;
      costUSD = costLBP / exchangeRate;
      unitPriceLBP = parsedUnitPrice;
      unitPriceUSD = parsedUnitPrice / exchangeRate;
      publicPriceLBP = parsedPublicPrice;
      publicPriceUSD = parsedPublicPrice / exchangeRate;
    }

    let finalExpiry = editRowData.expiry;
    if (editRowData.displayExpiry.trim()) {
      const parsed = parseExpiryDate(editRowData.displayExpiry);
      if (parsed) {
        finalExpiry = parsed.fullDate;
      } else if (!finalExpiry) {
        finalExpiry = editRowData.displayExpiry.trim();
      }
    }

    setItems((prev) => {
      const updated = [...prev];
      updated[editingRowIndex] = {
        ...updated[editingRowIndex],
        productCode: editRowData.code,
        productName: editRowData.name,
        quantity: qty,
        freeQty: freeQty,
        isPiece: editRowData.unit === 'piece',
        unitPriceUSD,
        unitPriceLBP,
        unitCostUSD: costUSD,
        unitCostLBP: costLBP,
        sellingPriceLBP: publicPriceLBP,
        sellingPriceUSD: publicPriceUSD,
        discount: parsedDiscount,
        batchNumber: editRowData.batch || match.batchNumber || '',
        expiryDate: finalExpiry || ''
      };
      return updated;
    });

    setEditingRowIndex(null);
    setEditRowData(null);
  };



    const subtotalUSD = items.reduce((sum, item) => sum + item.unitCostUSD * item.quantity, 0);
  const subtotalLBP = Math.round(subtotalUSD * exchangeRate);
  const activeSubtotal = purchaseCurrency === 'USD' ? subtotalUSD : subtotalLBP;
  
  const totalVatLBP = Math.round(items.reduce((sum, item) => {
    const costLBP = item.unitCostLBP * item.quantity;
    const match = products.find(p => p.id === item.productId);
    const vRate = item.vatRate !== undefined ? item.vatRate : (match ? (settings.vatRates?.[match.category] || 0) : 0);
    return sum + (costLBP * (vRate / 100));
  }, 0));

  const parsedInvoiceDiscountPerc = parseFloat(invoiceDiscount) || 0;
  const parsedInvoiceDiscountAmt = parseNumber(invoiceDiscountAmount) || 0;
  
  let totalCostUSD = 0;
  let totalCostLBP = 0;

  let calculatedTotalUSD = 0;
  let calculatedTotalLBP = 0;

  if (purchaseCurrency === 'USD') {
    const discountAmountUSD = (subtotalUSD * (parsedInvoiceDiscountPerc / 100)) + parsedInvoiceDiscountAmt;
    const subAfterDiscountUSD = Math.max(0, subtotalUSD - discountAmountUSD);
    const vatInUSD = totalVatLBP / exchangeRate;
    calculatedTotalUSD = subAfterDiscountUSD + vatInUSD;
    calculatedTotalLBP = Math.round(calculatedTotalUSD * exchangeRate);
  } else {
    const discountAmountLBP = (subtotalLBP * (parsedInvoiceDiscountPerc / 100)) + parsedInvoiceDiscountAmt;
    const subAfterDiscountLBP = Math.max(0, subtotalLBP - discountAmountLBP);
    calculatedTotalLBP = Math.round(subAfterDiscountLBP + totalVatLBP);
    calculatedTotalUSD = calculatedTotalLBP / exchangeRate;
  }

  if (manualTotal !== '') {
    const parsedManual = parseNumber(manualTotal) || 0;
    if (purchaseCurrency === 'USD') {
      totalCostUSD = parsedManual;
      totalCostLBP = Math.round(parsedManual * exchangeRate);
    } else {
      totalCostLBP = parsedManual;
      totalCostUSD = parsedManual / exchangeRate;
    }
  } else {
    totalCostUSD = calculatedTotalUSD;
    totalCostLBP = calculatedTotalLBP;
  }

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    let createdPurchase: PurchaseInvoice | undefined;

    if (editingPurchaseId) {
      updatePurchase(editingPurchaseId, {
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'General Supplier',
        date: invoiceDate,
        items,
        totalCostUSD,
        totalCostLBP,
        paid: isPaid,
        currency: purchaseCurrency,
        invoiceDiscount: parsedInvoiceDiscountPerc,
        invoiceDiscountAmount: parsedInvoiceDiscountAmt,
        ...(invoiceNumberInput.trim() ? { invoiceNumber: invoiceNumberInput.trim() } : {}),
      });

      if (isPaid && paymentReceiptNumber.trim()) {
        const existingPayment = supplierPayments.find(p => p.invoices && p.invoices.includes(editingPurchaseId));
        if (existingPayment) {
          updateSupplierPayment(existingPayment.id, {
            receiptNumber: paymentReceiptNumber.trim(),
            date: invoiceDate,
            amount: purchaseCurrency === 'USD' ? totalCostUSD : totalCostLBP,
            currency: purchaseCurrency,
            supplierId: selectedSupplierId,
            supplierName: supplier?.name || 'General Supplier',
          });
        } else {
          recordSupplierPayment({
            receiptNumber: paymentReceiptNumber.trim(),
            date: invoiceDate,
            supplierId: selectedSupplierId,
            supplierName: supplier?.name || 'General Supplier',
            amount: purchaseCurrency === 'USD' ? totalCostUSD : totalCostLBP,
            currency: purchaseCurrency,
            invoices: [editingPurchaseId],
            isPaymentOnAccount: false,
          });
        }
      }
    } else {
      const shouldAutoRecordPayment = isPaid && paymentReceiptNumber.trim().length > 0;

      createdPurchase = recordPurchase({
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'General Supplier',
        date: invoiceDate,
        items,
        totalCostUSD,
        totalCostLBP,
        exchangeRate,
        status: 'received',
        paid: shouldAutoRecordPayment ? false : isPaid,
        currency: purchaseCurrency,
        ...(invoiceNumberInput.trim() ? { invoiceNumber: invoiceNumberInput.trim() } : {}),
      });

      if (shouldAutoRecordPayment && createdPurchase) {
        recordSupplierPayment({
          receiptNumber: paymentReceiptNumber.trim(),
          date: invoiceDate,
          supplierId: selectedSupplierId,
          supplierName: supplier?.name || 'General Supplier',
          amount: purchaseCurrency === 'USD' ? totalCostUSD : totalCostLBP,
          currency: purchaseCurrency,
          invoices: [createdPurchase.id],
          isPaymentOnAccount: false,
        });
      }
    }

    // Synchronize all batch expiries across products from historical and new purchases
    const allPurchasesNow = editingPurchaseId
      ? purchases.map(p => (p.id === editingPurchaseId ? { ...p, items } : p))
      : (createdPurchase ? [createdPurchase, ...purchases] : purchases);

    const affectedProductIds = Array.from(new Set(items.map(it => it.productId).filter(Boolean)));
    for (const pid of affectedProductIds) {
      const prod = products.find(p => p.id === pid);
      if (prod) {
        const addedQty = !editingPurchaseId
          ? items.filter(it => it.productId === pid).reduce((acc, it) => acc + (it.isPiece && prod.piecesPerBox ? it.quantity / prod.piecesPerBox : it.quantity), 0)
          : 0;
        const prodForResolution = addedQty > 0 ? { ...prod, stockQuantity: prod.stockQuantity + addedQty } : prod;
        const resolved = resolveProductBatches(prodForResolution, allPurchasesNow);
        if (resolved.length > 0) {
          const activeFirst = resolved.find(b => (b.quantity || 0) > 0) || resolved[0];
          updateProduct(prod.id, {
            expiryDate: activeFirst.expiryDate || prod.expiryDate,
            batchNumber: activeFirst.batchNumber || prod.batchNumber,
            batches: resolved.map(b => ({
              batchNumber: b.batchNumber,
              expiryDate: b.expiryDate,
              quantity: b.quantity
            }))
          });
        }
      }
    }

    setItems([]);
    setEditingPurchaseId(null);
    setPaymentReceiptNumber('');
    setIsCreateOpen(false);
  };

  const handleOpenCreate = () => {
    restoreWindow('purchase-invoice-window');
    restoreWindow('new_purchase_invoice');
    restoreWindow('edit_purchase_invoice');
    restoreWindow('view_purchase_invoice');
    restoreWindow('Receive Supplier Shipment');
    restoreWindow('purchase invoice');
    restoreSectionWindows('purchase');

    // If already open in create mode (e.g. was minimized), just restore and focus without clearing draft
    if (isCreateOpen && !isViewMode && !editingPurchaseId) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return;
    }

    setIsViewMode(false);
    setIsCreateOpen(true);
    setEditingPurchaseId(null);
    setSelectedSupplierId('');
    setSupplierSearchQuery('');
    setItems([]);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setIsPaid(true);
    setPaymentReceiptNumber('');
    setPurchaseCurrency('LBP');
    setInvoiceDiscount('0');
    setInvoiceDiscountAmount('0');
    setManualTotal('');
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('0');
    setItemCode('');
    setItemBarcode('');
    setItemVATChoice('setting');
    setItemCostUSD('0');
    setItemTotalInput('0');
    setItemDiscount('0');
    setItemPublicPrice('0');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleViewPurchase = (inv: PurchaseInvoice) => {
    restoreWindow('purchase-invoice-window');
    restoreWindow('view_purchase_invoice');
    restoreWindow('edit_purchase_invoice');
    restoreWindow('new_purchase_invoice');
    restoreWindow('Receive Supplier Shipment');
    restoreWindow('purchase invoice');
    restoreSectionWindows('purchase');
    setIsViewMode(true);
    setEditingPurchaseId(inv.id);
    setEditingRowIndex(null);
    setSelectedSupplierId(inv.supplierId);
    setInvoiceDate(inv.date);
    setInvoiceNumberInput(inv.invoiceNumber || '');
    setIsPaid(inv.paid);
    const existingPayment = supplierPayments.find(p => p.invoices && p.invoices.includes(inv.id));
    setPaymentReceiptNumber(existingPayment?.receiptNumber || '');
    setPurchaseCurrency(inv.currency || 'LBP');
    setItems(inv.items || []);
    setInvoiceDiscount((inv.invoiceDiscount || 0).toString());
    setInvoiceDiscountAmount((inv.invoiceDiscountAmount || 0).toString());
    setManualTotal(inv.totalOverride?.toString() || '');
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemBarcode('');
    setIsCreateOpen(true);
  };

  const handleEditPurchase = (inv: PurchaseInvoice) => {
    restoreWindow('purchase-invoice-window');
    restoreWindow('edit_purchase_invoice');
    restoreWindow('new_purchase_invoice');
    restoreWindow('view_purchase_invoice');
    restoreWindow('Receive Supplier Shipment');
    restoreWindow('purchase invoice');
    restoreSectionWindows('purchase');
    setIsViewMode(false);
    setEditingPurchaseId(inv.id);
    setSelectedSupplierId(inv.supplierId);
    setInvoiceDate(inv.date);
    setInvoiceNumberInput(inv.invoiceNumber || '');
    setIsPaid(inv.paid);
    const existingPayment = supplierPayments.find(p => p.invoices && p.invoices.includes(inv.id));
    setPaymentReceiptNumber(existingPayment?.receiptNumber || '');
    setPurchaseCurrency(inv.currency || 'LBP');
    setItems(inv.items || []);
    setInvoiceDiscount((inv.invoiceDiscount || 0).toString());
    setInvoiceDiscountAmount((inv.invoiceDiscountAmount || 0).toString());
    setManualTotal('');
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('0');
    setItemCode('');
    setItemBarcode('');
    setItemVATChoice('setting');
    setItemCostUSD('0');
    setItemTotalInput('0');
    setItemDiscount('0');
    setItemPublicPrice('0');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);
    setIsCreateOpen(true);
  };

  const handleDeletePurchase = (id: string) => {
    setPurchaseToDelete(id);
  };

  const calculateProfitPerc = (pubPrice: number, cost: number, qty: number, free: number) => {
    const totalQty = qty + free;
    return (pubPrice > 0 && totalQty > 0) ? (100 - ((((cost * qty) / totalQty) * 100) / pubPrice)).toFixed(2) : '0.00';
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 p-3.5 space-y-3 select-none">
      {/* Header Bar */}
      <div className="flex flex-col gap-2.5 rounded border border-gray-200 bg-white px-3 pt-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <SectionRestoreButton section="purchase" />
              <Truck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                Purchases & Supplier Invoices
              </h2>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Restock inventory from Lebanese agents (Mersaco, Omnipharma, Fattal) & track shipment arrivals.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'invoices' && (
              <button
                onClick={handleOpenCreate}
                className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Purchase Invoice</span>
              </button>
            )}
            {activeTab === 'payments' && (
              <button
                onClick={() => openSupplierPaymentModal(selectedPaymentSupplierId !== 'ALL' ? selectedPaymentSupplierId : undefined)}
                className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Payment</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-1 -mx-3 px-3">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'invoices'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'payments'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Payments
            </button>
          </div>
          <div className="relative mb-1 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder="Search number or supplier..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 w-48 sm:w-64"
            />
          </div>
        </div>
      </div>

      {activeTab === 'payments' ? (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
          {/* Supplier Filter */}
          <div className="flex items-center gap-2 rounded border border-gray-200 bg-white p-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900 shrink-0">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Filter by Supplier:</label>
            <select
              value={selectedPaymentSupplierId}
              onChange={(e) => setSelectedPaymentSupplierId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 flex-1 max-w-sm font-medium"
            >
              <option value="ALL">-- All Suppliers --</option>
              {sortedSuppliersForPayment.map(s => {
                const hasUsd = (s.balanceUSD || 0) >= 0.01;
                const hasLbp = (s.balanceLBP || 0) >= 1;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} {hasUsd || hasLbp ? `(Bal: ${hasUsd ? '$' + formatNumber(s.balanceUSD) : ''}${hasUsd && hasLbp ? ' | ' : ''}${hasLbp ? formatNumber(s.balanceLBP) + ' LBP' : ''})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden min-h-0">
            {/* Left Column: Balances or Invoices */}
            <div className="flex-1 flex flex-col overflow-y-auto rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                 <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                   {selectedPaymentSupplierId === 'ALL' ? 'Supplier Balances' : 'Supplier Invoices (Purchases)'}
                 </h3>
                 {selectedPaymentSupplierId !== 'ALL' ? (
                   <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                     Total Invoices: {supplierInvoicesForView.length}
                   </span>
                 ) : (
                   <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                     {suppliersForBalances.length} active with debt
                   </span>
                 )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedPaymentSupplierId === 'ALL' ? (
                  <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3 text-right">Debt (USD)</th>
                        <th className="px-4 py-3 text-right">Debt (LBP)</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {suppliersForBalances.map((sup) => (
                        <tr key={sup.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 font-semibold">
                            <div>{sup.name}</div>
                            {sup.code && !sup.code.toUpperCase().startsWith('MOPH-') && (
                              <span className="text-[10px] text-slate-400 font-mono">{sup.code}</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${(sup.balanceUSD || 0) >= 0.01 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            ${formatNumber((sup.balanceUSD || 0) >= 0.01 ? sup.balanceUSD : 0)}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${(sup.balanceLBP || 0) >= 1 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {formatLBPValue((sup.balanceLBP || 0) >= 1 ? sup.balanceLBP : 0)} LBP
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => openSupplierPaymentModal(sup.id)}
                              className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700 border border-teal-200 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 transition-colors cursor-pointer"
                            >
                              <DollarSign className="h-3 w-3" />
                              Pay
                            </button>
                          </td>
                        </tr>
                      ))}
                      {suppliersForBalances.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                            No outstanding balances.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3 text-center">Currency</th>
                        <th className="px-4 py-3 text-right">Total (USD)</th>
                        <th className="px-4 py-3 text-right">Total (LBP)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {supplierInvoicesForView.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                            No purchase transactions found for this supplier.
                          </td>
                        </tr>
                      ) : (
                        supplierInvoicesForView.map((p) => {
                          const isLBP = p.currency === 'LBP';
                          return (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-3 text-gray-500">{p.date}</td>
                              <td className="px-4 py-3 font-semibold">{p.invoiceNumber}</td>
                              <td className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {isLBP ? 'LBP' : 'USD ($)'}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <span className={!isLBP ? 'text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 inline-block whitespace-nowrap' : 'text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap'}>
                                  ${formatNumber(p.totalCostUSD)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <span className={isLBP ? 'text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 inline-block whitespace-nowrap' : 'text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap'}>
                                  {formatLBPValue(p.totalCostLBP)}&nbsp;LBP
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  p.paid 
                                    ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300' 
                                    : (p.paidAmountUSD || 0) > 0 || (p.paidAmountLBP || 0) > 0 
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300' 
                                      : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {p.paid ? 'Settled' : (p.paidAmountUSD || 0) > 0 || (p.paidAmountLBP || 0) > 0 ? 'Partial' : 'Unpaid'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            
            {/* Right Column: Recent Payments */}
            <div className="flex-1 flex flex-col overflow-y-auto rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                 <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Recent Payments</h3>
                 <button
                   onClick={() => openSupplierPaymentModal(selectedPaymentSupplierId !== 'ALL' ? selectedPaymentSupplierId : undefined)}
                   className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700 border border-teal-200 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 transition-colors cursor-pointer"
                 >
                   <DollarSign className="h-3 w-3" />
                   New Payment
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Receipt #</th>
                      {selectedPaymentSupplierId === 'ALL' && <th className="px-4 py-3">Supplier</th>}
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {paymentsForView.length === 0 ? (
                      <tr>
                        <td colSpan={selectedPaymentSupplierId === 'ALL' ? 5 : 4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      paymentsForView.map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-gray-500">
                            {payment.date}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                            {payment.receiptNumber || (payment.id.startsWith('RCT-') ? payment.id : payment.id.split('-')[0])}
                          </td>
                          {selectedPaymentSupplierId === 'ALL' && (
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{payment.supplierName}</td>
                          )}
                          <td className="px-4 py-3 text-right font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                            {payment.currency === 'MIXED'
                              ? `$${formatNumber(payment.amountUSD || 0)} + ${formatLBPValue(payment.amountLBP || 0)} LBP`
                              : payment.currency === 'USD' ? `$${formatNumber(payment.amount)}` : `${formatLBPValue(payment.amount)} LBP`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openSupplierPaymentModal(payment.supplierId, payment)}
                                className="p-1 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                                title="Edit Payment"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setPaymentToDelete(payment.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                title="Delete Payment"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <> {/* Invoices Table */}
      <div className="flex-1 overflow-hidden rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="py-2 px-3">ID</th>
                <th className="py-2 px-3">Invoice #</th>
                <th className="py-2 px-3 text-center">Currency</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Supplier</th>
                <th className="py-2 px-3">Items Received</th>
                <th className="py-2 px-3">Total USD ($)</th>
                <th className="py-2 px-3">Total LBP</th>
                <th className="py-2 px-3">Amount Left</th>
                <th className="py-2 px-3">Payment Status</th>
                <th className="py-2 px-3">Receipt #</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-gray-400">
                    No purchase invoices registered yet.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((inv) => (
                  <tr 
                    key={inv.id} 
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => handleViewPurchase(inv)}
                  >
                    <td className="py-2 px-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                      {inv.id.replace('pur-', '')}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2 px-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {inv.currency === 'LBP' ? 'LBP' : 'USD ($)'}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-slate-300">
                      {formatInvoiceDate(inv.date)}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {inv.supplierName}
                    </td>
                    <td className="py-2 px-3">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                        {(inv.items || []).reduce((s, i) => s + i.quantity, 0)} units ({(inv.items || []).length} items)
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold whitespace-nowrap">
                      <span className={inv.currency !== 'LBP' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 inline-block whitespace-nowrap' : 'text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap'}>
                        ${inv.totalCostUSD.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={inv.currency === 'LBP' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 inline-block whitespace-nowrap' : 'text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap'}>
                        {formatLBPValue(inv.totalCostLBP)}&nbsp;LBP
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-300">
                      {(() => {
                        const amountLeftUSD = inv.paid ? 0 : (inv.totalCostUSD - (inv.paidAmountUSD || 0) - ((inv.paidAmountLBP || 0) / (inv.exchangeRate || 1)));
                        const amountLeftLBP = inv.paid ? 0 : (inv.totalCostLBP - (inv.paidAmountLBP || 0) - ((inv.paidAmountUSD || 0) * (inv.exchangeRate || 1)));
                        return inv.currency === 'USD' 
                          ? `$${formatNumber(Math.max(0, amountLeftUSD))}` 
                          : `${formatLBPValue(Math.max(0, amountLeftLBP))} LBP`;
                      })()}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          inv.paid
                            ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {inv.paid ? 'Settled (Paid)' : 'Pending Debt'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={supplierPayments.filter(p => p.invoices && p.invoices.includes(inv.id)).map(p => p.receiptNumber).join(', ')}>
                      {supplierPayments.filter(p => p.invoices && p.invoices.includes(inv.id)).map(p => p.receiptNumber).join(', ') || '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditPurchase(inv); }}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/30 rounded"
                          title="Edit Purchase"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePurchase(inv.id); }}
                          className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 rounded"
                          title="Delete Purchase"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      

      </>
      )}

      {/* New Purchase Modal */}
      {isCreateOpen && (
        <DesktopWindow
          id="purchase-invoice-window"
          title={isViewMode ? `View Purchase (ID: ${editingPurchaseId?.replace('pur-', '')})` : editingPurchaseId ? `Edit Purchase (ID: ${editingPurchaseId.replace('pur-', '')})` : "Receive Supplier Shipment (Restock Inventory)"}
          isOpen={true}
          section="purchase"
          startMaximized={true}
          hideResetButton={true}
          hideMaximizeButton={true}
          onClose={() => {
            if (!isViewMode && items.length > 0) {
              setShowCloseConfirm(true);
            } else {
              setIsCreateOpen(false);
            }
          }}
          width="700px"
          height="auto"
        >
          <form 
            onSubmit={handleSavePurchase} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
              if (e.key === 'Escape') {
                if (isSupplierDropdownOpen) {
                  setIsSupplierDropdownOpen(false);
                  e.preventDefault();
                  e.stopPropagation();
                } else if (isSearchDropdownOpen) {
                  setIsSearchDropdownOpen(false);
                  e.preventDefault();
                  e.stopPropagation();
                } else {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox' && (target as HTMLInputElement).type !== 'radio') {
                    const inputElement = target as HTMLInputElement;
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                    if (nativeInputValueSetter) {
                      nativeInputValueSetter.call(inputElement, '');
                      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }
                }
              }
            }}
            className="px-3 pt-2 pb-3 space-y-2 text-xs flex-1 flex flex-col justify-start overflow-auto min-h-0"
          >
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${isPaid ? 'lg:grid-cols-[1.8fr_1fr_0.8fr_1fr_1fr_1fr]' : 'lg:grid-cols-[2fr_1fr_1fr_1.2fr_1fr]'} gap-3`}>
              <div ref={supplierDropdownRef} className="relative">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier
                </label>
                <div className="relative">
                  <input
                    ref={supplierInputRef}
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => {
                      setSupplierSearchQuery(e.target.value);
                      setIsSupplierDropdownOpen(true);
                      setSupplierHighlightedIndex(0);
                    }}
                    onClick={() => setIsSupplierDropdownOpen(true)}
                    onKeyDown={handleSupplierKeyDown}
                    placeholder="Search supplier..."
                    disabled={isViewMode}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                  />
                  <ChevronDown className="absolute right-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                  
                {isSupplierDropdownOpen && (
                  <div 
                    ref={supplierListContainerRef}
                    className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                  >
                    {filteredSuppliers.map((s, index) => (
                        <div
                          key={s.id}
                          ref={(el) => { supplierItemRefs.current[index] = el; }}
                          className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between ${
                            supplierHighlightedIndex === index
                              ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 font-semibold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                          } ${selectedSupplierId === s.id && supplierHighlightedIndex !== index ? 'font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedSupplierId(s.id);
                            setSupplierSearchQuery(s.name);
                            setIsSupplierDropdownOpen(false);
                          }}
                        >
                          <span>{s.name}</span>
                          {!s.code.toUpperCase().startsWith('MOPH-') && (
                            <span className="text-[10px] text-slate-400 font-mono">{s.code}</span>
                          )}
                        </div>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <div className="px-3 py-4 text-center text-slate-400 text-xs">No suppliers found</div>
                    )}
                  </div>
                )}
                {/* Fallback to keep the value in DOM */}
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Date
                </label>
                <input
                  ref={invoiceDateRef}
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      currencyRef.current?.focus();
                    }
                  }}
                  required
                  disabled={isViewMode}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  ref={currencyRef}
                  value={purchaseCurrency}
                  onChange={(e) => {
                    const newCurrency = e.target.value as 'USD' | 'LBP';
                    setPurchaseCurrency(newCurrency);
                    // Update input if a product is selected
                    if (selectedProduct) {
                      const defaultCost = selectedProduct.costPriceUSD != null ? selectedProduct.costPriceUSD : 0;
                      setItemCostUSD(newCurrency === 'USD' ? defaultCost.toString() : Math.round(defaultCost * exchangeRate).toString());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      paymentStatusRef.current?.focus();
                    }
                  }}
                  disabled={isViewMode}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                >
                  <option value="LBP">LBP (ل.ل)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Status
                </label>
                <select
                  ref={paymentStatusRef}
                  value={isPaid ? 'paid' : 'unpaid'}
                  onChange={(e) => setIsPaid(e.target.value === 'paid')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (isPaid && receiptNumberRef.current) {
                        receiptNumberRef.current.focus();
                      } else {
                        invoiceNumberRef.current?.focus();
                      }
                    }
                  }}
                  disabled={isViewMode}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                >
                  <option value="unpaid">Unpaid / On Account</option>
                  <option value="paid">Settled (Paid)</option>
                </select>
              </div>
              {isPaid && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Number
                  </label>
                  <input
                    ref={receiptNumberRef}
                    id="input-payment-receipt-number"
                    type="text"
                    value={paymentReceiptNumber}
                    onChange={(e) => setPaymentReceiptNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        invoiceNumberRef.current?.focus();
                      }
                    }}
                    disabled={isViewMode}
                    placeholder="e.g. REC-10293"
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice #
                </label>
                <input
                  ref={invoiceNumberRef}
                  type="text"
                  value={invoiceNumberInput}
                  onChange={(e) => setInvoiceNumberInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      codeInputRef.current?.focus();
                    }
                  }}
                  disabled={isViewMode}
                  placeholder={editingPurchaseId ? '' : 'Auto-generated if empty'}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {scanStatusMessage && (
              <div
                id="scan-status-alert"
                className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 shadow-2xs ${
                  scanStatusMessage.type === 'error'
                    ? 'bg-rose-50/95 border border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200 ring-1 ring-rose-500/10'
                    : 'bg-emerald-50/95 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/10'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {scanStatusMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate">{scanStatusMessage.text}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    id="scan-status-add-stock-btn"
                    onClick={handleOpenAddStockProduct}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                      scanStatusMessage.type === 'error'
                        ? 'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 border border-rose-700/50'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 border border-emerald-700/50'
                    }`}
                    title="Open form to add new item in Stock"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add to Stock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanStatusMessage(null)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer transition-colors"
                    title="Dismiss alert"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            {/* Items Input/Import Table */}
            <div className="flex-1 w-full overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/40 shadow-sm flex flex-col">
              <div className="flex-1 w-full overflow-auto">
                
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
    <col style={{ width: colWidths.unitPrice }} />
    <col style={{ width: colWidths.discount }} />
    <col style={{ width: colWidths.cost }} />
    <col style={{ width: colWidths.vat }} />
    <col style={{ width: colWidths.pubPrice }} />
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
        { id: 'unitPrice', label: 'Unit Price' },
        { id: 'discount', label: 'Disc %' },
        { id: 'cost', label: 'Cost' },
        { id: 'vat', label: 'VAT' },
        { id: 'pubPrice', label: 'Public Price' },
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
      {!isViewMode && (
      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
        {/* Actions empty header */}
      </th>
      )}
    </tr>
  </thead>
  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it, idx) => {
                      const productDetails = products.find(p => p.id === it.productId);
                      const vatRate = it.vatRate !== undefined ? it.vatRate : (productDetails ? (settings.vatRates?.[productDetails.category] || 0) : 0);
                      
                      const unitCost = purchaseCurrency === 'USD' ? it.unitCostUSD : it.unitCostLBP;
                      const pubPrice = purchaseCurrency === 'USD' ? (it.sellingPriceUSD || 0) : it.sellingPriceLBP;
                      const total = unitCost * it.quantity;
                      const totalQty = it.quantity + (it.freeQty || 0);
                      
                      const profitPerc = (pubPrice > 0 && totalQty > 0)
                        ? (100 - ((((unitCost * it.quantity) / totalQty) * 100) / pubPrice)).toFixed(2)
                        : '0.00';

                      const isEditing = editingRowIndex === idx && editRowData;

                      return (
                        <tr key={idx} className={isEditing ? 'bg-teal-50/20 dark:bg-teal-900/10 ring-1 ring-inset ring-teal-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.code}
                                onChange={(e) => setEditRowData({ ...editRowData, code: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.productCode}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.barcode}
                                onChange={(e) => setEditRowData({ ...editRowData, barcode: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{productDetails?.barcode || ''}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.name}
                                onChange={(e) => setEditRowData({ ...editRowData, name: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <div className="px-2">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{it.productName}</span>
                                {productDetails && (
                                  <span className="ml-1.5 font-normal text-slate-500 text-[10px]">
                                    {productDetails.dosage} {productDetails.presentation} {productDetails.form}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <select
                                value={editRowData.unit}
                                onChange={(e) => setEditRowData({ ...editRowData, unit: e.target.value as 'box' | 'piece' })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-teal-500 rounded outline-none"
                              >
                                <option value="box">Box</option>
                                <option value="piece">Piece</option>
                              </select>
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.isPiece ? 'Piece' : 'Box'}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                value={editRowData.qty}
                                onChange={(e) => {
                                  const newQty = e.target.value;
                                  const q = parseInt(newQty, 10) || 0;
                                  const f = parseInt(editRowData.free, 10) || 0;
                                  const p = parseNumber(editRowData.pubPrice) || 0;
                                  const c = parseNumber(editRowData.cost) || 0;
                                  const profitPerc = calculateProfitPerc(p, c, q, f);
                                  setEditRowData({ ...editRowData, qty: newQty, total: (q * c).toFixed(2), profit: profitPerc });
                                }}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-slate-800 dark:text-slate-200">{it.quantity}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editRowData.free}
                                onChange={(e) => {
                                  const newFree = e.target.value;
                                  const f = parseInt(newFree, 10) || 0;
                                  const q = parseInt(editRowData.qty, 10) || 0;
                                  const p = parseNumber(editRowData.pubPrice) || 0;
                                  const c = parseNumber(editRowData.cost) || 0;
                                  const profitPerc = calculateProfitPerc(p, c, q, f);
                                  setEditRowData({ ...editRowData, free: newFree, profit: profitPerc });
                                }}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.freeQty || '-'}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.batch}
                                onChange={(e) => setEditRowData({ ...editRowData, batch: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.batchNumber}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <ExpiryTableInput
                                value={editRowData.displayExpiry}
                                onChange={(formatted, iso) => {
                                  setEditRowData({
                                    ...editRowData,
                                    displayExpiry: formatted,
                                    expiry: iso
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (editRowData.displayExpiry.trim()) {
                                      const parsed = parseExpiryDate(editRowData.displayExpiry);
                                      if (parsed) {
                                        setEditRowData({
                                          ...editRowData,
                                          displayExpiry: `${parsed.mm}/${parsed.yyyy}`,
                                          expiry: parsed.fullDate
                                        });
                                      }
                                    }
                                    const tr = (e.target as HTMLElement).closest('tr');
                                    const inputs = tr ? Array.from(tr.querySelectorAll('input')) : [];
                                    const currentIdx = inputs.indexOf(e.target as HTMLInputElement);
                                    if (currentIdx >= 0 && inputs[currentIdx + 1]) {
                                      inputs[currentIdx + 1].focus();
                                      inputs[currentIdx + 1].select();
                                    }
                                  }
                                }}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100 text-center font-mono placeholder:text-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300 font-mono">{formatExpiryDate(it.expiryDate)}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={formatNumber(editRowData.unitPrice)}
                                onChange={(e) => {
                                  const newUnitPrice = formatNumber(e.target.value);
                                  const up = parseNumber(newUnitPrice) || 0;
                                  const d = parseFloat(editRowData.discount) || 0;
                                  const q = parseInt(editRowData.qty, 10) || 0;
                                  const f = parseInt(editRowData.free, 10) || 0;
                                  const vat = parseFloat(editRowData.vat) || 0;

                                  let newCost = up - (up * (d / 100));
                                  if (purchaseCurrency === 'LBP') newCost = Math.round(newCost);
                                  else newCost = Number(newCost.toFixed(2));

                                  // Public price formula: [unit price + (unit price * vat%)]
                                  let newPubPrice = up + (up * (vat / 100));
                                  if (purchaseCurrency === 'LBP') newPubPrice = Math.round(newPubPrice);
                                  else newPubPrice = Number(newPubPrice.toFixed(2));

                                  const profitPerc = calculateProfitPerc(newPubPrice, newCost, q, f);
                                  setEditRowData({
                                    ...editRowData,
                                    unitPrice: newUnitPrice,
                                    cost: newCost.toString(),
                                    pubPrice: newPubPrice.toString(),
                                    total: (newCost * q).toFixed(2),
                                    profit: profitPerc
                                  });
                                }}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-slate-800 dark:text-slate-200">
                                {formatNumber(purchaseCurrency === 'USD' ? (it.unitPriceUSD ?? (it.sellingPriceUSD || it.unitCostUSD)) : (it.unitPriceLBP ?? (it.sellingPriceLBP || it.unitCostLBP)))}
                              </span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editRowData.discount}
                                onChange={(e) => setEditRowData({ ...editRowData, discount: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-teal-600 dark:text-teal-400">{it.discount || 0}%</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={formatNumber(editRowData.cost)}
                                onChange={(e) => {
                                  const newCost = formatNumber(e.target.value);
                                  const c = parseNumber(newCost) || 0;
                                  const q = parseInt(editRowData.qty, 10) || 0;
                                  const f = parseInt(editRowData.free, 10) || 0;
                                  const p = parseNumber(editRowData.pubPrice) || 0;
                                  const profitPerc = calculateProfitPerc(p, c, q, f);
                                  setEditRowData({ ...editRowData, cost: newCost, total: (c * q).toFixed(2), profit: profitPerc });
                                }}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-slate-800 dark:text-slate-200">{formatNumber(unitCost)}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  value={editRowData.vat}
                                  onChange={(e) => {
                                  const newVat = e.target.value;
                                  const v = parseFloat(newVat) || 0;
                                  const up = parseNumber(editRowData.unitPrice) || 0;
                                  const c = parseNumber(editRowData.cost) || 0;
                                  const q = parseInt(editRowData.qty, 10) || 0;
                                  const f = parseInt(editRowData.free, 10) || 0;

                                  // Public price formula: [unit price + (unit price * vat%)]
                                  let newPubPrice = up + (up * (v / 100));
                                  if (purchaseCurrency === 'LBP') newPubPrice = Math.round(newPubPrice);
                                  else newPubPrice = Number(newPubPrice.toFixed(2));

                                  const profitPerc = calculateProfitPerc(newPubPrice, c, q, f);
                                  setEditRowData({
                                    ...editRowData,
                                    vat: newVat,
                                    pubPrice: newPubPrice.toString(),
                                    profit: profitPerc
                                  });
                                }}
                                  className="w-full px-1 py-1 pr-4 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none text-right"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                              </div>
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{vatRate}%</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={formatNumber(editRowData.pubPrice)}
                                onChange={(e) => {
                                  const newPubPrice = formatNumber(e.target.value);
                                  const p = parseNumber(newPubPrice) || 0;
                                  const c = parseNumber(editRowData.cost) || 0;
                                  const q = parseInt(editRowData.qty, 10) || 0;
                                  const f = parseInt(editRowData.free, 10) || 0;
                                  const profitPerc = calculateProfitPerc(p, c, q, f);
                                  setEditRowData({ ...editRowData, pubPrice: newPubPrice, profit: profitPerc });
                                }}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-slate-800 dark:text-slate-200">{formatNumber(pubPrice)}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  value={editRowData.profit}
                                  onChange={(e) => setEditRowData({ ...editRowData, profit: e.target.value })}
                                  className="w-full px-1 py-1 pr-4 text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none text-right text-emerald-600 dark:text-emerald-400"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600/70 dark:text-emerald-400/70">%</span>
                              </div>
                            ) : (
                              <span className="px-2 font-medium text-emerald-600 dark:text-emerald-400">{profitPerc}%</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={formatNumber(editRowData.total)}
                                onChange={(e) => {
                                  const newTotal = formatNumber(e.target.value);
                                  const q = parseInt(editRowData.qty, 10) || 1;
                                  const newCost = (parseNumber(newTotal) || 0) / q;
                                  setEditRowData({ ...editRowData, total: newTotal, cost: newCost.toFixed(2) });
                                }}
                                className="w-full px-1 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none text-right"
                              />
                            ) : (
                              <span className="px-2 font-bold text-slate-800 dark:text-slate-200">{formatNumber(total)}</span>
                            )}
                          </td>
                          {!isViewMode && (
                          <td className="p-1 px-2 whitespace-nowrap text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={handleSaveEditRow}
                                  className="text-white bg-teal-600 hover:bg-teal-700 p-1 rounded shadow-sm"
                                  title="Save changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRowIndex(null);
                                    setEditRowData(null);
                                  }}
                                  className="text-slate-500 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                                  title="Cancel edit"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditItem(idx)}
                                  className="text-teal-600 hover:text-teal-800 p-1 rounded hover:bg-teal-50 dark:hover:bg-teal-900/30"
                                  title="Edit item"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                                  title="Remove item"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                          )}
                        </tr>
                      );
                    })}

                    {/* Active Input Row */}
                    {!isViewMode && (
                    <tr className="bg-teal-50/40 dark:bg-teal-900/20">
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={codeInputRef}
                          type="text"
                          value={itemCode}
                          onChange={(e) => setItemCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = itemCode.trim().toLowerCase();
                              if (val) {
                                const match = products.find(p => p.code.toLowerCase() === val);
                                if (match) {
                                  selectProduct(match, false);
                                  showFeedback('success', `Found: ${match.name}`);
                                  setTimeout(() => barcodeInputRef.current?.focus(), 50);
                                } else {
                                  showFeedback('error', `Code "${itemCode}" not found in stock list.`);
                                  e.currentTarget.select();
                                }
                              } else {
                                barcodeInputRef.current?.focus();
                              }
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="purchase-item-barcode-input"
                          ref={barcodeInputRef}
                          type="text"
                          value={itemBarcode}
                          onChange={handleBarcodeChange}
                          onKeyDown={handleBarcodeKeyDown}
                          onPaste={handleBarcodePaste}
                          placeholder="Scan barcode..."
                          title="Scan barcode with hardware scanner or enter barcode / code and press Enter or Tab"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-[11px] font-mono tracking-wider text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-teal-400 dark:hover:border-teal-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 focus:outline-hidden transition-all"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700 relative">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={productSearchQuery}
                          onChange={(e) => {
                            setProductSearchQuery(e.target.value);
                            setIsSearchDropdownOpen(true);
                          }}
                          onFocus={() => { if (productSearchQuery.trim()) setIsSearchDropdownOpen(true); }}
                          onKeyDown={handleSearchKeyDown}
                          placeholder="Search product..."
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                        {isSearchDropdownOpen && (
                          <div
                            ref={listContainerRef}
                            className="absolute left-0 top-full mt-1 w-[400px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 rounded-lg max-h-48 overflow-y-auto"
                          >
                            {filteredProducts.map((p, idx) => (
                              <div
                                key={p.id}
                                ref={(el) => { itemRefs.current[idx] = el; }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectProduct(p, false); // select without auto-add
                                }}
                                className={`px-2 py-1.5 cursor-pointer flex justify-between items-center text-[11px] ${
                                  highlightedIndex === idx
                                    ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 font-semibold'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                <span className="flex-1 overflow-hidden whitespace-nowrap text-ellipsis pr-2">
                                  <span className="font-bold">{p.name}</span>
                                  {p.dosage && <span>&nbsp;&nbsp;{p.dosage}</span>}
                                  {p.presentation && <span>&nbsp;&nbsp;{p.presentation}</span>}
                                  {p.form && <span>&nbsp;&nbsp;{p.form}</span>}
                                </span>
                                <span className="text-[10px] whitespace-nowrap shrink-0 font-medium text-teal-600 dark:text-teal-400">
                                  {formatStockBoxesAndPieces(p)}
                                </span>
                              </div>
                            ))}
                            {filteredProducts.length === 0 && (
                              <div className="px-3 py-3 text-center text-[11px] text-slate-500">No products found</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <select
                          ref={unitInputRef}
                          value={itemUnit}
                          onChange={(e) => setItemUnit(e.target.value as 'box' | 'piece')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              qtyInputRef.current?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        >
                          <option value="box">Box</option>
                          <option value="piece">Piece</option>
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={qtyInputRef}
                          type="number"
                          value={itemQty}
                          onChange={(e) => setItemQty(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              freeInputRef.current?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={freeInputRef}
                          type="number"
                          value={itemFree}
                          onChange={(e) => setItemFree(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              batchInputRef.current?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={batchInputRef}
                          type="text"
                          value={itemBatch}
                          onChange={(e) => setItemBatch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              expiryInputRef.current?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100 uppercase"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <ExpiryTableInput
                          ref={expiryInputRef}
                          value={displayExpiry}
                          onChange={(formatted, iso) => {
                            setDisplayExpiry(formatted);
                            setItemExpiry(iso);
                          }}
                          onBlur={handleExpiryBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleExpiryBlur();
                              document.getElementById('input-unit-price')?.focus();
                            }
                          }}
                          placeholder="MM/YYYY"
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100 text-center font-mono placeholder:text-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-unit-price"
                          type="text"
                          value={formatNumber(itemUnitPrice)}
                          onChange={(e) => setItemUnitPrice(formatNumber(e.target.value))}
                          onFocus={(e) => { setIsUnitPriceFocused(true); e.target.select(); }}
                          onBlur={() => setIsUnitPriceFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-discount')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-discount"
                          type="number"
                          value={itemDiscount}
                          onChange={(e) => setItemDiscount(e.target.value)}
                          onFocus={(e) => { setIsDiscountFocused(true); e.target.select(); }}
                          onBlur={() => setIsDiscountFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-cost')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-cost"
                          type="text"
                          value={formatNumber(itemCostUSD)}
                          onChange={(e) => setItemCostUSD(formatNumber(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-vat')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <select
                          id="input-vat"
                          value={itemVATChoice}
                          onChange={(e) => setItemVATChoice(e.target.value as 'setting' | 'none')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-pub-price')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        >
                          <option value="setting">{selectedProduct && settings.vatRates?.[selectedProduct.category] ? `${settings.vatRates[selectedProduct.category]}%` : '0%'}</option>
                          <option value="none">0%</option>
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-pub-price"
                          type="text"
                          value={formatNumber(itemPublicPrice)}
                          onChange={(e) => setItemPublicPrice(formatNumber(e.target.value))}
                          onFocus={(e) => { setIsPublicPriceFocused(true); e.target.select(); }}
                          onBlur={() => setIsPublicPriceFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-total')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700 align-middle">
                        <div className="px-1.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {(() => {
                            const cost = parseNumber(itemCostUSD) || 0;
                            const pubPrice = parseNumber(itemPublicPrice) || 0;
                            const qty = parseInt(itemQty, 10) || 0;
                            const free = parseInt(itemFree, 10) || 0;
                            const totalQty = qty + free;
                            
                            if (pubPrice > 0 && totalQty > 0) {
                              const profitPerc = 100 - ((((cost * qty) / totalQty) * 100) / pubPrice);
                              return profitPerc.toFixed(2) + '%';
                            }
                            return '0.00%';
                          })()}
                        </div>
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-total"
                          type="text"
                          value={formatNumber(itemTotalInput)}
                          onChange={(e) => setItemTotalInput(formatNumber(e.target.value))}
                          onFocus={(e) => { setIsTotalFocused(true); e.target.select(); }}
                          onBlur={() => setIsTotalFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddItemToInvoice();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 text-center align-middle">
                        <button
                          type="button"
                          onClick={handleAddItemToInvoice}
                          className="text-teal-600 hover:text-teal-800 dark:text-teal-400 p-1 rounded hover:bg-teal-100 dark:hover:bg-teal-900/50"
                          title="Add Item (Enter)"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-auto flex items-end justify-between w-full pt-2">
              {isViewMode && editingPurchaseId && (
                <div className="flex flex-col text-green-600 dark:text-green-400 font-bold text-xs bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800">
                  {(() => {
                    const currentInvoice = purchases.find(p => p.id === editingPurchaseId);
                    const invoicePayments = supplierPayments.filter(p => p.invoices && p.invoices.includes(editingPurchaseId));
                    const receipts = invoicePayments.map(p => p.receiptNumber).join(', ') || 'None';
                    const paidUSD = currentInvoice?.paidAmountUSD || 0;
                    const paidLBP = currentInvoice?.paidAmountLBP || 0;
                    const isFullyPaid = currentInvoice?.paid;
                    
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span>Receipt(s):</span>
                          <span className="font-mono">{receipts}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Amount Paid:</span>
                          <span>
                            {paidUSD > 0 && `$${formatNumber(paidUSD)}`}
                            {paidUSD > 0 && paidLBP > 0 && ' + '}
                            {paidLBP > 0 && `${formatLBPValue(paidLBP)} LBP`}
                            {paidUSD === 0 && paidLBP === 0 && '0'}
                            {isFullyPaid ? ' (Fully Settled)' : ''}
                          </span>
                        </div>
                        {!isFullyPaid && (
                          <div className="flex items-center gap-2 mt-1 pt-1 border-t border-green-200/50 dark:border-green-800/50">
                            <span>Amount Left:</span>
                            <span className="text-rose-600 dark:text-rose-400">
                              {(() => {
                                const amountLeftUSD = currentInvoice ? (currentInvoice.totalCostUSD - (currentInvoice.paidAmountUSD || 0) - ((currentInvoice.paidAmountLBP || 0) / (currentInvoice.exchangeRate || 1))) : 0;
                                const amountLeftLBP = currentInvoice ? (currentInvoice.totalCostLBP - (currentInvoice.paidAmountLBP || 0) - ((currentInvoice.paidAmountUSD || 0) * (currentInvoice.exchangeRate || 1))) : 0;
                                return purchaseCurrency === 'USD' 
                                  ? `$${formatNumber(Math.max(0, amountLeftUSD))}` 
                                  : `${formatLBPValue(Math.max(0, amountLeftLBP))} LBP`;
                              })()}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              {!isViewMode && (
              <button
                type="submit"
                disabled={items.length === 0}
                className="w-fit flex items-center gap-1.5 rounded-lg bg-teal-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{editingPurchaseId ? 'Save Changes' : 'Receive & Restock Items'}</span>
              </button>
              )}

              {/* Total Summary */}
              {items.length > 0 && (
                <div className="flex flex-wrap items-end gap-3 justify-end shrink-0 max-w-full overflow-hidden ml-auto">
                  {/* Subtotal */}
                  <div className="flex flex-col items-end justify-center rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 dark:bg-slate-800/40 dark:border-slate-700 min-w-[100px]">
                    <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase mb-1">
                      Subtotal
                    </span>
                    <div className="text-[13px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap w-full text-right">
                      {purchaseCurrency === 'USD' ? `$${formatNumber(subtotalUSD)}` : `${formatLBPValue(subtotalLBP)} LBP`}
                    </div>
                  </div>
                  
                  {/* VAT */}
                  <div className="flex flex-col items-end justify-center rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 dark:bg-slate-800/40 dark:border-slate-700 min-w-[100px]">
                    <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase mb-1">
                      VAT
                    </span>
                    <div className="text-[13px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap w-full text-right">
                      {formatLBPValue(totalVatLBP)} LBP
                    </div>
                  </div>
                  
                  {/* Discount (%) */}
                  <div className="flex flex-col items-end justify-center rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 dark:bg-slate-800/40 dark:border-slate-700 w-[101px]">
                    <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase mb-1">
                      Discount (%)
                    </span>
                    <div className="relative w-full">
                      <input
                        type="number"
                        step="any"
                        value={invoiceDiscount}
                        onChange={(e) => setInvoiceDiscount(e.target.value)}
                        disabled={isViewMode}
                        className="w-full text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 pr-4 text-[13px] font-bold text-slate-800 dark:text-slate-200 focus:border-teal-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                    </div>
                  </div>
                  
                  {/* Discount Amount */}
                  <div className="flex flex-col items-end justify-center rounded-xl bg-slate-50 border border-slate-200 pt-[9px] pb-2 pl-[13.5px] pr-[6.5px] mr-0 mb-0 dark:bg-slate-800/40 dark:border-slate-700 w-[150px]">
                    <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase mb-1">
                      Discount ({purchaseCurrency})
                    </span>
                    <input
                      type="text"
                      value={formatNumber(invoiceDiscountAmount)}
                      onChange={(e) => setInvoiceDiscountAmount(formatNumber(e.target.value))}
                      disabled={isViewMode}
                      className="w-full text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-[13px] font-bold text-slate-800 dark:text-slate-200 focus:border-teal-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
                    />
                  </div>
                  
                  {/* Grand Total */}
                  <div className="flex items-center justify-between rounded-xl bg-teal-50 border border-teal-100 px-4 py-2 text-teal-950 dark:bg-teal-950/40 dark:text-teal-300 shadow-sm gap-4 w-[220px]">
                    <span className="uppercase text-[10px] font-bold tracking-wider text-teal-700/80 dark:text-teal-400/80">
                      Total
                    </span>
                    <div className="flex flex-col items-end whitespace-nowrap w-full">
                      {purchaseCurrency === 'USD' ? (
                        <>
                          <div className="text-[14px] font-extrabold leading-none flex items-baseline gap-1 w-full">
                            <span>$</span>
                            <input
                              type="text"
                              value={manualTotal !== '' ? formatNumber(manualTotal) : ''}
                              onChange={(e) => setManualTotal(e.target.value)}
                              placeholder={formatNumber(totalCostUSD)}
                              disabled={isViewMode}
                              className="w-full text-right bg-transparent border-b border-transparent focus:border-teal-400 focus:outline-none placeholder-teal-950 dark:placeholder-teal-300 font-extrabold"
                            />
                          </div>
                          <div className="w-full h-px bg-teal-200/80 dark:bg-teal-800/80 my-1" />
                          <div className="text-[12px] font-bold leading-none text-teal-800/90 dark:text-teal-300/90">
                            {formatLBPValue(totalCostLBP)} LBP
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[14px] font-extrabold leading-none flex items-baseline gap-1 w-full">
                            <input
                              type="text"
                              value={manualTotal !== '' ? formatNumber(manualTotal) : ''}
                              onChange={(e) => setManualTotal(e.target.value)}
                              placeholder={formatLBPValue(totalCostLBP)}
                              disabled={isViewMode}
                              className="w-full text-right bg-transparent border-b border-transparent focus:border-teal-400 focus:outline-none placeholder-teal-950 dark:placeholder-teal-300 font-extrabold"
                            />
                            <span className="text-[10px] font-semibold text-teal-800/60 dark:text-teal-300/60">LBP</span>
                          </div>
                          <div className="w-full h-px bg-teal-200/80 dark:bg-teal-800/80 my-1" />
                          <div className="text-[12px] font-bold leading-none text-teal-800/90 dark:text-teal-300/90">
                            ${formatNumber(totalCostUSD)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </DesktopWindow>
      )}
      {/* Close Confirm Modal */}
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

      {/* Delete Purchase Confirm Modal */}
      {purchaseToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-red-50/50 dark:bg-red-900/20">
              <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Delete Purchase Invoice
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete this purchase? This will revert the stock added.
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => setPurchaseToDelete(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deletePurchase(purchaseToDelete);
                  setPurchaseToDelete(null);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payment Confirm Modal */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-red-50/50 dark:bg-red-900/20">
              <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Delete Payment Record
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete this payment? Supplier balances and invoice statuses will be reverted.
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => setPaymentToDelete(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteSupplierPayment(paymentToDelete);
                  setPaymentToDelete(null);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Delete Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <SupplierPaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setPaymentToEdit(null);
            setInitialSupplierIdForModal(undefined);
          }}
          paymentToEdit={paymentToEdit}
          initialSupplierId={initialSupplierIdForModal}
        />
      )}

      {/* Add Stock Product Modal directly from Purchase Form */}
      {isAddStockProductModalOpen && (
        <AddStockProductModal
          isOpen={isAddStockProductModalOpen}
          onClose={() => setIsAddStockProductModalOpen(false)}
          initialBarcode={addStockInitialData.barcode}
          initialCode={addStockInitialData.code}
          initialName={addStockInitialData.name}
          initialBatch={addStockInitialData.batch}
          initialExpiry={addStockInitialData.expiry}
          onProductAdded={handleStockProductAdded}
        />
      )}
    </div>
  );
};
