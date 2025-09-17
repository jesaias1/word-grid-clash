import { useGame, PlayerId } from './store';
import { scorePlacement } from '@/lib/letterPlacement';

export function useGameEvents() {
  const { state, dispatch } = useGame();

  function onPickLetter(letter: string) {
    const newAction = { type: 'PICK_LETTER', letter: letter.toUpperCase() } as const;
    dispatch(newAction);
    
    // Check if we can place immediately
    if (state.pendingCell && state.currentPlayer) {
      setTimeout(() => onPlaceLetter(letter.toUpperCase()), 0);
    }
  }

  function onSelectCell(playerId: PlayerId, row: number, col: number) {
    const newAction = { type: 'SELECT_CELL', playerId, row, col } as const;
    dispatch(newAction);
    
    // Check if we can place immediately
    if (state.pendingLetter && state.currentPlayer) {
      setTimeout(() => onPlaceLetter(state.pendingLetter), 0);
    }
  }

  function onToggleAttack() {
    dispatch({ type: 'TOGGLE_ATTACK' });
  }

  async function onPlaceLetter(letter: string): Promise<{ success: boolean; reason?: string }> {
    if (!state.pendingCell) {
      return { success: false, reason: 'No cell selected' };
    }

    if (!state.currentPlayer) {
      return { success: false, reason: 'No current player' };
    }

    const { row, col, playerId: targetPlayerId } = state.pendingCell;
    const currentPlayerId = state.currentPlayer;
    
    // Determine target board (use the selected cell's playerId)
    let targetBoardId = targetPlayerId;
    
    // If attacking, validate attack rules
    if (state.isAttacking) {
      // Check if player has attacks remaining
      if ((state.attacksRemaining[currentPlayerId] ?? 0) <= 0) {
        return { success: false, reason: 'No attacks remaining' };
      }
      
      // Check if letter matches attack vowel
      if (letter.toUpperCase() !== state.attackVowel) {
        return { success: false, reason: `Attack must use vowel: ${state.attackVowel}` };
      }
      
      // Ensure targeting opponent's board
      if (targetBoardId === currentPlayerId) {
        return { success: false, reason: 'Must target opponent when attacking' };
      }
    } else {
      // If not attacking, must target own board
      if (targetBoardId !== currentPlayerId) {
        return { success: false, reason: 'Must target own board when not attacking' };
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
    onPickLetter,
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