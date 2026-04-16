import React, { useCallback, useState } from 'react';
import { readAppliedTheme, toggleStoredTheme, syncThemeColorMeta } from '../theme.js';

/**
 * Botão que alterna tema claro/escuro e persiste em localStorage.
 */
export default function ThemeToggle({ className = '', labelLight = 'Modo escuro', labelDark = 'Modo claro' }) {
  const [dark, setDark] = useState(() => readAppliedTheme() === 'dark');

  const onClick = useCallback(() => {
    const next = toggleStoredTheme();
    setDark(next === 'dark');
    syncThemeColorMeta();
  }, []);

  return (
    <button
      type="button"
      className={`btn-theme-toggle ${className}`.trim()}
      onClick={onClick}
      title={dark ? labelDark : labelLight}
      aria-label={dark ? labelDark : labelLight}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
