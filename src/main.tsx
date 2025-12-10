import React from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import './index.css'

// Initialize Vercel Web Analytics
inject();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
