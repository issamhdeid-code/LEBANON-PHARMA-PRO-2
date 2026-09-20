import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';

// Suppress benign ResizeObserver notifications across all browsers/environments
const isResizeObserverError = (msg: unknown) => {
  return typeof msg === 'string' && (msg.includes('ResizeObserver') || msg.includes('undelivered notifications'));
};

window.addEventListener('error', (e: ErrorEvent) => {
  const msg = e.message || (e.error && e.error.message) || '';
  if (isResizeObserverError(msg)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const reason = e.reason;
  const msg = typeof reason === 'string' ? reason : (reason && reason.message) || '';
  if (isResizeObserverError(msg)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
