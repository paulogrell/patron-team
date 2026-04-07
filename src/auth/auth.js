/**
 * Módulo de autenticação — Arjen Queue
 *
 * Utiliza a Web Crypto API (nativa do navegador) para gerar hash SHA-256
 * da senha informada e compará-la com o hash armazenado em variável de
 * ambiente (VITE_AUTH_PASSWORD_HASH). A senha nunca é exposta no código-fonte.
 *
 * Sessão: armazenada em sessionStorage para persistir durante a aba ativa.
 */

const AUTH_USER = import.meta.env.VITE_AUTH_USER || 'admin';
const AUTH_HASH = import.meta.env.VITE_AUTH_PASSWORD_HASH || '';
const SESSION_KEY = 'arjen_auth_session';

/**
 * Gera o hash SHA-256 de uma string usando a Web Crypto API.
 * @param {string} text — texto a ser hasheado
 * @returns {Promise<string>} — hash em hexadecimal
 */
export async function hashPassword(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  // Converte ArrayBuffer para string hexadecimal
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifica se o usuário e senha correspondem às credenciais configuradas.
 * @param {string} username — nome de usuário
 * @param {string} password — senha em texto puro (será hasheada para comparação)
 * @returns {Promise<boolean>} — true se as credenciais são válidas
 */
export async function verifyCredentials(username, password) {
  if (!AUTH_HASH) {
    console.warn('⚠️ VITE_AUTH_PASSWORD_HASH não configurado. Autenticação desativada.');
    return true;
  }

  if (username !== AUTH_USER) {
    return false;
  }

  const inputHash = await hashPassword(password);
  return inputHash === AUTH_HASH;
}

/**
 * Verifica se há uma sessão autenticada ativa no sessionStorage.
 * @returns {boolean}
 */
export function isAuthenticated() {
  // Se o hash não está configurado, considera autenticado (sem proteção)
  if (!AUTH_HASH) return true;
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

/**
 * Salva a sessão de autenticação no sessionStorage.
 */
export function saveSession() {
  sessionStorage.setItem(SESSION_KEY, 'true');
}

/**
 * Remove a sessão de autenticação (logout).
 */
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

