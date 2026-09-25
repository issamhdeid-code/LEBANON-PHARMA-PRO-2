import React, { useEffect, useRef, useState } from 'react';

interface PickedElement {
  tag: string;
  id: string;
  className: string;
  role: string;
  title: string;
  ariaLabel: string;
  type: string;
  value: string;
  placeholder: string;
  text: string;
  selector: string;
  time: number;
}

const UTILITY_CLASS_RE = /^(flex|grid|w-|h-|p-|m-|gap|text-|bg-|rounded|border|shadow|focus|hover|dark:)/;

const cssPathOf = (el: HTMLElement): string => {
  const parts: string[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.documentElement && parts.length < 6) {
    let seg = node.tagName ? node.tagName.toLowerCase() : '';
    if (node.id) seg += '#' + node.id;
    if (!seg && node.dataset && node.dataset.testid) seg = '[data-testid="' + node.dataset.testid + '"]';
    if (node.className && typeof node.className === 'string') {
      const cls = node.className.split(/\s+/).filter((c) => c && !UTILITY_CLASS_RE.test(c)).slice(0, 2);
      if (cls.length) seg += '.' + cls.join('.');
    }
    if (seg) parts.unshift(seg);
    node = node.parentElement;
  }
  return parts.length ? parts.join(' > ') : el.tagName.toLowerCase();
};

const describeOf = (el: HTMLElement): PickedElement => {
  let value = '';
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
    value = (el as HTMLInputElement).value || '';
  }
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    className: typeof el.className === 'string' ? el.className : '',
    role: el.getAttribute ? el.getAttribute('role') || '' : '',
    title: el.getAttribute ? el.getAttribute('title') || '' : '',
    ariaLabel: el.getAttribute ? el.getAttribute('aria-label') || '' : '',
    type: el.getAttribute ? el.getAttribute('type') || '' : '',
    value,
    placeholder: el.getAttribute ? el.getAttribute('placeholder') || '' : '',
    text: (el.innerText || el.textContent || '').trim().slice(0, 120),
    selector: cssPathOf(el),
    time: Date.now(),
  };
};

const rootZoom = (): number => {
  const raw = typeof document !== 'undefined' ? document.documentElement.style.zoom : '';
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n / 100 : 1;
};

const FLOAT_STYLE: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 2147483647,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  background: '#0f172a',
  color: '#fff',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  padding: '8px 10px',
  borderRadius: 10,
  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
};

export const DevElementPicker: React.FC = () => {
  const [enabled] = useState<boolean>(
    () => typeof window !== 'undefined' && window.localStorage.getItem('lp_dev_picker') === '1'
  );
  const [mode, setMode] = useState<boolean>(false);
  const [pick, setPick] = useState<PickedElement | null>(null);
  const hlRef = useRef<HTMLDivElement | null>(null);
  const lbRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const hl = document.createElement('div');
    hl.style.cssText =
      'position:fixed;z-index:2147483646;pointer-events:none;outline:3px solid #f59e0b;outline-offset:-1px;background:rgba(245,158,11,0.12);display:none;';
    const lb = document.createElement('div');
    lb.style.cssText =
      'position:fixed;z-index:2147483647;pointer-events:none;background:#1e293b;color:#fff;font:12px/1.4 system-ui,sans-serif;padding:4px 8px;border-radius:6px;max-width:560px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:none;box-shadow:0 2px 8px rgba(0,0,0,0.35);';
    document.body.appendChild(hl);
    document.body.appendChild(lb);
    hlRef.current = hl;
    lbRef.current = lb;
    return () => {
      hl.remove();
      lb.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !mode) return;
    const hl = hlRef.current;
    const lb = lbRef.current;

    const isPickerUi = (el: Node | null): boolean => {
      if (!el) return false;
      const bar = barRef.current;
      return el === hl || el === lb || (bar !== null && (el === bar || bar.contains(el)));
    };

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || isPickerUi(el) || el === document.body) {
        if (hl) hl.style.display = 'none';
        if (lb) lb.style.display = 'none';
        return;
      }
      const r = el.getBoundingClientRect();
      const z = rootZoom();
      if (hl) {
        hl.style.display = 'block';
        hl.style.left = r.left / z + 'px';
        hl.style.top = r.top / z + 'px';
        hl.style.width = r.width / z + 'px';
        hl.style.height = r.height / z + 'px';
      }
      if (lb) {
        const cls = el.getAttribute('class');
        lb.textContent =
          cssPathOf(el) +
          '  ·  ' +
          el.tagName.toLowerCase() +
          (el.id ? '#' + el.id : '') +
          (cls ? ' .' + cls.split(/\s+/).slice(0, 2).join(' .') : '');
        lb.style.left = Math.min(r.left / z, window.innerWidth - 580) + 'px';
        lb.style.top = (r.top < 30 ? r.bottom + 6 : r.top - 26) / z + 'px';
        lb.style.display = 'block';
      }
    };

    const onClick = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || isPickerUi(el)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const info = describeOf(el);
      (window as unknown as { __lpPick?: PickedElement }).__lpPick = info;
      setPick(info);
      setMode(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode(false);
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    document.body.style.cursor = 'crosshair';
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.cursor = '';
      if (hl) hl.style.display = 'none';
      if (lb) lb.style.display = 'none';
    };
  }, [enabled, mode]);

  if (!enabled) return null;

  return (
    <>
      <div ref={barRef} style={FLOAT_STYLE}>
        <button
          type="button"
          onClick={() => setMode((m) => !m)}
          style={{
            background: mode ? '#7c3aed' : '#f59e0b',
            color: '#111',
            border: 0,
            borderRadius: 6,
            padding: '6px 10px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {mode ? '✋ Picking…' : '🔍 Pick element'}
        </button>
        <span style={{ opacity: 0.8 }}>{mode ? 'click target · Esc to quit' : 'hover → click to pick'}</span>
      </div>
      {pick && (
        <div
          style={{
            position: 'fixed',
            right: 16,
            bottom: 70,
            zIndex: 2147483647,
            background: '#0f172a',
            color: '#e2e8f0',
            fontSize: 12,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.5,
            padding: '12px 14px',
            borderRadius: 10,
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            maxWidth: 440,
          }}
        >
          <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>ELEMENT PICKED ✓ — tell your assistant</div>
          <div>
            <b>Selector:</b> <code style={{ color: '#7dd3fc' }}>{pick.selector}</code>
          </div>
          <div>
            <b>Tag:</b> {pick.tag}
            {pick.id ? ' #' + pick.id : ''}
          </div>
          {pick.className ? (
            <div>
              <b>Class:</b> {pick.className}
            </div>
          ) : null}
          {pick.text ? (
            <div>
              <b>Text:</b> {pick.text}
            </div>
          ) : null}
          {pick.value !== '' ? (
            <div>
              <b>Value:</b> {pick.value}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setPick(null)}
            style={{
              marginTop: 8,
              background: '#334155',
              color: '#fff',
              border: 0,
              borderRadius: 6,
              padding: '5px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            OK
          </button>
        </div>
      )}
    </>
  );
};