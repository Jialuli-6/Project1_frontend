import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoutes from './AppRoutes'; // Import route configuration component

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <AppRoutes /> {/* Render route configuration component, as application entry point */}
  </React.StrictMode>
);