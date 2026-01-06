
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("Mounting GymPro App...");

const mountApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("FATAL: Root element not found");
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    
    // Cleanup fallback if present
    const fallback = document.getElementById('loading-fallback');
    if (fallback) {
      setTimeout(() => {
        if (fallback.parentNode) {
          fallback.style.display = 'none';
        }
      }, 500);
    }
    console.log("Render triggered successfully");
  } catch (error) {
    console.error("Mounting error:", error);
    rootElement.innerHTML = `<div style="color: white; background: #ef4444; padding: 20px; font-family: sans-serif; border-radius: 8px; margin: 20px;">
      <h2 style="font-weight: 800; margin-bottom: 8px;">Critical System Error</h2>
      <p style="font-size: 14px;">${error instanceof Error ? error.message : String(error)}</p>
    </div>`;
  }
};

// Execute immediately since the script is type="module" and deferred by default
mountApp();
