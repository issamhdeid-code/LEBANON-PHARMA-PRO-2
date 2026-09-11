import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minDuration?: number;
  minCharacters?: number;
}

export const useBarcodeScanner = ({
  onScan,
  minDuration = 50,
  minCharacters = 3,
}: UseBarcodeScannerOptions) => {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(Date.now());
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime.current;

    if (timeDiff > minDuration && buffer.current.length > 0) {
      buffer.current = '';
    }

    lastKeyTime.current = currentTime;

    if (e.key === 'Enter') {
      if (buffer.current.length >= minCharacters) {
        onScanRef.current(buffer.current);
        if (isInput) {
          (target as HTMLInputElement).blur();
        }
        e.preventDefault();
      }
      buffer.current = '';
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      buffer.current += e.key;
    }
  }, [minDuration, minCharacters]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown]);
};
