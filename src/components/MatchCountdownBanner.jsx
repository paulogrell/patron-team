import React from 'react';
import { formatCountdownRemainingMs } from '../domain/countdownFormat.js';

/**
 * Faixa compacta com tempo restante da partida agendada (um único countdown ativo).
 */
export default function MatchCountdownBanner({ subtitle, remainingMs }) {
  const expired = remainingMs <= 0;
  return (
    <div className="match-countdown-banner" role="status" aria-live="polite" data-testid="match-countdown-banner">
      <div className="match-countdown-banner-label">{subtitle}</div>
      <div
        className={`match-countdown-banner-time${expired ? ' match-countdown-expired' : ''}`}
      >
        {formatCountdownRemainingMs(remainingMs)}
      </div>
      {expired && <span className="match-timer-hint">Tempo esgotado</span>}
    </div>
  );
}
