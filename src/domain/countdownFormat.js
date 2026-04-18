/**
 * Formata milissegundos restantes para exibição (countdown).
 * Valores negativos são tratados como zero.
 * Até 59:59 → MM:SS; com horas → H:MM:SS (horas sem zero à esquerda).
 */
export function formatCountdownRemainingMs(remainingMs) {
  const ms = Math.max(0, Math.floor(Number(remainingMs) || 0));
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
