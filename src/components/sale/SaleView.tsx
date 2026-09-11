import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  UserCheck,
  CreditCard,
  Banknote,
  Receipt,
  Info,
  AlertTriangle,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Filter,
  X,
  Tag,
  Check,
  Percent,
  ArrowLeftRight
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useDebounce } from '../../hooks/useDebounce';
import { Product, CartItem, SaleTransaction, ProductCategory } from '../../types/pharmacy';
import { formatStockDisplay } from '../../utils/stockUtils';
import { formatLBPValue } from '../../utils/priceUtils';
import { filterProductsByMultiWordQuery } from '../../utils/searchUtils';
import { ReceiptModal } from '../common/ReceiptModal';
import { SalesTransactionLog } from './SalesTransactionLog';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';

interface SaleViewProps {
  onViewScientific: (product: Product) => void;
}

let sharedCanvasContext: CanvasRenderingContext2D | null = null;
function getSharedCanvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!sharedCanvasContext) {
    const canvas = document.createElement('canvas');
    sharedCanvasContext = canvas.getContext('2d');
  }
  return sharedCanvasContext;
}

interface ProductCardTitleProps {
  name: string;
  dosage?: string;
  presentation?: string;
  form?: string;
}

const ProductCardTitle: React.FC<ProductCardTitleProps> = ({
  name,
  dosage,
  presentation,
  form,
}) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const trimmedPresentation = presentation?.trim();
  const trimmedForm = form?.trim();
  const trimmedDosage = dosage?.trim();
  const hasMeta = !!(trimmedPresentation || trimmedForm);

  // Initial estimate to prevent visual layout shifts on first paint
  const [isWrapped, setIsWrapped] = useState(() => {
    const totalChars =
      name.length +
      (trimmedDosage ? trimmedDosage.length + 2 : 0) +
      (trimmedPresentation ? trimmedPresentation.length + 2 : 0) +
      (trimmedForm ? trimmedForm.length + 2 : 0);
    return totalChars * 7.5 > 220;
  });

  useEffect(() => {
    if (!hasMeta) return;
    const el = containerRef.current;
    if (!el) return;

    const evaluateWrap = () => {
      const containerWidth = el.clientWidth;
      if (containerWidth <= 0) return;

      const ctx = getSharedCanvasContext();
      let nameWidth = 0;
      let metaWidth = 0;

      if (ctx) {
        ctx.font = 'bold 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const nameText = trimmedDosage ? `${name}  ${trimmedDosage}` : name;
        nameWidth = ctx.measureText(nameText).width;

        ctx.font = '11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const metaParts = [trimmedPresentation, trimmedForm].filter(Boolean);
        metaWidth = ctx.measureText(metaParts.join('  ')).width;
      } else {
        nameWidth = (name.length + (trimmedDosage?.length || 0)) * 7.5;
        metaWidth = ((trimmedPresentation?.length || 0) + (trimmedForm?.length || 0)) * 6.8;
      }

      // If name + meta + required gap (16px) does not fit on one line:
      const shouldWrap = (nameWidth + metaWidth + 16) > containerWidth;
      setIsWrapped(shouldWrap);
    };

    evaluateWrap();

    const resizeObserver = new ResizeObserver(() => {
      evaluateWrap();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [name, trimmedDosage, trimmedPresentation, trimmedForm, hasMeta]);

  if (!hasMeta) {
    return (
      <h3 ref={containerRef} className="mt-1 leading-snug">
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 break-words whitespace-normal">
          {name}
          {trimmedDosage && (
            <span className="ml-1.5 font-semibold text-teal-700 dark:text-teal-400">
              {trimmedDosage}
            </span>
          )}
        </span>
      </h3>
    );
  }

  // If presentation or form are not on the same line next to the item name, adjust alignment to the left
  if (isWrapped) {
    return (
      <h3 ref={containerRef} className="mt-1 flex flex-col items-start gap-0.5 leading-snug w-full">
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 break-words whitespace-normal w-full text-left">
          {name}
          {trimmedDosage && (
            <span className="ml-1.5 font-semibold text-teal-700 dark:text-teal-400">
              {trimmedDosage}
            </span>
          )}
        </span>
        <span className="w-full flex items-baseline gap-1.5 text-left text-[11px] justify-start flex-wrap">
          {trimmedPresentation && (
            <span className="font-semibold text-slate-700 dark:text-slate-300 break-words">
              {trimmedPresentation}
            </span>
          )}
          {trimmedForm && (
            <span className="font-normal text-slate-500 dark:text-slate-400 break-words">
              {trimmedForm}
            </span>
          )}
        </span>
      </h3>
    );
  }

  // When on the same line: form on extreme right, presentation before it
  return (
    <h3 ref={containerRef} className="mt-1 flex items-baseline justify-between gap-1.5 leading-snug w-full">
      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 break-words whitespace-normal flex-1 min-w-0">
        {name}
        {trimmedDosage && (
          <span className="ml-1.5 font-semibold text-teal-700 dark:text-teal-400">
            {trimmedDosage}
          </span>
        )}
      </span>
      <span className="ml-auto flex items-baseline gap-1.5 text-right text-[11px] justify-end shrink-0">
        {trimmedPresentation && (
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {trimmedPresentation}
          </span>
        )}
        {trimmedForm && (
          <span className="font-normal text-slate-500 dark:text-slate-400">
            {trimmedForm}
          </span>
        )}
      </span>
    </h3>
  );
};

interface ProductCardProps {
  prod: Product;
  index: number;
  isFocused: boolean;
  inCartBoxes: number;
  inCartPieces: number;
  onAdd: (prod: Product) => void;
  onAddPiece: (prod: Product) => void;
  onViewScientific: (prod: Product) => void;
}

const ProductCard = React.memo(function ProductCard({
  prod,
  index,
  isFocused,
  inCartBoxes,
  inCartPieces,
  onAdd,
  onAddPiece,
  onViewScientific,
}: ProductCardProps) {
  const isLow = prod.stockQuantity <= prod.minStockAlert;
  const isOut = prod.stockQuantity <= 0;
  const isInCart = inCartBoxes > 0 || inCartPieces > 0;
  const totalInCartDisplay = inCartBoxes > 0 && inCartPieces > 0
    ? `${inCartBoxes} bxs, ${inCartPieces} ${prod.pieceName || 'pcs'}`
    : inCartBoxes > 0
    ? `${inCartBoxes} ${inCartBoxes === 1 ? 'box' : 'boxes'}`
    : `${inCartPieces} ${prod.pieceName || 'pcs'}`;

  return (
    <div
      id={`product-card-${index}`}
      onClick={() => onAdd(prod)}
      role="button"
      tabIndex={isOut ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAdd(prod);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-lg border p-3 transition-all select-none shadow-2xs ${
        isFocused ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 border-indigo-500 z-10' : ''
      } ${
        isOut
          ? 'border-gray-200 bg-gray-50/70 opacity-60 dark:border-slate-800 dark:bg-slate-900/40 cursor-not-allowed'
          : isInCart
          ? 'border-teal-500 bg-teal-50/30 ring-1 ring-teal-500/30 hover:border-teal-600 hover:shadow-md active:scale-[0.985] dark:border-teal-500 dark:bg-teal-950/25 cursor-pointer'
          : 'border-gray-200 bg-white hover:border-teal-500 hover:shadow-md active:scale-[0.985] dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-teal-500 cursor-pointer'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] font-bold uppercase rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-slate-800 dark:text-slate-400">
              {prod.code}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                prod.category === 'drug'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  : prod.category === 'vitamins'
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
                  : prod.category === 'cosmetics'
                  ? 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300'
                  : 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
              }`}
            >
              {prod.category}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isInCart && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-2xs shrink-0">
                <Check className="h-2.5 w-2.5" />
                <span>{totalInCartDisplay} in cart</span>
              </span>
            )}
            {/* Requirement 22: For drugs, quick scientific info */}
            {prod.category === 'drug' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewScientific(prod);
                }}
                className="rounded border border-gray-200 p-1 text-gray-400 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 cursor-pointer transition-colors"
                title="View Scientific Indications, Contraindications & Generics"
              >
                <Info className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <ProductCardTitle
          name={prod.name}
          dosage={prod.dosage}
          presentation={prod.presentation}
          form={prod.form}
        />
        {prod.ingredients ? (
          <p className="mt-0.5 text-[10px] text-gray-500 dark:text-slate-400 break-words whitespace-normal leading-relaxed">
            {prod.ingredients}
          </p>
        ) : null}
      </div>

      <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="shrink-0">
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
            ${prod.priceUSD.toFixed(2)}
          </div>
          <div className="text-[10px] font-medium text-green-700 dark:text-green-400">
            {formatLBPValue(prod.priceLBP)} LBP
          </div>
        </div>

        <div className="text-right flex flex-col items-end space-y-1 shrink-0">
          {prod.isDivisible && prod.piecesPerBox && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddPiece(prod);
              }}
              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded text-[9px] font-bold shadow-xs transition-colors border border-indigo-200 dark:border-indigo-800/50 z-10 cursor-pointer"
            >
              + Add {prod.pieceName || 'Piece'}
            </button>
          )}
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
              isOut
                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                : isLow
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                : 'text-green-700 dark:text-green-400 font-semibold'
            }`}
          >
            {isOut ? 'Out of Stock' : `${formatStockDisplay(prod.stockQuantity, prod.isDivisible, prod.piecesPerBox, prod.pieceName)} in stock`}
          </span>
        </div>
      </div>
    </div>
  );
});

export const SaleView: React.FC<SaleViewProps> = ({ onViewScientific }) => {
  const {
    products,
    customers,
    currentUser,
    recordSale,
    exchangeRate,
    toLBP,
    toUSD,
    formatLBP,
    formatUSD,
    settings,
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);

  useBarcodeScanner({
    onScan: (barcode) => {
      const product = products.find(
        (p) => (p.barcode || '').toLowerCase() === barcode.toLowerCase() || p.code.toLowerCase() === barcode.toLowerCase()
      );
      if (product) {
        addToCart(product);
        setSearchQuery('');
      } else {
        setErrorMessage(`Product with barcode "${barcode}" not found.`);
        setTimeout(() => setErrorMessage(null), 3000);
      }
    }
  });

  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartPosition, setCartPosition] = useState<'right' | 'left'>(() => {
    return (localStorage.getItem('pos_cart_position') as 'right' | 'left') || 'right';
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash_lbp' | 'cash_usd' | 'mixed' | 'credit_debt'>('cash_lbp');
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState<boolean>(false);
  const [writeOffDifferences, setWriteOffDifferences] = useState<boolean>(false);

  const selectedCust = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Tendered amounts
  const [tenderedUSD, setTenderedUSD] = useState<string>('');
  const [tenderedLBP, setTenderedLBP] = useState<string>('');

  const [lastCompletedSale, setLastCompletedSale] = useState<SaleTransaction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leftPanelMode, setLeftPanelMode] = useState<'log' | 'catalog'>('log');
  const catalogContainerRef = useRef<HTMLDivElement>(null);

  const getNumCols = () => (window.innerWidth >= 1280 ? 3 : window.innerWidth >= 640 ? 2 : 1);

  const [numCols, setNumCols] = useState<number>(() => getNumCols());
  useEffect(() => {
    const updateCols = () => setNumCols(getNumCols());
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const [focusedItemIndex, setFocusedItemIndex] = useState<number>(-1);
  const addToCartRef = useRef<((product: Product, isPiece?: boolean) => void) | null>(null);

  // Keep ref fresh so keydown handlers always use the latest
  useEffect(() => {
    addToCartRef.current = addToCart;
  });

  // Filtered products: search is expensive (multi-word + Arabic normalization), so it only
  // runs off the debounced query. Cart sorting is split out so cart changes don't re-scan 5600 products.
  const searchedProducts = useMemo(() => {
    return filterProductsByMultiWordQuery(products, debouncedSearchQuery, selectedCategory);
  }, [products, debouncedSearchQuery, selectedCategory]);

  const cartProductIds = useMemo(() => new Set(cart.map(item => item.product.id)), [cart]);

  const cartInfoById = useMemo(() => {
    const map = new Map<string, { boxes: number; pieces: number }>();
    for (const item of cart) {
      const entry = map.get(item.product.id) || { boxes: 0, pieces: 0 };
      if (item.isPiece) entry.pieces += item.quantity;
      else entry.boxes += item.quantity;
      map.set(item.product.id, entry);
    }
    return map;
  }, [cart]);

  const filteredProducts = useMemo(() => {
    if (!searchedProducts.length) return searchedProducts;
    const sorted = [...searchedProducts];
    sorted.sort((a, b) => {
      const aInCart = cartProductIds.has(a.id);
      const bInCart = cartProductIds.has(b.id);
      if (aInCart && !bInCart) return -1;
      if (!aInCart && bInCart) return 1;
      return 0;
    });
    return sorted;
  }, [searchedProducts, cartProductIds]);

  // Virtualize the product grid: only renders the visible cards (3-col rows)
  const productGridVirtualizer = useVirtualizer({
    count: Math.ceil(filteredProducts.length / numCols),
    getScrollElement: () => catalogContainerRef.current,
    estimateSize: () => 150,
    overscan: 4,
    getItemKey: (index) => index,
  });

  // Reset focus when filters change
  useEffect(() => {
    setFocusedItemIndex(-1);
  }, [searchQuery, selectedCategory]);

  // Handle global keyboard shortcuts for navigation and selection
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) {
        if ((e.target as HTMLInputElement).type !== 'text') return;
      }

      if (e.key === 'Escape') {
        setSearchQuery('');
        setFocusedItemIndex(-1);
        return;
      }

      if (leftPanelMode !== 'catalog') return;
      if (filteredProducts.length === 0) return;

      const numCols = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 640 ? 2 : 1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedItemIndex(prev => {
          if (prev === -1) return 0;
          const next = prev < filteredProducts.length - numCols ? prev + numCols : prev;
          setTimeout(() => productGridVirtualizer.scrollToIndex(Math.floor(next / numCols), { align: 'auto', behavior: 'smooth' }), 0);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedItemIndex(prev => {
          if (prev === -1) return 0;
          const next = prev >= numCols ? prev - numCols : 0;
          setTimeout(() => productGridVirtualizer.scrollToIndex(Math.floor(next / numCols), { align: 'auto', behavior: 'smooth' }), 0);
          return next;
        });
      } else if (e.key === 'ArrowRight') {
        if (isInput && focusedItemIndex === -1) return; // Allow text cursor movement if user hasn't started grid navigation
        e.preventDefault();
        setFocusedItemIndex(prev => {
          if (prev === -1) return 0;
          const next = prev < filteredProducts.length - 1 ? prev + 1 : prev;
          setTimeout(() => productGridVirtualizer.scrollToIndex(Math.floor(next / numCols), { align: 'auto', behavior: 'smooth' }), 0);
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        if (isInput && focusedItemIndex === -1) return; // Allow text cursor movement if user hasn't started grid navigation
        e.preventDefault();
        setFocusedItemIndex(prev => {
          if (prev === -1) return 0;
          const next = prev > 0 ? prev - 1 : 0;
          setTimeout(() => productGridVirtualizer.scrollToIndex(Math.floor(next / numCols), { align: 'auto', behavior: 'smooth' }), 0);
          return next;
        });
      } else if (e.key === 'Enter') {
        // If they are in the search bar but haven't selected anything in the grid, we don't want to add the first item arbitrarily 
        // unless they actually focused an item.
        if (focusedItemIndex >= 0 && focusedItemIndex < filteredProducts.length) {
          const prod = filteredProducts[focusedItemIndex];
          if (prod.stockQuantity > 0 && addToCartRef.current) {
            e.preventDefault();
            addToCartRef.current(prod);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [leftPanelMode, filteredProducts, focusedItemIndex]);


  // Global barcode scanner listener is handled by useBarcodeScanner hook at the top of the component

  // Cart operations
  const addToCart = (product: Product, isPiece: boolean = false) => {
    if (product.stockQuantity <= 0) {
      setErrorMessage(`Cannot add "${product.name}": Out of stock!`);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const requestedEquivalent = isPiece && product.piecesPerBox ? (1 / product.piecesPerBox) : 1;

    setCart((prev) => {
      // Calculate current cart usage of this product to prevent exceeding stock
      const currentUsage = prev
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => sum + (item.isPiece && item.product.piecesPerBox ? item.quantity / item.product.piecesPerBox : item.quantity), 0);

      if (currentUsage + requestedEquivalent > product.stockQuantity) {
        setErrorMessage(`Only ${formatStockDisplay(product.stockQuantity, product.isDivisible, product.piecesPerBox, product.pieceName)} available in stock!`);
        setTimeout(() => setErrorMessage(null), 3000);
        return prev;
      }

      const existingIdx = prev.findIndex((item) => item.product.id === product.id && !!item.isPiece === !!isPiece && (!item.selectedBatchNumber || (item.product.batches && item.product.batches.length <= 1)));
      if (existingIdx >= 0) {
        const newCart = [...prev];
        newCart[existingIdx] = { ...newCart[existingIdx], quantity: newCart[existingIdx].quantity + 1 };
        return newCart;
      }
      
      const divisor = isPiece && product.piecesPerBox ? product.piecesPerBox : 1;
      
      let initialUnitPriceUSD = 0;
      let initialUnitPriceLBP = 0;
      
      if (isPiece && product.piecePriceUSD != null) {
        initialUnitPriceUSD = product.piecePriceUSD;
        initialUnitPriceLBP = Math.round(product.piecePriceUSD * exchangeRate);
      } else {
        initialUnitPriceUSD = Number((product.priceUSD / divisor).toFixed(2));
        initialUnitPriceLBP = Math.round(product.priceLBP / divisor);
      }

      return [
        ...prev,
        {
          cartItemId: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          product,
          quantity: 1,
          discountPercent: 0,
          unitPriceUSD: initialUnitPriceUSD,
          unitPriceLBP: initialUnitPriceLBP,
          isPiece,
        },
      ];
    });
  };

  const updateBatch = (cartItemId: string, batchStr: string) => {
    setCart((prev) => {
      return prev.map((item) => {
         if (item.cartItemId === cartItemId) {
            if (batchStr === '') {
              return { ...item, selectedBatchNumber: undefined, selectedExpiryDate: undefined };
            }
            const [batchNumber, expiryDate] = batchStr.split('||');
            return { ...item, selectedBatchNumber: batchNumber, selectedExpiryDate: expiryDate };
         }
         return item;
      });
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + delta;
            
            // Check usage
            const otherUsage = prev
               .filter(i => i.product.id === item.product.id && i.cartItemId !== cartItemId)
               .reduce((sum, i) => sum + (i.isPiece && i.product.piecesPerBox ? i.quantity / i.product.piecesPerBox : i.quantity), 0);
            
            const thisUsage = item.isPiece && item.product.piecesPerBox ? nextQty / item.product.piecesPerBox : nextQty;

            if (otherUsage + thisUsage > item.product.stockQuantity) {
              setErrorMessage(`Stock maximum reached (${formatStockDisplay(item.product.stockQuantity, item.product.isDivisible, item.product.piecesPerBox, item.product.pieceName)})`);
              setTimeout(() => setErrorMessage(null), 2500);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const setAbsoluteQuantity = (cartItemId: string, qty: number) => {
    if (isNaN(qty) || qty < 0) return;
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            // Check usage
            const otherUsage = prev
               .filter(i => i.product.id === item.product.id && i.cartItemId !== cartItemId)
               .reduce((sum, i) => sum + (i.isPiece && i.product.piecesPerBox ? i.quantity / i.product.piecesPerBox : i.quantity), 0);
            
            const thisUsage = item.isPiece && item.product.piecesPerBox ? qty / item.product.piecesPerBox : qty;
            
            if (otherUsage + thisUsage > item.product.stockQuantity) {
              setErrorMessage(`Stock maximum reached (${formatStockDisplay(item.product.stockQuantity, item.product.isDivisible, item.product.piecesPerBox, item.product.pieceName)})`);
              setTimeout(() => setErrorMessage(null), 2500);
              return item;
            }
            return { ...item, quantity: qty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const updateDiscount = (cartItemId: string, discount: number) => {
    if (isNaN(discount)) discount = 0;
    const clamped = Math.max(-1000, Math.min(100, Math.round(discount)));
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, discountPercent: clamped } : item
      )
    );
  };


  const updateUnitPrice = (cartItemId: string, newPriceUSD: number) => {
    if (isNaN(newPriceUSD) || newPriceUSD < 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? {
              ...item,
              unitPriceUSD: newPriceUSD,
              unitPriceLBP: Math.round(newPriceUSD * exchangeRate),
            }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setTenderedUSD('');
    setTenderedLBP('');
    setWriteOffDifferences(false);
    setErrorMessage(null);
  };

  // Calculations
  const subtotalUSD = useMemo(() => {
    return Number(
      cart
        .reduce((sum, item) => sum + item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100), 0)
        .toFixed(2)
    );
  }, [cart]);

  const totalTaxUSD = useMemo(() => {
    return Number(
      cart
        .reduce((sum, item) => {
          const rate = settings.vatRates?.[item.product.category] || 0;
          const divisor = item.isPiece && item.product.piecesPerBox ? item.product.piecesPerBox : 1;
          const costPerUnit = (item.product.costPriceUSD || 0) / divisor;
          const itemCostTotal = costPerUnit * item.quantity;
          // Calculate tax based on the item's cost price
          return sum + (itemCostTotal * (rate / 100));
        }, 0)
        .toFixed(2)
    );
  }, [cart, settings.vatRates]);

  const totalTaxLBP = useMemo(() => {
    return Math.round(totalTaxUSD * exchangeRate);
  }, [totalTaxUSD, exchangeRate]);

  const totalUSD = useMemo(() => {
    return Number((subtotalUSD + totalTaxUSD).toFixed(2));
  }, [subtotalUSD, totalTaxUSD]);

  const totalDiscountUSD = useMemo(() => {
    return Number(
      cart
        .reduce((sum, item) => sum + item.unitPriceUSD * item.quantity * (item.discountPercent / 100), 0)
        .toFixed(2)
    );
  }, [cart]);

  const totalDiscountLBP = useMemo(() => {
    return Math.round(totalDiscountUSD * exchangeRate);
  }, [totalDiscountUSD, exchangeRate]);

  const totalLBP = useMemo(() => {
    return Math.round(totalUSD * exchangeRate);
  }, [totalUSD, exchangeRate]);

  const totalCostUSD = useMemo(() => {
    return Number(
      cart
        .reduce((sum, item) => {
          const divisor = item.isPiece && item.product.piecesPerBox ? item.product.piecesPerBox : 1;
          const costPerUnit = (item.product.costPriceUSD || 0) / divisor;
          return sum + (costPerUnit * item.quantity);
        }, 0)
        .toFixed(2)
    );
  }, [cart]);

  const marginPercent = useMemo(() => {
    if (totalUSD <= 0) return 0;
    return ((totalUSD - totalCostUSD) / totalUSD) * 100;
  }, [totalUSD, totalCostUSD]);

  // Robust Number Parsing for Lebanese Dual-Currency POS
  const parseLBP = (val: string): number => {
    if (!val) return 0;
    // Normalize Arabic-Indic digits if entered
    const arabicIndic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let norm = val;
    arabicIndic.forEach((d, i) => {
      norm = norm.replaceAll(d, i.toString());
    });
    // Remove all non-numeric characters (commas, dots, spaces, LBP, etc.)
    const clean = norm.replace(/[^0-9]/g, '');
    return parseInt(clean, 10) || 0;
  };

  const parseUSD = (val: string): number => {
    if (!val) return 0;
    const arabicIndic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let norm = val;
    arabicIndic.forEach((d, i) => {
      norm = norm.replaceAll(d, i.toString());
    });
    let clean = norm.replace(/[^0-9.,]/g, '');
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.lastIndexOf('.') > clean.lastIndexOf(',')) {
        clean = clean.replace(/,/g, '');
      } else {
        clean = clean.replace(/\./g, '').replace(',', '.');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
  };

  // Payment Calculation
  const paidUSD = parseUSD(tenderedUSD);
  const paidLBP = parseLBP(tenderedLBP);
  const hasEnteredPayment = tenderedUSD.trim() !== '' || tenderedLBP.trim() !== '';

  // Total paid converted to USD and LBP
  const totalPaidInUSD = Number((paidUSD + (exchangeRate > 0 ? paidLBP / exchangeRate : 0)).toFixed(4));
  const totalPaidInLBP = Math.round(paidUSD * exchangeRate) + paidLBP;

  // Exact difference between received and total due
  const diffUSD = totalPaidInUSD - totalUSD;
  const isExactPayment = hasEnteredPayment && Math.abs(diffUSD) < 0.009;
  const isOverpaid = hasEnteredPayment && diffUSD >= 0.009;
  const isUnderpaid = hasEnteredPayment && diffUSD <= -0.009;

  // Change amounts to return (when customer overpaid)
  const changeUSD = isOverpaid ? Number(diffUSD.toFixed(2)) : 0;
  const changeLBP = isOverpaid
    ? (paidUSD === 0 ? Math.max(0, paidLBP - totalLBP) : Math.round(diffUSD * exchangeRate))
    : 0;

  // Shortage amounts (when customer underpaid)
  const remainingUSD = isUnderpaid ? Number(Math.abs(diffUSD).toFixed(2)) : 0;
  const remainingLBP = isUnderpaid
    ? (paidUSD === 0 ? Math.max(0, totalLBP - paidLBP) : Math.round(Math.abs(diffUSD) * exchangeRate))
    : 0;

  // Complete checkout
  const handleCheckout = () => {
    if (cart.length === 0) {
      setErrorMessage('Cart is empty. Add at least one item to proceed.');
      return;
    }

    if (hasEnteredPayment && isUnderpaid && !writeOffDifferences) {
      setErrorMessage(
        `Received payment is short by $${remainingUSD.toFixed(2)} (${formatLBPValue(remainingLBP)} LBP). Check "Write off differences" to forgive the shortage and accept this transaction.`
      );
      return;
    }

    // If "Cash Client" is chosen, it is always a payment paid with cash directly (not a debt)
    if (!selectedCustomerId) {
      executeCompleteSale('cash');
      return;
    }

    // If any other customer is chosen, prompt confirmation message to choose cash or debt
    setShowPaymentConfirmModal(true);
  };

  const executeCompleteSale = (chosenType: 'cash' | 'debt') => {
    if (cart.length === 0) return;

    const currentCustomer = customers.find((c) => c.id === selectedCustomerId);

    if (chosenType === 'cash') {
      if (hasEnteredPayment && isUnderpaid && !writeOffDifferences) {
        setErrorMessage(
          `Tendered cash is less than total due. Remaining: $${remainingUSD.toFixed(2)} (${formatLBPValue(remainingLBP)} LBP). Please check "Write off differences" to accept.`
        );
        setShowPaymentConfirmModal(false);
        return;
      }

      let finalPaidUSD = paidUSD;
      let finalPaidLBP = paidLBP;
      let finalMethod: 'cash_lbp' | 'cash_usd' | 'mixed' = 'cash_lbp';

      if (!hasEnteredPayment) {
        finalPaidUSD = 0;
        finalPaidLBP = totalLBP;
        finalMethod = 'cash_lbp';
      } else {
        if (finalPaidUSD > 0 && finalPaidLBP > 0) {
          finalMethod = 'mixed';
        } else if (finalPaidUSD > 0 && finalPaidLBP === 0) {
          finalMethod = 'cash_usd';
        } else if (finalPaidLBP > 0 && finalPaidUSD === 0) {
          finalMethod = 'cash_lbp';
        }
      }

      const writeOffUSDAmount = hasEnteredPayment && isUnderpaid && writeOffDifferences ? remainingUSD : 0;
      const writeOffLBPAmount = hasEnteredPayment && isUnderpaid && writeOffDifferences ? remainingLBP : 0;

      const saleRecord = recordSale({
        date: new Date().toISOString(),
        items: cart.map((item) => {
          const rate = settings.vatRates?.[item.product.category] || 0;
          const divisor = item.isPiece && item.product.piecesPerBox ? item.product.piecesPerBox : 1;
          const costPerUnit = (item.product.costPriceUSD || 0) / divisor;
          const itemCostTotal = costPerUnit * item.quantity;
          
          const preTaxUSD = item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100);
          const taxUSD = itemCostTotal * (rate / 100);
          const finalItemTotalUSD = Number((preTaxUSD + taxUSD).toFixed(2));
          
          return {
            productId: item.product.id,
            productCode: item.product.code,
            productName: item.product.name,
            category: item.product.category,
            quantity: item.quantity,
            discountPercent: item.discountPercent,
            unitPriceUSD: item.unitPriceUSD,
            unitPriceLBP: item.unitPriceLBP,
            costPriceUSD: item.product.costPriceUSD,
            totalUSD: finalItemTotalUSD,
            totalLBP: Math.round(finalItemTotalUSD * exchangeRate),
            isPiece: item.isPiece,
            selectedBatchNumber: item.selectedBatchNumber,
            selectedExpiryDate: item.selectedExpiryDate,
          };
        }),
        totalUSD,
        totalLBP,
        exchangeRate,
        customerId: currentCustomer?.id,
        customerName: currentCustomer?.name || 'Cash Client',
        cashierId: currentUser?.id || 'admin',
        cashierName: currentUser?.name || 'Administrator',
        paymentMethod: finalMethod,
        amountPaidUSD: finalPaidUSD,
        amountPaidLBP: finalPaidLBP,
        changeGivenUSD: changeUSD,
        changeGivenLBP: changeLBP,
        writeOffUSD: writeOffUSDAmount,
        writeOffLBP: writeOffLBPAmount,
        notes: writeOffUSDAmount > 0
          ? `Difference written off: $${writeOffUSDAmount.toFixed(2)} (${formatLBPValue(writeOffLBPAmount)} LBP)`
          : undefined,
      });

      setLastCompletedSale(saleRecord);
      clearCart();
      setTenderedUSD('');
      setTenderedLBP('');
      setSelectedCustomerId('');
      setWriteOffDifferences(false);
      setShowPaymentConfirmModal(false);
      setLeftPanelMode('log');
    } else {
      // Registered as Debt for this customer
      const saleRecord = recordSale({
        date: new Date().toISOString(),
        items: cart.map((item) => {
          const rate = settings.vatRates?.[item.product.category] || 0;
          const divisor = item.isPiece && item.product.piecesPerBox ? item.product.piecesPerBox : 1;
          const costPerUnit = (item.product.costPriceUSD || 0) / divisor;
          const itemCostTotal = costPerUnit * item.quantity;
          
          const preTaxUSD = item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100);
          const taxUSD = itemCostTotal * (rate / 100);
          const finalItemTotalUSD = Number((preTaxUSD + taxUSD).toFixed(2));
          
          return {
            productId: item.product.id,
            productCode: item.product.code,
            productName: item.product.name,
            category: item.product.category,
            quantity: item.quantity,
            discountPercent: item.discountPercent,
            unitPriceUSD: item.unitPriceUSD,
            unitPriceLBP: item.unitPriceLBP,
            costPriceUSD: item.product.costPriceUSD,
            totalUSD: finalItemTotalUSD,
            totalLBP: Math.round(finalItemTotalUSD * exchangeRate),
            isPiece: item.isPiece,
            selectedBatchNumber: item.selectedBatchNumber,
            selectedExpiryDate: item.selectedExpiryDate,
          };
        }),
        totalUSD,
        totalLBP,
        exchangeRate,
        customerId: currentCustomer?.id,
        customerName: currentCustomer?.name || 'Customer',
        cashierId: currentUser?.id || 'admin',
        cashierName: currentUser?.name || 'Administrator',
        paymentMethod: 'credit_debt',
        amountPaidUSD: 0,
        amountPaidLBP: 0,
        changeGivenUSD: 0,
        changeGivenLBP: 0,
        writeOffUSD: 0,
        writeOffLBP: 0,
        notes: 'Charged to customer debt account',
      });

      setLastCompletedSale(saleRecord);
      clearCart();
      setTenderedUSD('');
      setTenderedLBP('');
      setSelectedCustomerId('');
      setWriteOffDifferences(false);
      setShowPaymentConfirmModal(false);
      setLeftPanelMode('log');
    }
  };

  return (
    <div className={`flex h-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 ${cartPosition === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
      {/* LEFT PANEL: Sales Transactions Log & Product Directory */}
      <div className={`flex flex-1 flex-col ${cartPosition === 'right' ? 'border-r' : 'border-l'} border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}>
        {/* View Mode Switcher Header Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/90 px-3 py-2 shrink-0">
          <div className="flex items-center space-x-1.5">
            <SectionRestoreButton section="sale" className="mr-1" />
            <button
              onClick={() => setLeftPanelMode('log')}
              className={`flex items-center space-x-1.5 rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                leftPanelMode === 'log'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Sales Transactions Log</span>
            </button>

            <button
              onClick={() => setLeftPanelMode('catalog')}
              className={`flex items-center space-x-1.5 rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                leftPanelMode === 'catalog'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Medications Catalog (POS)</span>
            </button>
          </div>

          {leftPanelMode === 'catalog' && (
            <div className="text-[10px] text-gray-500 dark:text-slate-400 hidden sm:block">
              Click any medication to add directly to cart
            </div>
          )}
        </div>

        {/* Selected Component: Sales Transactions Log with Viewing, Editing & Printing */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {leftPanelMode === 'log' ? (
            <SalesTransactionLog onSwitchToCatalog={() => setLeftPanelMode('catalog')} />
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search & Category Filter Toolbar */}
              <div className="p-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/80 space-y-2.5 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        const trimmed = searchQuery.trim().toLowerCase();
                        const exactProduct = products.find(
                          p => (p.barcode || '').toLowerCase() === trimmed || (p.code || '').toLowerCase() === trimmed
                        );
                        if (exactProduct) {
                          addToCart(exactProduct);
                          setSearchQuery('');
                        } else if (filteredProducts.length > 0) {
                          addToCart(filteredProducts[0]);
                          setSearchQuery('');
                        }
                      }
                    }}
                    placeholder="Search by multi-word name (e.g. 'Panadol Advance', 'بنادول أدفانس'), Code, Barcode..."
                    className="w-full rounded border border-gray-300 bg-white pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder-gray-400 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter Pills (Requirement 21) */}
                <div className="flex items-center gap-1 overflow-x-auto text-xs">
                  {(['all', 'drug', 'vitamins', 'cosmetics', 'para'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded px-2.5 py-1 font-bold uppercase text-[10px] transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-teal-700 text-white shadow-2xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {cat === 'all' ? 'All Items' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid / Cards */}
              <div ref={catalogContainerRef} className="flex-1 overflow-y-auto p-3">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs">
                    <ShoppingBag className="h-8 w-8 text-gray-300 mb-2 dark:text-slate-700" />
                    <span>No products match the search query.</span>
                  </div>
                ) : (
                  <div
                    style={{ height: productGridVirtualizer.getTotalSize(), position: 'relative' }}
                  >
                    {productGridVirtualizer.getVirtualItems().map((virtualRow) => {
                      const startIdx = virtualRow.index * numCols;
                      const rowItems = filteredProducts.slice(startIdx, startIdx + numCols);
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={productGridVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                            gap: '0.625rem',
                          }}
                        >
                          {rowItems.map((prod, j) => {
                            const realIndex = startIdx + j;
                            const cartInfo = cartInfoById.get(prod.id);
                            return (
                              <ProductCard
                                key={prod.id}
                                prod={prod}
                                index={realIndex}
                                isFocused={focusedItemIndex === realIndex}
                                inCartBoxes={cartInfo?.boxes || 0}
                                inCartPieces={cartInfo?.pieces || 0}
                                onAdd={addToCart}
                                onAddPiece={(p) => addToCart(p, true)}
                                onViewScientific={onViewScientific}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Active Sale Cart & Lebanese Dual-Currency Checkout */}
      <div className={`flex w-full shrink-0 lg:w-[360px] xl:w-[450px] 2xl:w-[530px] flex-col ${cartPosition === 'right' ? 'border-l' : 'border-r'} border-gray-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all`}>
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-slate-800 bg-gray-50 dark:bg-slate-900">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200">
              Current Sale ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400 cursor-pointer"
              >
                Clear Cart
              </button>
            )}
            <button
              onClick={() => {
                const newPos = cartPosition === 'right' ? 'left' : 'right';
                setCartPosition(newPos);
                localStorage.setItem('pos_cart_position', newPos);
              }}
              title={`Move Cart to ${cartPosition === 'right' ? 'Left' : 'Right'}`}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Customer Selector */}
        <div className="p-2.5 border-b border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center space-x-2">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Cash Client</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) {c.balanceUSD > 0 ? `• Debt: $${c.balanceUSD}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-3 mt-2 flex items-center rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs">
              <Receipt className="h-8 w-8 text-gray-300 mb-2 dark:text-slate-700" />
              <span>Cart is empty. Select medications or search items.</span>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartItemId || `${item.product.id}-${item.isPiece ? 'piece' : 'box'}-${Math.random()}`}
                className="flex flex-col md:flex-row md:items-center justify-between rounded border border-gray-200 bg-slate-50/50 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/40 gap-1"
              >
                <div className="flex-1 pr-1 min-w-0">
                  <div className="flex items-center gap-1 overflow-hidden">
                    <span className="font-bold text-[10px] text-slate-900 dark:text-slate-100 truncate shrink-0 max-w-[120px] 2xl:max-w-[160px]" title={item.product.name}>
                      {item.product.name}{item.isPiece && <span className="ml-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-0.5 rounded text-[8px] font-bold uppercase tracking-wider">({item.product.pieceName || 'Pc'})</span>}
                    </span>
                    <span
                      className="inline-flex items-center gap-0.5 rounded bg-teal-50 px-1 py-0 text-[8px] font-bold text-teal-800 border border-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/80 shrink-0"
                      title="Pharmacist Margin Profit"
                    >
                      <span className="opacity-80">Mrg:</span>
                      <span className="font-mono">{item.product.pharmacistMarginProfit ?? 0}%</span>
                    </span>
                  </div>
                  {item.product.batches && item.product.batches.length > 0 && (
                    <div className="mt-1 flex items-center w-full">
                      <select
                        value={item.selectedBatchNumber && item.selectedExpiryDate ? `${item.selectedBatchNumber}||${item.selectedExpiryDate}` : ''}
                        onChange={(e) => updateBatch(item.cartItemId!, e.target.value)}
                        style={{ minHeight: '22px', display: 'block' }}
                        className="w-full max-w-[220px] appearance-auto text-[10px] bg-white border border-gray-300 rounded px-1.5 py-0.5 text-slate-700 focus:outline-hidden focus:border-teal-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs"
                      >
                        <option value="">Auto-Select Expiry</option>
                        {item.product.batches.map(b => (
                          <option key={`${b.batchNumber}-${b.expiryDate}`} value={`${b.batchNumber}||${b.expiryDate}`}>
                            Exp: {b.expiryDate} (Batch: {b.batchNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.cartItemId!, -1)}
                    className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <input
                    type="number"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setAbsoluteQuantity(item.cartItemId!, 0);
                      } else {
                        setAbsoluteQuantity(item.cartItemId!, parseInt(val, 10));
                      }
                    }}
                    min="0"
                    max={item.isPiece && item.product.piecesPerBox ? item.product.stockQuantity * item.product.piecesPerBox : item.product.stockQuantity}
                    className="w-7 text-center font-bold text-[10px] text-slate-800 dark:text-slate-100 bg-transparent border border-gray-300 dark:border-slate-700 rounded h-4 focus:outline-hidden focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => updateQuantity(item.cartItemId!, 1)}
                    className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>

                  {/* Unit Price Editor */}
                  <div className="flex items-center rounded border border-gray-300 bg-white px-0.5 h-4 text-xs focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 shadow-2xs" title="Unit Price (USD)">
                    <span className="text-[9px] font-bold text-gray-400 select-none mr-0.5 dark:text-slate-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPriceUSD === 0 ? '' : Number(item.unitPriceUSD.toString()) /* using string avoids trailing zeros changing randomly, but number is fine */}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateUnitPrice(item.cartItemId!, val === '' ? 0 : parseFloat(val));
                      }}
                      placeholder="0.00"
                      className="w-9 text-center font-mono text-[9px] font-bold text-slate-800 bg-transparent focus:outline-hidden dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  {/* Discount per item box */}
                  <div
                    className={`flex items-center rounded border px-0.5 h-4 text-xs transition-all shadow-2xs ${
                      item.discountPercent > 0
                        ? 'border-teal-400 bg-teal-50 dark:border-teal-600 dark:bg-teal-950/60 ring-1 ring-teal-400/40'
                        : item.discountPercent < 0
                        ? 'border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/60 ring-1 ring-rose-400/40'
                        : 'border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-800 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500'
                    }`}
                    title="Item Discount Percentage (%)"
                  >
                    <span className={`text-[9px] font-bold select-none mr-0.5 ${
                      item.discountPercent > 0 ? 'text-teal-700 dark:text-teal-300' : item.discountPercent < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-gray-400 dark:text-slate-400'
                    }`}>
                      %
                    </span>
                    <input
                      type="number"
                      max="100"
                      value={item.discountPercent === 0 ? '' : item.discountPercent}
                      onChange={(e) => {
                        // The browser's number input natively handles the minus sign while typing
                        const val = e.target.value;
                        updateDiscount(item.cartItemId!, val === '' ? 0 : parseFloat(val));
                      }}
                      placeholder="0"
                      className="w-5 text-center font-mono text-[9px] font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Line Total with applied discount display */}
                  <div className="w-12 text-right font-mono font-bold text-blue-600 dark:text-blue-400 flex flex-col items-end justify-center leading-none">
                    {item.discountPercent > 0 && (
                      <span className="text-[8px] font-medium text-gray-400 line-through dark:text-slate-500">
                        ${(item.unitPriceUSD * item.quantity).toFixed(2)}
                      </span>
                    )}
                    <span className={`text-[10px] ${item.discountPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      ${(item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100)).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.cartItemId!)}
                    className="rounded p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment Drawer */}
        <div 
          className="border-t border-gray-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900/90 space-y-1"
        >
          {/* Dual Currency Totals */}
          <div 
            className="rounded-lg border border-teal-200 bg-teal-50/80 p-1.5 shadow-2xs dark:border-teal-900/50 dark:bg-teal-950/35"
          >
            {/* Total Discount Row placed directly at top of Total USD */}
            <div className={`flex items-baseline justify-between pb-1 mb-1 border-b transition-colors ${
              totalDiscountUSD > 0
                ? 'border-emerald-200/90 dark:border-emerald-800/60'
                : 'border-teal-200/50 dark:border-teal-900/30'
            }`}>
              <span className={`text-[10px] font-semibold flex items-center gap-1.5 ${
                totalDiscountUSD > 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-500 dark:text-slate-400'
              }`}>
                <Tag className="h-2.5 w-2.5" />
                Total Discount:
              </span>
              <div className="text-right">
                <span className={`text-[10px] font-mono font-bold ${
                  totalDiscountUSD > 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-gray-500 dark:text-slate-400'
                }`}>
                  {totalDiscountUSD > 0 ? `-$${totalDiscountUSD.toFixed(2)} USD` : '$0.00 USD'}
                </span>
                {totalDiscountLBP > 0 && (
                  <span className="ml-1 text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-mono">
                    (-{formatLBPValue(totalDiscountLBP)} LBP)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-bold text-teal-900 dark:text-teal-200">
                Subtotal (Excl. Tax):
              </span>
              <span className="text-[11px] font-mono font-bold text-teal-700 dark:text-teal-400 leading-none">
                ${subtotalUSD.toFixed(2)}
              </span>
            </div>

            {totalTaxUSD > 0 && (
              <div className="flex items-baseline justify-between mb-1 pb-1 border-b border-teal-200/50 dark:border-teal-900/30">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Percent className="h-2.5 w-2.5" />
                  VAT Added:
                </span>
                <div className="text-right">
                  <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 leading-none">
                    +${totalTaxUSD.toFixed(2)}
                  </span>
                  <span className="ml-1 text-[9px] text-amber-600/80 dark:text-amber-400/80 font-mono">
                    (+{formatLBPValue(totalTaxLBP)} LBP)
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200">
                Total (USD):
              </span>
              <span className="text-base font-mono font-extrabold text-teal-700 dark:text-teal-400 leading-none">
                ${totalUSD.toFixed(2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1 pt-0.5 border-t border-teal-200/50 dark:border-teal-900/30">
              <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">
                Total (L.L.):
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
{formatLBPValue(totalLBP)}
              </span>
            </div>
            
            {marginPercent > 0 && (
              <div className="flex items-baseline justify-between mt-0.5 pt-0.5 border-t border-teal-200/50 dark:border-teal-900/30">
                <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">
                  Margin:
                </span>
                <span className="text-[10px] font-mono font-bold text-green-600 dark:text-green-400">
                  {marginPercent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Tendered Cash Inputs */}
          <div className="space-y-1 mt-1">
            <div className="flex gap-1 text-[10px] w-full">
              {/* USD Input Card */}
              <div 
                className="flex-1 bg-white dark:bg-slate-800/80 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
                    Given USD ($)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {tenderedUSD && (
                      <button
                        type="button"
                        onClick={() => setTenderedUSD('')}
                        className="text-[9px] font-semibold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Clear USD"
                      >
                        Clear
                      </button>
                    )}
                    {totalUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTenderedUSD(totalUSD.toFixed(2));
                          setTenderedLBP('');
                          setPaymentMethod('cash_usd');
                        }}
                        className="text-[9px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                        title="Set exact total in USD"
                      >
                        Exact ${totalUSD.toFixed(2)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-1.5 top-1 text-[10px] text-gray-400 font-bold">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tenderedUSD}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTenderedUSD(val);
                      if (val && !tenderedLBP) {
                        setPaymentMethod('cash_usd');
                      } else if (val && tenderedLBP) {
                        setPaymentMethod('mixed');
                      }
                    }}
                    placeholder={totalUSD > 0 ? totalUSD.toFixed(2) : '0.00'}
                    className="w-full rounded border border-gray-300 bg-gray-50 pl-4 pr-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* LBP Input Card */}
              <div 
                className="flex-1 bg-white dark:bg-slate-800/80 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
                    Given LBP (L.L.)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {tenderedLBP && (
                      <button
                        type="button"
                        onClick={() => setTenderedLBP('')}
                        className="text-[9px] font-semibold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Clear LBP"
                      >
                        Clear
                      </button>
                    )}
                    {totalLBP > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTenderedLBP(formatLBPValue(totalLBP));
                          setTenderedUSD('');
                          setPaymentMethod('cash_lbp');
                        }}
                        className="text-[9px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                        title="Set exact total in LBP"
                      >
                        Exact L.L.
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tenderedLBP}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!raw.trim()) {
                        setTenderedLBP('');
                        return;
                      }
                      // Strip all non-digit characters
                      const digits = raw.replace(/\D/g, '');
                      if (!digits) {
                        setTenderedLBP('');
                        return;
                      }
                      // Detect if backspace deleted a comma without altering digits
                      const prevDigits = tenderedLBP.replace(/\D/g, '');
                      let finalDigits = digits;
                      if (raw.length < tenderedLBP.length && digits === prevDigits && digits.length > 0) {
                        finalDigits = digits.slice(0, -1);
                      }
                      // Automatically insert comma every 3 digits
                      const formatted = finalDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                      setTenderedLBP(formatted);
                      if (formatted && !tenderedUSD) {
                        setPaymentMethod('cash_lbp');
                      } else if (formatted && tenderedUSD) {
                        setPaymentMethod('mixed');
                      }
                    }}
                    placeholder={totalLBP > 0 ? formatLBPValue(totalLBP) : '0'}
                    className="w-full rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Change Display */}
          <div 
            className="transition-all"
          >
            {isOverpaid ? (
              <div className="flex flex-col gap-0.5 rounded-lg border border-emerald-300 bg-emerald-50/95 p-1.5 text-[10px] text-emerald-950 shadow-xs dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <Banknote className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Change to Return:
                  </span>
                  <span className="font-mono text-sm font-extrabold text-emerald-700 dark:text-emerald-300 leading-none">
{formatLBPValue(changeLBP)} LBP
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="text-emerald-800/80 dark:text-emerald-300/80">Equivalent in USD:</span>
                  <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200">
                    ${changeUSD.toFixed(2)} USD
                  </span>
                </div>
              </div>
            ) : isExactPayment ? (
              <div className="flex items-center justify-between rounded-lg border border-teal-300 bg-teal-50/90 p-1.5 text-[10px] text-teal-900 shadow-xs dark:border-teal-700/60 dark:bg-teal-950/40 dark:text-teal-200">
                <span className="font-bold text-[10px] uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1">
                  <Banknote className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                  Exact Payment:
                </span>
                <span className="font-bold text-teal-700 dark:text-teal-300">
                  No Change Required ($0.00 / 0 LBP)
                </span>
              </div>
            ) : isUnderpaid ? (
              <div className="flex flex-col gap-0.5 rounded-lg border border-amber-300 bg-amber-50/90 p-1.5 text-[10px] text-amber-950 shadow-xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    Remaining Balance Due:
                  </span>
                  <span className="font-mono font-bold text-amber-900 dark:text-amber-200 text-xs">
{formatLBPValue(remainingLBP)} LBP
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-amber-800/90 dark:text-amber-300/90 pt-0.5 border-t border-amber-200/60 dark:border-amber-900/40">
                  <span>Shortage:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    -${remainingUSD.toFixed(2)} USD
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-300 bg-gray-50/70 px-2 py-1 text-[10px] text-gray-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                <span className="text-[10px] font-medium flex items-center gap-1">
                  <Banknote className="h-3 w-3 text-gray-400" />
                  Change Calculator:
                </span>
                <span className="text-[10px] italic">Enter received cash in USD or LBP</span>
              </div>
            )}
          </div>

          {/* Checkout & Write Off Option */}
          <div className="flex gap-1.5 items-stretch h-8 mt-1">
            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className={`flex-1 flex items-center justify-center space-x-1 rounded-lg px-2 text-[10px] font-bold shadow-xs transition-all cursor-pointer uppercase tracking-wider ${
                isUnderpaid && !writeOffDifferences
                  ? 'bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.99]'
                  : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.99]'
              } disabled:opacity-40`}
            >
              <span className="truncate">
                {isUnderpaid
                  ? writeOffDifferences
                    ? `Complete Sale (Write Off $${remainingUSD.toFixed(2)}) & Print`
                    : `Check "Write Off" to Accept`
                  : 'Complete Sale & Print'}
              </span>
              <ArrowRight className="h-3 w-3 shrink-0" />
            </button>

            {/* Option: Write Off Differences */}
            <div
              className={`flex items-center rounded-lg border px-2 transition-all shrink-0 ${
                isUnderpaid
                  ? writeOffDifferences
                    ? 'border-teal-400 bg-teal-50/90 text-teal-950 dark:border-teal-700/60 dark:bg-teal-950/40 dark:text-teal-100 ring-1 ring-teal-400/40 shadow-xs'
                    : 'border-amber-400 bg-amber-50/90 text-amber-950 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100 ring-1 ring-amber-400/50 shadow-xs'
                  : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-800/40'
              }`}
            >
              <label className="flex items-center gap-2 cursor-pointer select-none h-full">
                <input
                  type="checkbox"
                  checked={writeOffDifferences}
                  onChange={(e) => {
                    setWriteOffDifferences(e.target.checked);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="h-3 w-3 rounded border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 cursor-pointer accent-teal-600"
                />
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider leading-none">
                    Write off
                  </span>
                  {isUnderpaid && (
                    <span className="font-mono text-[9px] font-extrabold text-rose-600 dark:text-rose-400 leading-none mt-0.5">
                      -${remainingUSD.toFixed(2)}
                    </span>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Payment Type Confirmation Modal */}
      {showPaymentConfirmModal && selectedCust && (
        <DesktopWindow
          title="Payment Confirmation"
          isOpen={true}
          section="sale"
          onClose={() => setShowPaymentConfirmModal(false)}
          width="480px"
          height="auto"
        >
          <div className="p-5 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            <div className="flex items-center space-x-2.5">
              <div className="rounded-lg bg-teal-100 p-2 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Record Transaction
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose how to record this transaction for {selectedCust.name}
                </p>
              </div>
            </div>

            {/* Customer & Sale Summary */}
            <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-slate-400">Customer:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedCust.name} {selectedCust.phone ? `(${selectedCust.phone})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-slate-400">Current Outstanding Debt:</span>
                <span className={`font-mono font-bold ${selectedCust.balanceUSD > 0 || selectedCust.balanceLBP > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  ${selectedCust.balanceUSD.toFixed(2)} / {formatLBPValue(selectedCust.balanceLBP)} LBP
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80">
                <span className="font-bold text-slate-700 dark:text-slate-300">Transaction Total:</span>
                <div className="text-right font-mono">
                  <span className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
                    ${totalUSD.toFixed(2)}
                  </span>
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
{formatLBPValue(totalLBP)} LBP
                  </span>
                </div>
              </div>
              {hasEnteredPayment && (
                <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200 dark:border-slate-700 text-[11px]">
                  <span className="text-gray-500 dark:text-slate-400">Tendered Cash:</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                    {paidUSD > 0 ? `$${paidUSD.toFixed(2)} ` : ''}
                    {paidLBP > 0 ? `${formatLBPValue(paidLBP)} LBP` : ''}
                    {isOverpaid && ` (Change: ${formatLBPValue(changeLBP)} LBP)`}
                  </span>
                </div>
              )}
              {hasEnteredPayment && isUnderpaid && (
                <div className="flex justify-between items-center pt-1 border-t border-dashed border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                  <span>Payment Difference:</span>
                  <span>-${remainingUSD.toFixed(2)} ({formatLBPValue(remainingLBP)} LBP)</span>
                </div>
              )}
              {hasEnteredPayment && isUnderpaid && writeOffDifferences && (
                <div className="text-[10px] text-teal-800 dark:text-teal-200 font-semibold bg-teal-50 dark:bg-teal-950/60 p-2 rounded border border-teal-200 dark:border-teal-900">
                  ✓ "Write off differences" is active. The shortage of ${remainingUSD.toFixed(2)} will be forgiven upon saving as cash.
                </div>
              )}
              {hasEnteredPayment && isUnderpaid && !writeOffDifferences && (
                <div className="text-[10px] text-amber-800 dark:text-amber-200 font-semibold bg-amber-50 dark:bg-amber-950/60 p-2 rounded border border-amber-200 dark:border-amber-900">
                  ⚠ Payment is short. To accept as cash, close and check "Write off differences", or choose "Save as Debt Transaction" below.
                </div>
              )}
            </div>

            {/* Action Selection */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeCompleteSale('cash')}
                className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-teal-500/80 bg-teal-50/50 hover:bg-teal-100/70 dark:bg-teal-950/30 dark:hover:bg-teal-950/50 transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="rounded-md bg-teal-600 p-2 text-white group-hover:scale-105 transition-transform">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-extrabold text-teal-950 dark:text-teal-200">
                      Save as Cash Transaction
                    </span>
                    <span className="block text-[11px] text-teal-700/80 dark:text-teal-300/80">
                      Payment received in cash. Customer debt balance will not be charged.
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 ml-2" />
              </button>

              <button
                type="button"
                onClick={() => executeCompleteSale('debt')}
                className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-purple-500/80 bg-purple-50/50 hover:bg-purple-100/70 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="rounded-md bg-purple-600 p-2 text-white group-hover:scale-105 transition-transform">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-extrabold text-purple-950 dark:text-purple-200">
                      Save as Debt Transaction
                    </span>
                    <span className="block text-[11px] text-purple-700/80 dark:text-purple-300/80">
                      Total ${totalUSD.toFixed(2)} ({formatLBPValue(totalLBP)} LBP) will be registered as debt for this customer.
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 ml-2" />
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentConfirmModal(false)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel & Back to Cart
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* Printable Receipt Modal */}
      {lastCompletedSale && (
        <ReceiptModal
          sale={lastCompletedSale}
          settings={settings}
          onClose={() => setLastCompletedSale(null)}
        />
      )}
    </div>
  );
};
