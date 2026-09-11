import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minDuration?: number;
  minCharacters?: number;
  cooldownMs?: number;
}

export const useBarcodeScanner = ({
  onScan,
  minDuration = 50,
  minCharacters = 3,
  cooldownMs = 400,
}: UseBarcodeScannerOptions) => {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);
  const scanStartedAt = useRef<number>(0);
  const lastHandledScanAt = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.isComposing) return;
    const target = e.target as HTMLElement | null;
    const isInput = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const now = Date.now();

    // Hardware scanners fire keystrokes with no human-sized pauses between them.
    // Any break longer than minDuration means the previous stream is not a scan.
    if (buffer.current.length > 0 && now - lastKeyTime.current > minDuration) {
      buffer.current = '';
      scanStartedAt.current = 0;
    }

    if (e.key === 'Enter') {
      const buffered = buffer.current;
      if (buffered.length >= minCharacters) {
        // Distinguish a scanner's trailing Enter (arrives immediately after the last
        // character) from a human pressing Enter after typing in a field. Also absorb
        // duplicated Enter keypresses some scanners emit (<Enter><Enter> / CRLF) via a
        // short cooldown so one barcode never fires twice.
        const gapFromLastKeyMs = now - lastKeyTime.current;
        const totalScanMs = now - scanStartedAt.current;
        const isPlausibleScan = buffered.length >= (minCharacters) &&
          gapFromLastKeyMs <= 100 &&
          totalScanMs <= 1500;
        if (isPlausibleScan && now - lastHandledScanAt.current >= cooldownMs) {
          lastHandledScanAt.current = now;
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(buffered);
          // Release the field the scanner typed into so its junk doesn't commit, but do
          // not steal focus — the consuming component decides where focus goes next.
          if (isInput && target && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            target.blur();
          }
        }
      }
      buffer.current = '';
      scanStartedAt.current = 0;
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (buffer.current.length === 0) scanStartedAt.current = now;
      buffer.current += e.key;
      // A held key or pasted garbage must not grow the buffer forever.
      if (buffer.current.length > 128) buffer.current = '';
      lastKeyTime.current = now;
    }
  }, [minDuration, minCharacters, cooldownMs]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown]);
};