import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import AppRouter from './app/router';
import './amcat.css';
import './landing/landing.css';
import './modern.css';
import './ui/shadcn.css';
import './ui/tailwind.css';

const key = String(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {key ? (
      <ClerkProvider publishableKey={key} afterSignOutUrl="/">
        <AppRouter />
      </ClerkProvider>
    ) : (
      <div style={{ fontFamily: 'sans-serif', maxWidth: 560, margin: '60px auto', padding: 24 }}>
        <h2>Auth is not configured</h2>
        <p>Add <b>VITE_CLERK_PUBLISHABLE_KEY</b> to <b>.env</b> (see .env.example) and rebuild.</p>
      </div>
    )}
  </React.StrictMode>
);
