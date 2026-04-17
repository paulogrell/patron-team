import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { applyTheme, getInitialTheme, syncThemeColorMeta } from './theme.js';

applyTheme(getInitialTheme());
syncThemeColorMeta();

/**
 * Ponto de entrada da aplicação.
 * Renderiza o componente App no elemento #root.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

