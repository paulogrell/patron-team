import React from 'react';

/**
 * Histórico de partidas da rodada (finalizadas e agendadas) com placar numérico.
 */
export default function MatchHistory({
  matches,
  teams,
  teamLabelById = {},
  matchScores,
  onEditStats,
  onEditScheduledMatch,
  onFinalize,
  onRequestDraw,
}) {
  const teamMap = {};
  for (const t of teams) {
    teamMap[t.id] = t;
  }

  const resultClass = {
    A_win: 'result-a-win',
    B_win: 'result-b-win',
    draw: 'result-draw',
  };

  const sortedMatches = [...matches].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const labelForTeam = (id) => {
    const t = teamMap[id];
    const fallback = teamLabelById[id] || 'Time';
    if (!t) return fallback;
    const tag = t.displayName?.trim() || fallback;
    return `${tag} (${t.players?.length || 0} jog.)`;
  };

  /** Nome curto para botões e resultado: displayName, ou Time A/B/C…, ou Lado A/B do confronto */
  const teamWinName = (teamId, match) => {
    const t = teamMap[teamId];
    const side = teamId === match.teamA ? 'A' : 'B';
    return t?.displayName?.trim() || teamLabelById[teamId] || `Lado ${side}`;
  };

  const outcomeText = (match) => {
    if (!match.result) return '';
    if (match.result === 'draw') return 'Empate';
    const winId = match.result === 'A_win' ? match.teamA : match.teamB;
    return `${teamWinName(winId, match)} venceu`;
  };

  const scoreLine = (match) => {
    const s = matchScores?.[match.id];
    if (!s) return '— × —';
    return `${s.scoreA} × ${s.scoreB}`;
  };

  return (
    <div className="panel history-panel">
      <h2>Partidas da rodada ({matches.length})</h2>
      {sortedMatches.length === 0 ? (
        <p className="empty-message">Nenhuma partida nesta rodada ainda.</p>
      ) : (
        <ul className="match-list">
          {sortedMatches.map((match) => (
            <li
              key={match.id}
              className={`match-item ${
                match.status === 'scheduled' ? 'match-scheduled' : resultClass[match.result] || ''
              }`}
            >
              <div className="match-card-stack">
                <div className="match-line-teams">
                  {labelForTeam(match.teamA)} × {labelForTeam(match.teamB)}
                  {match.status === 'scheduled' && (
                    <span className="badge-scheduled">Agendada</span>
                  )}
                </div>
                <div className="match-line-score">
                  <span className="match-score-nums">{scoreLine(match)}</span>
                </div>
                <div className="match-line-time">
                  {new Date(match.timestamp).toLocaleString('pt-BR')}
                </div>
                <div className="match-line-stats">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onEditStats(match)}
                  >
                    Stats
                  </button>
                  {match.status === 'scheduled' && onEditScheduledMatch && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => onEditScheduledMatch(match)}
                    >
                      Editar
                    </button>
                  )}
                </div>
                {match.status === 'finalized' && match.result && (
                  <div className="match-line-result-outcome">
                    <span className="match-score-result">{outcomeText(match)}</span>
                  </div>
                )}
                {match.status === 'scheduled' && (
                  <div className="match-line-finalize">
                    <button
                      type="button"
                      className="btn btn-match btn-a-win btn-sm"
                      title={labelForTeam(match.teamA)}
                      onClick={() => onFinalize(match.id, 'A_win')}
                    >
                      {teamWinName(match.teamA, match)} venceu
                    </button>
                    <button
                      type="button"
                      className="btn btn-match btn-draw btn-sm"
                      onClick={() => onRequestDraw(match)}
                    >
                      Empate
                    </button>
                    <button
                      type="button"
                      className="btn btn-match btn-b-win btn-sm"
                      title={labelForTeam(match.teamB)}
                      onClick={() => onFinalize(match.id, 'B_win')}
                    >
                      {teamWinName(match.teamB, match)} venceu
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
