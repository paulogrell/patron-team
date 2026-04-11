import React, { useState, useEffect } from 'react';

export default function EditPlayerModal({ player, onClose, onSave }) {
  const [name, setName] = useState(player?.name ?? '');

  useEffect(() => {
    setName(player?.name ?? '');
  }, [player]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(player.id, name);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-player-title">
      <div className="modal-content match-stats-modal">
        <h3 id="edit-player-title">Editar jogador</h3>
        <p className="modal-sub">Altere o nome exibido na fila e nos times.</p>
        <form onSubmit={handleSubmit}>
          <label className="modal-form-label" htmlFor="edit-player-name">
            Nome
          </label>
          <input
            id="edit-player-name"
            type="text"
            className="input-text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
