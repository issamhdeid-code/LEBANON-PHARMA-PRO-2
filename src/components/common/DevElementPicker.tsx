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

type EditAction =
  | {
      kind: 'rename';
      element: HTMLElement;
      beforeHtml: string;
    }
  | {
      kind: 'resize';
      element: HTMLElement;
      beforeWidth: string;
      beforeHeight: string;
    }
  | {
      kind: 'remove';
      element: HTMLElement;
      parent: Node;
      nextSibling: Node | null;
    };

const visibleTextOf = (el: HTMLElement): string =>
  (el.innerText || el.textContent || '').trim();

const hasDirectText = (el: HTMLElement): boolean =>
  Array.from(el.childNodes).some(
    (node) => node.nodeType === 3 && Boolean((node.textContent || '').trim())
  );

const canRenameElement = (el: HTMLElement): boolean => {
  const tag = el.tagName.toLowerCase();
  return !['input', 'textarea', 'select'].includes(tag) && (el.children.length === 0 || hasDirectText(el));
};

const setElementText = (el: HTMLElement, text: string): boolean => {
  if (!canRenameElement(el)) return false;
  const directText = Array.from(el.childNodes).find(
    (node) => node.nodeType === 3 && Boolean((node.textContent || '').trim())
  );
  if (directText) {
    directText.textContent = text;
  } else {
    el.textContent = text;
  }
  return true;
};


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

const EDITOR_LABEL_STYLE: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 11,
  fontWeight: 600,
};

const EDITOR_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 3,
  padding: '5px 7px',
  border: '1px solid #475569',
  borderRadius: 5,
  background: '#1e293b',
  color: '#fff',
  fontSize: 12,
};

const EDITOR_BUTTON_STYLE: React.CSSProperties = {
  border: 0,
  borderRadius: 6,
  padding: '5px 9px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
};

const EDITOR_SECONDARY_BUTTON_STYLE: React.CSSProperties = {
  ...EDITOR_BUTTON_STYLE,
  background: '#334155',
  color: '#fff',
};

const EDITOR_DANGER_BUTTON_STYLE: React.CSSProperties = {
  ...EDITOR_BUTTON_STYLE,
  background: '#7f1d1d',
  color: '#fff',
};


export const DevElementPicker: React.FC = () => {
  const [enabled] = useState<boolean>(
    () => typeof window !== 'undefined' && window.localStorage.getItem('lp_dev_picker') === '1'
  );
  const [mode, setMode] = useState<boolean>(false);
  const [pick, setPick] = useState<PickedElement | null>(null);
  const [renameText, setRenameText] = useState('');
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [history, setHistory] = useState<EditAction[]>([]);
  const [editorError, setEditorError] = useState('');
  const [editorNotice, setEditorNotice] = useState('');
  const [copyState, setCopyState] = useState('');
  const hlRef = useRef<HTMLDivElement | null>(null);
  const lbRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const pickCardRef = useRef<HTMLDivElement | null>(null);
  const selectedElRef = useRef<HTMLElement | null>(null);

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
      const card = pickCardRef.current;
      return (
        el === hl ||
        el === lb ||
        (bar !== null && (el === bar || bar.contains(el))) ||
        (card !== null && (el === card || card.contains(el)))
      );
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
      selectedElRef.current = el;
      setPick(info);
      setRenameText(visibleTextOf(el));
      setResizeWidth(el.style.width);
      setResizeHeight(el.style.height);
      setHistory([]);
      setEditorError('');
      setEditorNotice('');
      setCopyState('');
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

  const updatePick = (element: HTMLElement, resetEditorFields: boolean): void => {
    const info = describeOf(element);
    (window as unknown as { __lpPick?: PickedElement }).__lpPick = info;
    selectedElRef.current = element;
    setPick(info);
    if (resetEditorFields) {
      setRenameText(visibleTextOf(element));
      setResizeWidth(element.style.width);
      setResizeHeight(element.style.height);
    }
    setEditorError('');
    setEditorNotice('');
    setCopyState('');
  };

  const clearPick = (): void => {
    setPick(null);
    selectedElRef.current = null;
    setRenameText('');
    setResizeWidth('');
    setResizeHeight('');
    setHistory([]);
    setEditorError('');
    setEditorNotice('');
    setCopyState('');
  };

  const applyRename = (): void => {
    const element = selectedElRef.current;
    if (!element || !element.isConnected) {
      setEditorError('The selected element is no longer in the preview. Pick it again.');
      return;
    }
    if (!canRenameElement(element)) {
      setEditorError('Rename is available for text elements with direct text content.');
      return;
    }
    if (visibleTextOf(element) === renameText) return;
    const beforeHtml = element.innerHTML;
    if (!setElementText(element, renameText)) {
      setEditorError('This element cannot be renamed safely.');
      return;
    }
    const action: EditAction = { kind: 'rename', element, beforeHtml };
    setHistory((prev) => [...prev, action].slice(-50));
    updatePick(element, true);
  };

  const applyResize = (): void => {
    const element = selectedElRef.current;
    if (!element || !element.isConnected) {
      setEditorError('The selected element is no longer in the preview. Pick it again.');
      return;
    }
    const beforeWidth = element.style.width;
    const beforeHeight = element.style.height;
    const width = resizeWidth.trim();
    const height = resizeHeight.trim();
    if (beforeWidth === width && beforeHeight === height) return;
    if (width) element.style.width = width;
    else element.style.removeProperty('width');
    if (height) element.style.height = height;
    else element.style.removeProperty('height');
    if ((width && !element.style.width) || (height && !element.style.height)) {
      if (beforeWidth) element.style.width = beforeWidth;
      else element.style.removeProperty('width');
      if (beforeHeight) element.style.height = beforeHeight;
      else element.style.removeProperty('height');
      setEditorError('Use a valid CSS size, such as 320px or 50%.');
      return;
    }
    const action: EditAction = { kind: 'resize', element, beforeWidth, beforeHeight };
    setHistory((prev) => [...prev, action].slice(-50));
    updatePick(element, true);
  };

  const removeSelected = (): void => {
    const element = selectedElRef.current;
    if (!element || !element.isConnected) {
      setEditorError('The selected element is no longer in the preview. Pick it again.');
      return;
    }
    if (element === document.documentElement || element === document.body || element.id === 'root') {
      setEditorError('The document root cannot be removed from the preview.');
      return;
    }
    const parent = element.parentNode as Node | null;
    if (!parent) {
      setEditorError('This element cannot be removed safely.');
      return;
    }
    const nextSibling = element.nextSibling;
    updatePick(element, false);
    element.remove();
    const action: EditAction = { kind: 'remove', element, parent, nextSibling };
    setHistory((prev) => [...prev, action].slice(-50));
    setEditorNotice('Element removed from the preview. Use Undo to restore it.');
  };

  const undoLast = (): void => {
    const action = history[history.length - 1];
    if (!action) return;
    if (action.kind === 'rename') {
      if (!action.element.isConnected) {
        setEditorError('The changed element is no longer connected. Reload the preview to reset.');
        return;
      }
      action.element.innerHTML = action.beforeHtml;
    } else if (action.kind === 'resize') {
      if (!action.element.isConnected) {
        setEditorError('The changed element is no longer connected. Reload the preview to reset.');
        return;
      }
      if (action.beforeWidth) action.element.style.width = action.beforeWidth;
      else action.element.style.removeProperty('width');
      if (action.beforeHeight) action.element.style.height = action.beforeHeight;
      else action.element.style.removeProperty('height');
    } else {
      if (!action.parent.isConnected) {
        setEditorError('The original parent is no longer connected. Reload the preview to reset.');
        return;
      }
      action.parent.insertBefore(action.element, action.nextSibling);
    }
    setHistory((prev) => prev.slice(0, -1));
    updatePick(action.element, true);
    setEditorNotice('Last preview change undone.');
  };

  const copySelector = async (): Promise<void> => {
    if (!pick) return;
    try {
      await navigator.clipboard.writeText(pick.selector);
      setCopyState('Selector copied to clipboard.');
      setEditorError('');
    } catch {
      setCopyState('');
      setEditorError('Clipboard access was blocked. Copy the selector manually.');
    }
  };

  const selectedElement = selectedElRef.current;
  const selectedConnected = Boolean(selectedElement?.isConnected);
  const canRenameSelected = Boolean(selectedElement && canRenameElement(selectedElement));

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
          ref={pickCardRef}
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
            width: 440,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
            ELEMENT PICKED ✓ — PREVIEW EDITOR
          </div>
          <div style={{ color: '#94a3b8', marginBottom: 8 }}>
            Changes apply to this preview only. Reload to restore the source UI.
          </div>
          <div>
            <b>Selector:</b>{' '}
            <code style={{ color: '#7dd3fc', overflowWrap: 'anywhere' }}>{pick.selector}</code>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
            <label style={{ ...EDITOR_LABEL_STYLE, gridColumn: '1 / -1' }}>
              <span>Text</span>
              <input
                aria-label="Selected element text"
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
                disabled={!selectedConnected || !canRenameSelected}
                style={EDITOR_INPUT_STYLE}
              />
            </label>
            <label style={EDITOR_LABEL_STYLE}>
              <span>Width</span>
              <input
                aria-label="Selected element width"
                value={resizeWidth}
                onChange={(e) => setResizeWidth(e.target.value)}
                placeholder="e.g. 320px"
                disabled={!selectedConnected}
                style={EDITOR_INPUT_STYLE}
              />
            </label>
            <label style={EDITOR_LABEL_STYLE}>
              <span>Height</span>
              <input
                aria-label="Selected element height"
                value={resizeHeight}
                onChange={(e) => setResizeHeight(e.target.value)}
                placeholder="e.g. 48px"
                disabled={!selectedConnected}
                style={EDITOR_INPUT_STYLE}
              />
            </label>
          </div>
          {editorError ? (
            <div role="alert" style={{ color: '#fca5a5', marginTop: 8 }}>
              {editorError}
            </div>
          ) : null}
          {editorNotice ? (
            <div role="status" style={{ color: '#fbbf24', marginTop: 8 }}>
              {editorNotice}
            </div>
          ) : null}
          {copyState ? (
            <div role="status" style={{ color: '#86efac', marginTop: 8 }}>
              {copyState}
            </div>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={applyRename}
              disabled={!selectedConnected || !canRenameSelected}
              style={{ ...EDITOR_BUTTON_STYLE, background: '#0e7490', color: '#fff' }}
            >
              Apply text
            </button>
            <button
              type="button"
              onClick={applyResize}
              disabled={!selectedConnected}
              style={{ ...EDITOR_BUTTON_STYLE, background: '#0e7490', color: '#fff' }}
            >
              Apply size
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={!selectedConnected}
              style={EDITOR_DANGER_BUTTON_STYLE}
            >
              Remove
            </button>
            <button
              type="button"
              onClick={undoLast}
              disabled={history.length === 0}
              style={EDITOR_SECONDARY_BUTTON_STYLE}
            >
              Undo
            </button>
            <button type="button" onClick={copySelector} style={EDITOR_SECONDARY_BUTTON_STYLE}>
              Copy selector
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={EDITOR_SECONDARY_BUTTON_STYLE}
            >
              Reload preview
            </button>
            <button type="button" onClick={clearPick} style={EDITOR_SECONDARY_BUTTON_STYLE}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
};