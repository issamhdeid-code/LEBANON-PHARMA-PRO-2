import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';

// Suppress benign ResizeObserver notifications across all browsers/environments
const isResizeObserverError = (msg: unknown) => {
  if (!msg) return false;
  const text = typeof msg === 'string' ? msg : typeof msg === 'object' && 'message' in (msg as any) ? String((msg as any).message) : '';
  return text.includes('ResizeObserver') || text.includes('undelivered notifications');
};

const prevOnError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (isResizeObserverError(message) || (error && isResizeObserverError(error.message))) {
    return true;
  }
  if (typeof prevOnError === 'function') {
    return prevOnError(message, source, lineno, colno, error);
  }
  return false;
};

window.addEventListener(
  'error',
  (e: ErrorEvent) => {
    const msg = e.message || (e.error && e.error.message) || '';
    if (isResizeObserverError(msg)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true
);

window.addEventListener(
  'unhandledrejection',
  (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const msg = typeof reason === 'string' ? reason : (reason && reason.message) || '';
    if (isResizeObserverError(msg)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
