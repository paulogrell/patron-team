import React, { useState } from 'react';
import { verifyCredentials, saveSession } from '../auth/auth.js';

/**
 * LoginScreen — Tela de autenticação exibida antes do acesso à aplicação.
 * Valida as credenciais comparando o hash SHA-256 da senha informada
 * com o hash armazenado em variável de ambiente.
 *
 * @param {Object} props
 * @param {Function} props.onLogin — callback executado após login bem-sucedido
 */
export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const valid = await verifyCredentials(username, password);

      if (valid) {
        saveSession();
        onLogin();
      } else {
        setError('Usuário ou senha inválidos.');
      }
    } catch (err) {
      console.error('Erro na autenticação:', err);
      setError('Erro ao verificar credenciais. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-header">
          <span className="login-icon">⚽</span>
          <h1>Arjen</h1>
          <p>Fila de Times</p>
        </div>

        <div className="login-field">
          <label htmlFor="login-user">Usuário</label>
          <input
            id="login-user"
            className="input-text"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Digite seu usuário"
            autoFocus
            required
            disabled={loading}
          />
        </div>

        <div className="login-field">
          <label htmlFor="login-pass">Senha</label>
          <input
            id="login-pass"
            className="input-text"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            required
            disabled={loading}
          />
        </div>

        {error && <p className="login-error">{error}</p>}

        <button
          className="btn btn-primary login-btn"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

