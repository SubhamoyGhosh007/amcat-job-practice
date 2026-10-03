import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './app/router';
import { isDbConfigured } from './lib/supabase';
import './amcat.css';
import './landing/landing.css';
import './modern.css';
import './ui/shadcn.css';
import './ui/tailwind.css';
import './mobile.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDbConfigured() ? (
      <AppRouter />
    ) : (
      <div style={{ fontFamily: 'sans-serif', maxWidth: 560, margin: '60px auto', padding: 24 }}>
        <h2>Database is not configured</h2>
        <p>Add <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> to <b>.env</b> (see .env.example) and rebuild.</p>
      </div>
    )}
  </React.StrictMode>
);
