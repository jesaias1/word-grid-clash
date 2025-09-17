import { useGame, PlayerId } from './store';
import { scorePlacement } from '@/lib/letterPlacement';

export function useGameEvents() {
  const { state, dispatch } = useGame();

  function onSelectCell(row: number, col: number) {
    dispatch({ type: 'SELECT_CELL', row, col });
  }

  function onToggleAttack() {
    dispatch({ type: 'TOGGLE_ATTACK' });
  }

  async function onPlaceLetter(letter: string): Promise<{ success: boolean; reason?: string }> {
    if (!state.selectedCell) {
      return { success: false, reason: 'No cell selected' };
    }

    if (!state.currentPlayer) {
      return { success: false, reason: 'No current player' };
    }

    const { row, col } = state.selectedCell;
    const currentPlayerId = state.currentPlayer;
    
    // Determine target board (own board or opponent's if attacking)
    let targetBoardId = currentPlayerId;
    if (state.isAttacking) {
      // Find opponent's board (for simplicity, assume 2 players)
      const opponent = state.players.find(p => p.id !== currentPlayerId);
      if (!opponent) {
        return { success: false, reason: 'No opponent found' };
      }
      targetBoardId = opponent.id;
      
      // Check if player has attacks remaining
      if ((state.attacksRemaining[currentPlayerId] ?? 0) <= 0) {
        return { success: false, reason: 'No attacks remaining' };
      }
      
      // Check if letter matches attack vowel
      if (letter.toUpperCase() !== state.attackVowel) {
        return { success: false, reason: `Attack must use vowel: ${state.attackVowel}` };
      }
    }

    const targetGrid = state.boardByPlayer[targetBoardId];
    if (!targetGrid) {
      return { success: false, reason: 'Target board not found' };
    }

    // Check if cell is empty
    if (targetGrid[row][col] && targetGrid[row][col].trim() !== '') {
      return { success: false, reason: 'Cell already occupied' };
    }

    // Calculate score for this placement
    const completedWords = state.completedWordHashesThisRound[currentPlayerId] ?? new Set();
    const { points, newWords } = await scorePlacement(
      targetGrid,
      row,
      col,
      letter,
      completedWords
    );

    // Place the letter
    dispatch({
      type: 'PLACE_LETTER',
      playerId: currentPlayerId,
      targetBoardId,
      row,
      col,
      letter: letter.toUpperCase(),
      points,
      newWords
    });

    return { success: true };
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

  function initializePlayers(playerNames: string[]) {
    const players = playerNames.map((name, index) => ({
      id: `player-${index + 1}`,
      name
    }));
    dispatch({ type: 'INIT_PLAYERS', players });
  }

  function setCurrentPlayer(playerId: PlayerId) {
    dispatch({ type: 'SET_CURRENT_PLAYER', playerId });
  }

  function setGameStatus(status: 'setup' | 'playing' | 'ended') {
    dispatch({ type: 'SET_GAME_STATUS', status });
  }

  return { 
    onSelectCell,
    onToggleAttack,
    onPlaceLetter,
    onRoundEnd, 
    onNewGame, 
    onBoardSizeChange,
    initializePlayers,
    setCurrentPlayer,
    setGameStatus
  };
}