import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';
import WordsList from '@/components/WordsList';
import PlayerSpinner from '@/components/PlayerSpinner';
import ResizableKeyboard from '@/components/ResizableKeyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import GameGrid from '@/components/game/GameGrid';
import LetterKeyboard from '@/components/game/LetterKeyboard';
import { GameHeader, ScorePill, TurnTimer } from '@/components/game/GameChrome';
import { MoveFeedbackLayer, useMoveFeedback } from '@/components/game/MoveFeedback';
import { wordPoints } from '@/game/constants';
import { scoredCells } from '@/game/moveAnalysis';
import { useDictionaryReady } from '@/hooks/useDictionaryReady';
import { recordGame, recordMove } from '@/lib/progress';

interface OnlineMultiplayerBoardProps {
  sessionId: string;
}

type Letter = string;
type GridCell = { letter: Letter | null };
type Grid = GridCell[][];
type CooldownState = { [key: string]: number };

const isGridFull = (grid: Grid): boolean =>
  grid.every(row => row.every(cell => cell.letter !== null));

const TURN_TIME_LIMIT = 30; // 30 seconds per turn
const WARNING_THRESHOLD = 5; // Show warning at 5 seconds

const OnlineMultiplayerBoard: React.FC<OnlineMultiplayerBoardProps> = ({ sessionId }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { playFeedback } = useSoundEffects(true, true);
  const { celebrate } = useVictoryCelebration();
  const isMobile = useIsMobile();
  const dictReady = useDictionaryReady();
  const feedback = useMoveFeedback();
  // Guards so a timeout or a finished game is only handled once
  const timedOutTurnRef = useRef<string | null>(null);
  const recordedRef = useRef(false);
  const prevOpponentGridRef = useRef<Grid | null>(null);
  const [lastPlaced, setLastPlaced] = useState<{ who: 'me' | 'opp'; row: number; col: number } | null>(null);
  const [flash, setFlash] = useState<{ who: 'me' | 'opp'; cells: Set<string>; key: number } | null>(null);

  const [session, setSession] = useState<any>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState<number | null>(null);
  const [myState, setMyState] = useState<any>(null);
  const [opponentState, setOpponentState] = useState<any>(null);
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIME_LIMIT);
  const [rematchRequestedBy, setRematchRequestedBy] = useState<number | null>(null);
  const [lastOpponentWordCount, setLastOpponentWordCount] = useState(0);
  const [showSpinner, setShowSpinner] = useState(true);
  const [spinnerCompleted, setSpinnerCompleted] = useState(false);

  useEffect(() => {
    const fetchGameData = async () => {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionData) {
        setSession(sessionData);
        
        // Determine player index by comparing user ID
        let playerIndex: number;
        if (user.id === sessionData.player1_id) {
          playerIndex = 1;
        } else if (user.id === sessionData.player2_id) {
          playerIndex = 2;
        } else {
          console.error('User is not part of this game');
          return;
        }
        
        setMyPlayerIndex(playerIndex);
        
        const { data: states } = await supabase
          .from('game_state')
          .select('*')
          .eq('session_id', sessionId);

        if (states && states.length > 0) {
          const myStateData = states.find(s => s.player_index === playerIndex);
          const opponentStateData = states.find(s => s.player_index !== playerIndex);
          
          setMyState(myStateData);
          setOpponentState(opponentStateData);
        }
      }
    };

    fetchGameData();

    const sessionChannel = supabase
      .channel('session-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        setSession(payload.new);
        setRematchRequestedBy(payload.new.rematch_requested_by || null);
        
        // Check if opponent accepted rematch - invite_code will be updated with REMATCH: prefix
        if (payload.new.invite_code?.startsWith('REMATCH:')) {
          const newGameCode = payload.new.invite_code.replace('REMATCH:', '');
          navigate(`/online/${newGameCode}`);
          return;
        }
        
        if (payload.new.status === 'finished') {
          playFeedback('gameEnd');
          setShowVictoryDialog(true);
          // Check if current player won
          if (payload.new.winner_index === myPlayerIndex) {
            celebrate();
          }
        }
      })
      .subscribe();

    const stateChannel = supabase
      .channel('state-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_state',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const updatedState = payload.new;
          if (updatedState.player_index === myPlayerIndex) {
            setMyState(updatedState);
          } else {
            setOpponentState(updatedState);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(stateChannel);
    };
  }, [sessionId, myPlayerIndex, playFeedback, celebrate]);

  // Auto-pass turn if current player has no moves left (handles both my turn and opponent's turn)
  useEffect(() => {
    if (!session || !myState || !opponentState || session.status !== 'playing') return;
    
    const currentPlayerIndex = session.current_player;
    const currentPlayerState = currentPlayerIndex === myPlayerIndex ? myState : opponentState;
    
    const gridFull = isGridFull(currentPlayerState.grid_data);
    const hasNoLetters = currentPlayerState.available_letters.length === 0;
    const allCooldownsEmpty = Object.keys(currentPlayerState.cooldowns || {}).length === 0;
    const hasNoMoves = gridFull || (hasNoLetters && allCooldownsEmpty);
    
    if (hasNoMoves) {
      // Check if opponent also has no moves
      const otherPlayerState = currentPlayerIndex === myPlayerIndex ? opponentState : myState;
      const otherGridFull = isGridFull(otherPlayerState.grid_data);
      const otherNoLetters = otherPlayerState.available_letters.length === 0;
      const otherNoCooldowns = Object.keys(otherPlayerState.cooldowns || {}).length === 0;
      const otherNoMoves = otherGridFull || (otherNoLetters && otherNoCooldowns);
      
      if (otherNoMoves) {
        // Both players finished - end game (only do this once, from my perspective)
        if (currentPlayerIndex === myPlayerIndex) {
          const myScore = myState.score || 0;
          const oppScore = opponentState.score || 0;
          const winnerId = myScore > oppScore ? myPlayerIndex : myScore < oppScore ? (myPlayerIndex === 1 ? 2 : 1) : null;
          
          supabase
            .from('game_sessions')
            .update({ status: 'finished', winner_index: winnerId })
            .eq('id', sessionId);
        }
      } else {
        // Auto-pass turn to the other player immediately
        const nextPlayer = currentPlayerIndex === 1 ? 2 : 1;
        
        // Only trigger auto-pass once (whoever's turn it is)
        if (currentPlayerIndex === myPlayerIndex) {
          supabase
            .from('game_sessions')
            .update({ current_player: nextPlayer, turn_started_at: new Date().toISOString() })
            .eq('id', sessionId);
          
          toast({
            title: "Turn passed",
            description: "No more moves available",
          });
        }
      }
    }
  }, [session, myState, opponentState, myPlayerIndex, sessionId, toast]);

  useEffect(() => {
    const timer = setInterval(() => {
      setGameTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isMyTurn = session?.current_player === myPlayerIndex;

  const handleTurnTimeout = async () => {
    if (!myState || !session) return;
    // The clock keeps ticking until the server confirms the pass, so only penalise once per turn
    if (timedOutTurnRef.current === session.turn_started_at) return;
    timedOutTurnRef.current = session.turn_started_at;

    const pointDeduction = 5;
    const newScore = myState.score - pointDeduction;

    // Update database
    await supabase
      .from('game_state')
      .update({ score: newScore })
      .eq('id', myState.id);

    const nextPlayer = session.current_player === 1 ? 2 : 1;
    await supabase
      .from('game_sessions')
      .update({ current_player: nextPlayer, turn_started_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Update local state immediately
    setMyState({ ...myState, score: newScore });

    toast({
      title: "⏰ Turn skipped",
      description: `Time's up! -${pointDeduction} points`,
      variant: "destructive"
    });

    setTurnTimeRemaining(TURN_TIME_LIMIT);
  };

  // Keyboard support for letter selection
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if it's my turn and not in any dialog
      if (!isMyTurn || showVictoryDialog) return;

      const key = e.key.toUpperCase();
      
      // Handle letter keys A-Z
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        const availableLetters = myState?.available_letters || [];
        const myCooldowns = myState?.cooldowns || {};
        const opponentCooldowns = opponentState?.cooldowns || {};
        
        const myCooldown = myCooldowns[key] || 0;
        const oppCooldown = opponentCooldowns[key] || 0;
        const maxCooldown = Math.max(myCooldown, oppCooldown);
        
        const isOnCooldown = maxCooldown > 0;
        const isAvailable = availableLetters.includes(key);
        const canSelect = isAvailable && !isOnCooldown;
        
        if (canSelect) {
          setSelectedLetter(key);
          playFeedback('select');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isMyTurn, showVictoryDialog, myState, opponentState, playFeedback]);

  // Synchronized turn timer - calculate from server timestamp
  useEffect(() => {
    if (session?.status !== 'playing') {
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      return;
    }

    const calculateRemaining = () => {
      if (!session.turn_started_at) {
        return TURN_TIME_LIMIT;
      }
      const elapsed = Math.floor((Date.now() - new Date(session.turn_started_at).getTime()) / 1000);
      return Math.max(0, TURN_TIME_LIMIT - elapsed);
    };

    // Initial calculation
    setTurnTimeRemaining(calculateRemaining());

    const timer = setInterval(() => {
      const remaining = calculateRemaining();
      setTurnTimeRemaining(remaining);
      
      if (remaining === 5 && isMyTurn) {
        playFeedback('timerWarning');
      }
      
      // Only handle timeout if it's my turn
      if (remaining <= 0 && isMyTurn) {
        handleTurnTimeout();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.status, session?.turn_started_at, isMyTurn, playFeedback]);

  // Opponent word notifications
  useEffect(() => {
    if (!opponentState || !session) return;
    
    const opponentWords = opponentState.words_found || [];
    const oppName = myPlayerIndex === 1 ? session.player2_name : session.player1_name;
    
    if (opponentWords.length > lastOpponentWordCount && lastOpponentWordCount > 0) {
      const fresh: string[] = opponentWords.slice(lastOpponentWordCount);
      feedback.push({
        who: oppName || 'Opponent',
        player: 2,
        words: fresh.map(text => ({ text, path: [], dir: '→' as const, points: wordPoints(text) })),
        gained: fresh.reduce((n, w) => n + wordPoints(w), 0),
        mine: false,
      });
      playFeedback('score', 2);
    }
    
    setLastOpponentWordCount(opponentWords.length);
  }, [opponentState?.words_found, session, myPlayerIndex, lastOpponentWordCount, playFeedback, toast]);

  // Mark the opponent's newest tile
  useEffect(() => {
    const grid = opponentState?.grid_data as Grid | undefined;
    if (!grid) return;
    const prev = prevOpponentGridRef.current;
    if (prev) {
      for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c].letter && !prev[r]?.[c]?.letter) setLastPlaced({ who: 'opp', row: r, col: c });
      }
    }
    prevOpponentGridRef.current = grid;
  }, [opponentState?.grid_data]);

  // Record the finished game once for XP and stats
  useEffect(() => {
    if (session?.status !== 'finished' || recordedRef.current || !myState) return;
    recordedRef.current = true;
    const won = session.winner_index === myPlayerIndex;
    recordGame({ mode: 'online', won, tied: !session.winner_index, score: myState.score || 0, words: myState.words_found || [] });
  }, [session?.status, session?.winner_index, myPlayerIndex, myState]);

  const placeLetter = async (row: number, col: number) => {
    if (!isMyTurn || !selectedLetter || !myState) {
      if (!isMyTurn) {
        playFeedback('invalid');
        toast({
          title: "Not your turn",
          description: "Wait for your opponent to play",
          variant: "destructive"
        });
      }
      return;
    }

    // Prevent placing if timer already ran out (prevents double penalty + placement)
    if (turnTimeRemaining <= 0) {
      playFeedback('invalid');
      toast({
        title: "Time's up!",
        description: "Your turn has already ended",
        variant: "destructive"
      });
      return;
    }

    const grid = myState.grid_data as Grid;
    if (grid[row][col].letter !== null) {
      playFeedback('invalid');
      return;
    }

    // Allow placing letters anywhere on the board

    const newGrid: Grid = grid.map((rowArr: GridCell[], r: number) =>
      rowArr.map((cell, c) => 
        r === row && c === col ? { letter: selectedLetter } : cell
      )
    );

    // Convert grid to string format for calculateScore
    const gridForScoring = newGrid.map(row => 
      row.map(cell => cell.letter)
    );

    const result = calculateScore(gridForScoring, SCORE_OPTS());
    
    // Track words found and only score new words
    const existingWords = new Set(myState.words_found || []);
    const newWordsFound = result.words.filter(w => !existingWords.has(w.text));
    
    // Apply bonus scoring: Z, X, Q = 2 points each, others = 1 point
    const BONUS_LETTERS = new Set(['Z', 'X', 'Q']);
    const newScore = newWordsFound.reduce((s, w) => {
      let wordScore = 0;
      for (const letter of w.text) {
        wordScore += BONUS_LETTERS.has(letter.toUpperCase()) ? 2 : 1;
      }
      return s + wordScore;
    }, 0);

    // Play sound effects and show what the move made
    playFeedback('place');
    setLastPlaced({ who: 'me', row, col });
    if (newWordsFound.length > 0) {
      const cells = new Set<string>();
      newWordsFound.forEach(w => w.path.forEach(p => cells.add(`${p.r}-${p.c}`)));
      setFlash({ who: 'me', cells, key: Date.now() });
      const scoredWords = newWordsFound.map(w => ({ ...w, points: wordPoints(w.text) }));
      feedback.push({ who: 'You', player: 1, words: scoredWords, gained: newScore, mine: true });
      recordMove(newScore, newWordsFound.map(w => w.text));
      playFeedback(newWordsFound.length >= 2 ? 'combo' : 'score', newWordsFound.length >= 2 ? newWordsFound.length : newScore);
    }

    // Process existing cooldowns first - decrement and collect expired letters
    const newCooldowns: CooldownState = {};
    const lettersToAddBack: string[] = [];
    
    Object.keys(myState.cooldowns || {}).forEach(letter => {
      const decremented = myState.cooldowns[letter] - 1;
      if (decremented > 0) {
        newCooldowns[letter] = decremented;
      } else {
        // Cooldown finished, add letter back to available letters
        lettersToAddBack.push(letter);
      }
    });
    
    // Now set the newly placed letter's cooldown
    newCooldowns[selectedLetter] = session.cooldown_turns;
    
    // Start with current available letters, remove the placed one, add back expired ones
    let newAvailableLetters = myState.available_letters.filter((l: string) => l !== selectedLetter);
    lettersToAddBack.forEach(letter => {
      if (!newAvailableLetters.includes(letter)) {
        newAvailableLetters.push(letter);
      }
    });
    

    const updatedScore = myState.score + newScore;
    const newTurnNumber = myState.turn_number + 1;
    
    // Add only the NEW words to the words_found list
    const newWordTexts = newWordsFound.map(w => w.text);
    const allWordsFound = [...(myState.words_found || []), ...newWordTexts];

    // Also decrement opponent's cooldowns since a turn has passed
    if (opponentState) {
      const opponentNewCooldowns: CooldownState = {};
      const opponentLettersToAddBack: string[] = [];
      
      Object.keys(opponentState.cooldowns || {}).forEach(letter => {
        const decremented = opponentState.cooldowns[letter] - 1;
        if (decremented > 0) {
          opponentNewCooldowns[letter] = decremented;
        } else {
          opponentLettersToAddBack.push(letter);
        }
      });
      
      let opponentNewAvailableLetters = [...(opponentState.available_letters || [])];
      opponentLettersToAddBack.forEach(letter => {
        if (!opponentNewAvailableLetters.includes(letter)) {
          opponentNewAvailableLetters.push(letter);
        }
      });
      
      // Update opponent's state
      await supabase
        .from('game_state')
        .update({
          available_letters: opponentNewAvailableLetters,
          cooldowns: opponentNewCooldowns
        })
        .eq('id', opponentState.id);
    }

    await supabase
      .from('game_state')
      .update({
        grid_data: newGrid,
        score: updatedScore,
        available_letters: newAvailableLetters,
        cooldowns: newCooldowns,
        turn_number: newTurnNumber,
        words_found: allWordsFound
      })
      .eq('id', myState.id);

    // Record this move for replay
    const totalMoves = (myState.turn_number || 0) + (opponentState?.turn_number || 0);
    await supabase
      .from('game_moves')
      .insert({
        session_id: sessionId,
        player_index: myPlayerIndex,
        move_number: totalMoves + 1,
        letter: selectedLetter,
        position_row: row,
        position_col: col,
        words_formed: newWordTexts,
        points_scored: newScore
      });

    const nextPlayer = session.current_player === 1 ? 2 : 1;
    await supabase
      .from('game_sessions')
      .update({ current_player: nextPlayer, turn_started_at: new Date().toISOString() })
      .eq('id', sessionId);

    setSelectedLetter(null);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    playFeedback('turnChange');

    // Words are now shown in the WordsList component instead of toast

    // Check if both players have finished (no moves left or full boards)
    const myGridFull = isGridFull(newGrid);
    const opponentGridFull = opponentState ? isGridFull(opponentState.grid_data as Grid) : false;

    const iFinished =
      myGridFull ||
      (newAvailableLetters.length === 0 && Object.keys(newCooldowns).length === 0);

    const opponentFinished = opponentState
      ? opponentGridFull ||
        (opponentState.available_letters.length === 0 &&
          Object.keys(opponentState.cooldowns || {}).length === 0)
      : false;

    if (iFinished && opponentFinished) {
      // Both players finished - end game
      const opponentScore = opponentState?.score || 0;
      const winnerId =
        updatedScore > opponentScore
          ? myPlayerIndex
          : updatedScore < opponentScore
            ? myPlayerIndex === 1
              ? 2
              : 1
            : null;
      
      await supabase
        .from('game_sessions')
        .update({ 
          status: 'finished',
          winner_index: winnerId
        })
        .eq('id', sessionId);
    }
  };

  const myScored = useMemo(() => (dictReady && myState ? scoredCells(myState.grid_data as Grid) : undefined), [dictReady, myState]);
  const oppScored = useMemo(() => (dictReady && opponentState ? scoredCells(opponentState.grid_data as Grid) : undefined), [dictReady, opponentState]);

  const renderGrid = (isOpponent: boolean = false) => {
    const gridState = isOpponent ? opponentState : myState;
    if (!gridState) return null;
    const who = isOpponent ? 'opp' : 'me';
    const playing = session.status === 'playing';
    const myCell = isMobile ? 'min(12vw, 6dvh, 56px)' : 'min(5.4vw, 8.6dvh, 92px)';
    const oppCell = isMobile ? 'min(8.6vw, 4.3dvh, 40px)' : myCell;

    return (
      <GameGrid
        grid={gridState.grid_data as Grid}
        player={isOpponent ? 2 : 1}
        interactive={!isOpponent && isMyTurn && playing}
        active={playing && (isOpponent ? !isMyTurn : isMyTurn)}
        selectedLetter={selectedLetter}
        onCellClick={placeLetter}
        flashCells={flash?.who === who ? flash.cells : undefined}
        flashKey={flash?.key}
        scoredCells={isOpponent ? oppScored : myScored}
        lastPlaced={lastPlaced?.who === who ? lastPlaced : null}
        cellSize={isOpponent ? oppCell : myCell}
      />
    );
  };

  const renderAvailableLetters = () => {
    if (!myState || !opponentState) return null;
    // A letter is locked if it is cooling down for either player
    const merged: CooldownState = {};
    for (const src of [myState.cooldowns || {}, opponentState.cooldowns || {}]) {
      for (const [l, v] of Object.entries(src as CooldownState)) if (v > 0) merged[l] = Math.max(merged[l] || 0, v);
    }
    return (
      <LetterKeyboard
        cooldowns={merged}
        selected={selectedLetter}
        enabled={isMyTurn && session.status === 'playing'}
        allowed={myState.available_letters || []}
        cooldownTurns={session.cooldown_turns || 4}
        onSelect={letter => { setSelectedLetter(prev => (prev === letter ? null : letter)); playFeedback('select'); }}
      />
    );
  };

  if (!session || !myState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const myName = myPlayerIndex === 1 ? session.player1_name : session.player2_name;
  const opponentName = myPlayerIndex === 1 ? session.player2_name : session.player1_name;
  const myScore = myState.score;
  const opponentScore = opponentState?.score || 0;

  const handleRematch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if opponent already requested rematch
    if (rematchRequestedBy && rematchRequestedBy !== myPlayerIndex) {
      // Opponent requested, so create the new game
      await createRematchGame();
    } else {
      // I'm requesting rematch first
      const { error } = await supabase
        .from('game_sessions')
        .update({ rematch_requested_by: myPlayerIndex })
        .eq('id', sessionId);
      
      if (error) {
        console.error('Error requesting rematch:', error);
        toast({
          title: "Error",
          description: "Failed to request rematch. Please try again.",
          variant: "destructive"
        });
      } else {
        setRematchRequestedBy(myPlayerIndex);
      }
    }
  };

  const createRematchGame = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Generate a random 5-character invite code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let inviteCode = '';
      for (let i = 0; i < 5; i++) {
        inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Current user creating the rematch must be player1 for RLS to allow insert
      const currentUserIsOriginalPlayer1 = user.id === session.player1_id;
      const newPlayer1Id = user.id;
      const newPlayer1Name = currentUserIsOriginalPlayer1 ? session.player1_name : session.player2_name;
      const newPlayer2Id = currentUserIsOriginalPlayer1 ? session.player2_id : session.player1_id;
      const newPlayer2Name = currentUserIsOriginalPlayer1 ? session.player2_name : session.player1_name;

      // Create new game session - current user is always player1
      const { data: newSession, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          player1_id: newPlayer1Id,
          player1_name: newPlayer1Name,
          player2_id: newPlayer2Id,
          player2_name: newPlayer2Name,
          invite_code: inviteCode,
          status: 'playing',
          board_size: session.board_size,
          cooldown_turns: session.cooldown_turns,
          current_player: 1,
          turn_started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating rematch session:', sessionError);
        toast({
          title: "Error",
          description: "Failed to create rematch. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (newSession) {
        // Generate initial grid with starting tiles (same for both players)
        const generateStartingTiles = (size: number) => {
          const grid: Grid = Array(size).fill(null).map(() => 
            Array(size).fill(null).map(() => ({ letter: null as string | null }))
          );
          
          const letterPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          
          // Pick 5 random letters from the pool for starting tiles
          const startingLetters: string[] = [];
          for (let i = 0; i < Math.min(5, size); i++) {
            const letter = letterPool[Math.floor(Math.random() * letterPool.length)];
            startingLetters.push(letter);
          }
          
          // Place one letter in each row at random column
          for (let row = 0; row < Math.min(5, size); row++) {
            const col = Math.floor(Math.random() * size);
            grid[row][col] = { letter: startingLetters[row] };
          }
          
          return grid;
        };

        const initialGrid = generateStartingTiles(session.board_size);
        const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

        const { error: stateError } = await supabase.from('game_state').insert([
          {
            session_id: newSession.id,
            player_index: 1,
            grid_data: initialGrid,
            available_letters: allLetters,
            cooldowns: {},
            score: 0,
            turn_number: 0,
            words_found: []
          },
          {
            session_id: newSession.id,
            player_index: 2,
            grid_data: initialGrid,
            available_letters: allLetters,
            cooldowns: {},
            score: 0,
            turn_number: 0,
            words_found: []
          }
        ]);

        if (stateError) {
          console.error('Error creating game state:', stateError);
          toast({
            title: "Error",
            description: "Failed to initialize rematch. Please try again.",
            variant: "destructive"
          });
          return;
        }

        // Update old session with the new game's invite code so other player can follow
        await supabase
          .from('game_sessions')
          .update({ rematch_requested_by: null, invite_code: `REMATCH:${inviteCode}` })
          .eq('id', sessionId);

        navigate(`/online/${inviteCode}`);
      }
    } catch (error) {
      console.error('Unexpected error during rematch:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeclineRematch = () => {
    navigate('/');
  };

  const handleSpinnerComplete = async (selectedPlayer: number) => {
    setShowSpinner(false);
    setSpinnerCompleted(true);
    
    // Update the session to set the starting player and reset timer (only player 1 does this to avoid race condition)
    if (myPlayerIndex === 1) {
      await supabase
        .from('game_sessions')
        .update({ 
          current_player: selectedPlayer,
          turn_started_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    }
  };

  // Only show spinner if game just started and both states are loaded
  const shouldShowSpinner = showSpinner && !spinnerCompleted && session?.status === 'playing' && myState && opponentState;

  return (
    <>
      {/* Player Spinner for new games */}
      {shouldShowSpinner && (
        <PlayerSpinner 
          playerCount={2} 
          onComplete={handleSpinnerComplete}
          playerNames={[session.player1_name, session.player2_name || 'Player 2']}
        />
      )}
      
    <MoveFeedbackLayer events={feedback.events} />
    <div className="h-[100dvh] p-1.5 sm:p-3 pt-safe mx-auto flex flex-col overflow-hidden">
      <GameHeader
        title="Online 1v1"
        onHome={() => { playFeedback('click'); navigate('/'); }}
        center={
          session.status === 'finished' ? (
            <div className="font-display font-bold text-xl text-gold">
              {session.winner_index === myPlayerIndex ? 'You win!' : session.winner_index ? 'You lost' : 'Tie!'}
            </div>
          ) : (
            <TurnTimer remaining={turnTimeRemaining} label={isMyTurn ? (selectedLetter ? `Place ${selectedLetter}` : 'Your turn') : `${opponentName || 'Opponent'}'s turn`} />
          )
        }
      />

      <div className="flex justify-center gap-2 mb-1.5 sm:mb-3 shrink-0">
        <ScorePill name={myName || 'You'} score={myScore} player={1} active={session.status === 'playing' && isMyTurn} />
        <ScorePill name={opponentName || 'Waiting…'} score={opponentScore} player={2} active={session.status === 'playing' && !isMyTurn} />
      </div>

      {/* Boards: side by side on desktop; on a phone the opponent's smaller board goes on top */}
      <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-2 md:gap-6 lg:gap-10 flex-1 min-h-0">
        <div className={`flex items-start gap-2 lg:gap-4 ${isMobile ? 'order-2' : ''}`}>
          <WordsList words={myState.words_found || []} playerName="You" colorClass="text-player-1" />
          {renderGrid(false)}
        </div>
        <div className={`flex items-start gap-2 lg:gap-4 ${isMobile ? 'order-1' : ''}`}>
          {renderGrid(true)}
          <WordsList words={opponentState?.words_found || []} playerName={opponentName} colorClass="text-player-2" />
        </div>
      </div>

      {/* Available Letters - Below the boards */}
      {session.status === 'playing' && (
        <ResizableKeyboard>
          {renderAvailableLetters()}
        </ResizableKeyboard>
      )}

      {/* Victory Dialog */}
      <Dialog open={showVictoryDialog} onOpenChange={setShowVictoryDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl text-center">
              {session.winner_index === myPlayerIndex ? '🎉 Victory!' : session.winner_index ? '😤 So close!' : '🤝 Tie!'}
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              {myName} {myScore} – {opponentScore} {opponentName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Final Scores */}
            <div className="flex justify-around text-center">
              <div>
                <p className="text-sm text-muted-foreground">{myName}</p>
                <p className="text-3xl font-bold">{myScore}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{opponentName}</p>
                <p className="text-3xl font-bold">{opponentScore}</p>
              </div>
            </div>

            {/* Words Found */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2 text-center">{myName}'s Words</h3>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                  {(myState?.words_found || []).length > 0 ? (
                    (myState.words_found || []).map((word: string, idx: number) => (
                      <div key={idx} className="text-sm bg-accent/50 rounded px-2 py-1">
                        {word} <span className="text-muted-foreground">+{wordPoints(word)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No words</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-center">{opponentName}'s Words</h3>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                  {(opponentState?.words_found || []).length > 0 ? (
                    (opponentState.words_found || []).map((word: string, idx: number) => (
                      <div key={idx} className="text-sm bg-accent/50 rounded px-2 py-1">
                        {word} <span className="text-muted-foreground">+{wordPoints(word)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No words</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {rematchRequestedBy === myPlayerIndex ? (
                <div className="text-center space-y-3">
                  <p className="text-muted-foreground animate-pulse">
                    ⏳ Waiting for {opponentName} to accept...
                  </p>
                  <Button onClick={() => {
                    setShowVictoryDialog(false);
                    navigate('/');
                  }} variant="outline" size="lg">
                    Home
                  </Button>
                </div>
              ) : rematchRequestedBy && rematchRequestedBy !== myPlayerIndex ? (
                <div className="text-center space-y-3">
                  <p className="text-lg font-semibold">
                    {opponentName} wants a rematch!
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleRematch} size="lg">
                      ✅ Accept Rematch
                    </Button>
                    <Button onClick={handleDeclineRematch} variant="outline" size="lg">
                      ❌ Decline
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 justify-center">
                  <Button onClick={handleRematch} size="lg">
                    🔄 Rematch
                  </Button>
                  <Button onClick={() => {
                    setShowVictoryDialog(false);
                    navigate('/');
                  }} variant="outline" size="lg">
                    Home
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};

export default OnlineMultiplayerBoard;
