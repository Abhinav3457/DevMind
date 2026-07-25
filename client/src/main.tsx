import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { queryClient } from './api/queryClient';
import './index.css';

// Theme-aware toast styles use CSS classes defined in index.css instead of hardcoded hex values
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: 'theme-toast',
            style: {},
            success: { iconTheme: { primary: '#22c55e', secondary: 'var(--surface-100)' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'var(--surface-100)' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
