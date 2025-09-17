import { useGame, PlayerId } from './store';
import { loadDictionary } from '@/lib/dictionary';

export function useGameEvents() {
  const { state, dispatch } = useGame();

  async function validateWord(word: string): Promise<boolean> {
    if (!word || !/^[A-Za-z]+$/.test(word)) return false;
    
    try {
      const dict = await loadDictionary();
      return dict.has(word.toLowerCase());
    } catch (error) {
      console.error('Error validating word:', error);
      return false;
    }
  }

  async function onSubmitWord(playerId: PlayerId, word: string): Promise<{ success: boolean; reason?: string }> {
    const trimmed = word.trim();
    
    if (!trimmed) {
      return { success: false, reason: 'Word cannot be empty' };
    }
    
    if (!/^[A-Za-z]+$/.test(trimmed)) {
      return { success: false, reason: 'Word can only contain letters' };
    }
    
    // Check if word was already used by this player this round
    const used = state.usedWordsThisRound[playerId];
    if (used && used.has(trimmed.toLowerCase())) {
      return { success: false, reason: 'Word already used this round' };
    }
    
    // Validate word exists in dictionary
    const isValid = await validateWord(trimmed);
    if (!isValid) {
      return { success: false, reason: 'Word not found in dictionary' };
    }
    
    // Calculate points: 1 point per letter
    const points = trimmed.length;
    
    dispatch({ type: 'SUBMIT_WORD', playerId, word: trimmed, points });
    
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
    onSubmitWord, 
    onRoundEnd, 
    onNewGame, 
    onBoardSizeChange,
    initializePlayers,
    setCurrentPlayer,
    setGameStatus,
    validateWord
  };
}