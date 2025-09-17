import { useGame, PlayerId } from './store';
import { calculateBoardScore, getDeltaScore } from '@/lib/gameScoring';

export function useGameEvents() {
  const { state, dispatch } = useGame();

  function onSelectCell(playerId: PlayerId, row: number, col: number) {
    // Immediately place the current letter
    onPlaceOnCell(state.activePlayerId, playerId, row, col);
  }

  function onPlaceOnCell(actorId: PlayerId, targetId: PlayerId, r: number, c: number) {
    // Validate placement rules
    const targetGrid = state.boardByPlayer[targetId];
    if (!targetGrid || targetGrid[r][c]) return; // Cell occupied
    
    // If attacking, validate rules
    if (state.isAttacking) {
      if ((state.attacksRemaining[actorId] ?? 0) <= 0) return; // No attacks left
      if (targetId === actorId) return; // Must target opponent when attacking
    } else {
      if (targetId !== actorId) return; // Must target own board when not attacking
    }
    
    // Create updated board to calculate new score
    const updatedBoard = targetGrid.map(row => [...row]);
    const letter = state.isAttacking ? state.attackVowel : state.currentLetter;
    updatedBoard[r][c] = letter;
    
    // Calculate score delta
    const newTotal = calculateBoardScore(updatedBoard);
    const prevTotal = state.lastBoardTotal[actorId] ?? 0;
    const delta = getDeltaScore(newTotal, prevTotal);
    
    dispatch({ type: 'PLACE_ON_CELL', actorId, targetId, r, c });
    
    // Generate new letter for next turn
    dispatch({ type: 'START_TURN' });
  }

  function onToggleAttack() {
    dispatch({ type: 'TOGGLE_ATTACK' });
  }

  function onRoundEnd() {
    // Only reset round scores and used words, preserve cumulative scores
    dispatch({ type: 'ROUND_END' });
  }

  function onNewGame() {
    // Reset everything including cumulative scores
    dispatch({ type: 'NEW_GAME' });
  }

  function onBoardSizeChange(size: 5 | 7 | 10) {
    dispatch({ type: 'SET_BOARD_SIZE', size });
  }

  function initializePlayers(playerNames: string[], mode: 'solo' | 'passplay' = 'passplay') {
    const players = playerNames.map((name, index) => ({
      id: `player-${index + 1}`,
      name,
      isAI: mode === 'solo' && index === 1 // Second player is AI in solo mode
    }));
    dispatch({ type: 'INIT_PLAYERS', players, mode });
  }

  function setCurrentPlayer(playerId: PlayerId) {
    dispatch({ type: 'SET_CURRENT_PLAYER', playerId });
  }

  function endTurn() {
    dispatch({ type: 'END_TURN' });
  }

  function setGameStatus(status: 'setup' | 'playing' | 'ended') {
    dispatch({ type: 'SET_GAME_STATUS', status });
  }

  return { 
    onSelectCell,
    onPlaceOnCell,
    onToggleAttack,
    onRoundEnd, 
    onNewGame, 
    onBoardSizeChange,
    initializePlayers,
    setCurrentPlayer,
    setGameStatus,
    endTurn
  };
}