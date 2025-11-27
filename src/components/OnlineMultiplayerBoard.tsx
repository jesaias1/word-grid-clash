import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getDictionary } from '@/game/dictionary';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useVictoryCelebration } from '@/hooks/useVictoryCelebration';

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
const WARNING_THRESHOLD = 10; // Show warning at 10 seconds

const OnlineMultiplayerBoard: React.FC<OnlineMultiplayerBoardProps> = ({ sessionId }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { playFeedback } = useSoundEffects(true, true);
  const { celebrate } = useVictoryCelebration();

  const [session, setSession] = useState<any>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState<number | null>(null);
  const [myState, setMyState] = useState<any>(null);
  const [opponentState, setOpponentState] = useState<any>(null);
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIME_LIMIT);
  const [rematchRequestedBy, setRematchRequestedBy] = useState<number | null>(null);

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

  // Auto-pass turn if current player has no moves left
  useEffect(() => {
    if (!session || !myState || session.status !== 'playing') return;
    
    const isCurrentPlayerTurn = session.current_player === myPlayerIndex;
    const gridFull = isGridFull(myState.grid_data);
    const hasNoLetters = myState.available_letters.length === 0;
    const hasNoMoves = gridFull || hasNoLetters;
    
    if (isCurrentPlayerTurn && hasNoMoves) {
      // Automatically pass turn
      const nextPlayer = session.current_player === 1 ? 2 : 1;
      supabase
        .from('game_sessions')
        .update({ current_player: nextPlayer })
        .eq('id', sessionId);
      
      toast({
        title: "Turn passed",
        description: "No more moves available",
      });
    }
  }, [session, myState, myPlayerIndex, sessionId, toast]);

  useEffect(() => {
    const timer = setInterval(() => {
      setGameTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isMyTurn = session?.current_player === myPlayerIndex;

  const handleTurnTimeout = async () => {
    if (!myState || !session) return;

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
      .update({ current_player: nextPlayer })
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

  // Turn timer effect
  useEffect(() => {
    if (!isMyTurn || session?.status !== 'playing' || !myState) {
      setTurnTimeRemaining(TURN_TIME_LIMIT);
      return;
    }

    const timer = setInterval(() => {
      setTurnTimeRemaining(prev => {
        if (prev <= 1) {
          handleTurnTimeout();
          return TURN_TIME_LIMIT;
        }
        if (prev === 6) {
          playFeedback('timerWarning');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMyTurn, session?.status, session?.current_player, myState?.id, playFeedback]);

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
    const newScore = newWordsFound.reduce((s, w) => s + w.text.length, 0);

    // Play sound effects
    playFeedback('place');
    if (newScore > 0) {
      playFeedback('score');
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
    
    console.log('Setting cooldowns:', { 
      selectedLetter, 
      cooldownValue: session.cooldown_turns,
      allCooldowns: newCooldowns,
      lettersToAddBack 
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

    const nextPlayer = session.current_player === 1 ? 2 : 1;
    await supabase
      .from('game_sessions')
      .update({ current_player: nextPlayer })
      .eq('id', sessionId);

    setSelectedLetter(null);
    setTurnTimeRemaining(TURN_TIME_LIMIT);
    playFeedback('turnChange');

    if (newScore > 0) {
      toast({
        title: `+${newScore} points!`,
        description: newWordTexts.map(w => `${w} (${w.length})`).join(', ')
      });
    }

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

  const renderGrid = (isOpponent: boolean = false) => {
    const gridState = isOpponent ? opponentState : myState;
    if (!gridState) return null;
    
    const grid = gridState.grid_data as Grid;
    const size = grid.length;
    const canPlace = !isOpponent && isMyTurn && selectedLetter;

    return (
      <div className={`inline-grid gap-0.5 sm:gap-1 p-1 sm:p-2 md:p-3 rounded-xl border-2 shadow-lg ${
        (!isOpponent && isMyTurn) || (isOpponent && !isMyTurn)
          ? 'bg-gradient-card ring-2 ring-primary/30 border-primary/40' 
          : 'bg-card/80 border-border'
      } ${isOpponent ? 'opacity-80' : ''}`} 
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {grid.map((row: GridCell[], rowIndex: number) =>
          row.map((cell, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => !isOpponent && canPlace && placeLetter(rowIndex, colIndex)}
                disabled={isOpponent || !canPlace}
                className={`
                  w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 cursor-pointer flex items-center justify-center transition-all duration-300 border border-border/40 rounded-lg
                  ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                  ${cell.letter ? (isOpponent ? 'bg-gradient-player-2' : 'bg-gradient-player-1') : ''}
                  ${canPlace && !cell.letter ? 'hover:scale-110 hover:shadow-lg hover:bg-accent/20' : ''}
                  ${isOpponent || !canPlace ? 'cursor-not-allowed' : ''}
                `}
              >
                {cell.letter && (
                  <span className="font-bold text-xs sm:text-base md:text-lg drop-shadow-lg text-white">
                    {cell.letter}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    );
  };

  const renderAvailableLetters = () => {
    if (!myState || !opponentState) return null;

    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    // Merge cooldowns from both players - use the highest cooldown value for each letter
    const myCooldowns = myState.cooldowns || {};
    const opponentCooldowns = opponentState.cooldowns || {};
    const mergedCooldowns: CooldownState = {};
    
    allLetters.forEach(letter => {
      const myCooldown = myCooldowns[letter] || 0;
      const oppCooldown = opponentCooldowns[letter] || 0;
      const maxCooldown = Math.max(myCooldown, oppCooldown);
      if (maxCooldown > 0) {
        mergedCooldowns[letter] = maxCooldown;
      }
    });
    
    const availableLetters = myState.available_letters || [];
    
    return (
      <div className="flex flex-wrap gap-0.5 sm:gap-1 md:gap-2 justify-center max-w-2xl mx-auto">
        {allLetters.map((letter: string) => {
          const cooldown = mergedCooldowns[letter] || 0;
          const isOnCooldown = cooldown > 0;
          const isAvailable = availableLetters.includes(letter);
          const isSelected = selectedLetter === letter;
          const canSelect = isAvailable && !isOnCooldown && isMyTurn;
          
          return (
            <button
              key={letter}
              onClick={() => {
                if (canSelect) {
                  setSelectedLetter(letter);
                  playFeedback('select');
                }
              }}
              disabled={!canSelect}
              className={`
                w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded font-bold text-xs sm:text-sm md:text-base transition-all duration-200 relative
                ${isSelected && canSelect
                  ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                  : isOnCooldown
                    ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                    : !isAvailable
                      ? 'bg-muted/30 text-muted-foreground/30 cursor-not-allowed opacity-40'
                      : canSelect
                        ? 'bg-card hover:bg-accent hover:text-accent-foreground cursor-pointer hover:scale-105 border border-border'
                        : 'bg-card text-muted-foreground cursor-not-allowed opacity-50 border border-border'
                }
                ${cooldown === 1 ? 'ring-2 ring-yellow-500/70' : ''}
              `}
            >
              {letter}
              {isOnCooldown && (
                <div className={`absolute -top-1 -right-1 rounded-full w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center text-[9px] sm:text[10px] font-bold shadow-lg border border-background ${
                  cooldown === 1 
                    ? 'bg-yellow-500 text-yellow-950' 
                    : 'bg-destructive text-destructive-foreground'
                }`}>
                  {cooldown}
                </div>
              )}
            </button>
          );
        })}
      </div>
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
      // Generate a random 5-character invite code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let inviteCode = '';
      for (let i = 0; i < 5; i++) {
        inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Create new game session with same players
      const { data: newSession, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          player1_id: session.player1_id,
          player1_name: session.player1_name,
          player2_id: session.player2_id,
          player2_name: session.player2_name,
          invite_code: inviteCode,
          status: 'playing',
          board_size: session.board_size,
          cooldown_turns: session.cooldown_turns,
          current_player: 1
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

  return (
    <div className="min-h-screen p-0.5 sm:p-1 md:p-2 space-y-0.5 sm:space-y-1 max-w-7xl mx-auto flex flex-col">

      {/* Header */}
      <div className="text-center mb-0">
        <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS - Online
        </h1>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {/* Back Button */}
        <Card className="p-1 sm:p-2 bg-gradient-card">
          <Button onClick={() => navigate('/')} variant="outline" className="w-full text-xs h-7 sm:h-8">
            Back
          </Button>
        </Card>

        {/* Timer and Turn Info */}
        <Card className="p-1 sm:p-2 bg-gradient-card">
          <div className="text-center">
            {session.status === 'finished' ? (
              <div className="text-xs sm:text-sm font-bold text-accent">
                {session.winner_index === myPlayerIndex ? 'You Win!' : 
                 session.winner_index ? 'You Lost' : 'Tie!'}
              </div>
            ) : (
              <div className="text-xs sm:text-sm font-semibold">
                {isMyTurn ? (
                  <span className="text-primary animate-pulse">Your Turn</span>
                ) : (
                  <span className="text-muted-foreground">Opponent's Turn</span>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Selected Letter */}
        <Card className="p-1 sm:p-2 bg-gradient-card">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Selected</div>
            <div className="text-lg sm:text-xl font-bold text-accent">
              {selectedLetter || '?'}
            </div>
          </div>
        </Card>
      </div>

      {/* Available Letters */}
      {session.status === 'playing' && (
        <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-0.5 sm:p-1 mx-auto">
          {renderAvailableLetters()}
        </div>
      )}

      {/* Game Grids */}
      <div className="flex flex-col items-center gap-0">
        {/* Player cards with timer in the middle */}
        <div className="flex justify-center items-center gap-1 sm:gap-2 w-full max-w-2xl mb-0.5 sm:mb-1">
          {/* You */}
          <div className={`p-1 sm:p-2 rounded-lg text-center shadow-md transition-all duration-500 flex-1 ${
            isMyTurn 
              ? 'bg-player-1/20 border-2 border-player-1/30 scale-105 animate-fade-in' 
              : 'bg-card/80 border border-border opacity-70'
          }`}>
            <div className="text-xs sm:text-sm font-bold text-player-1 truncate">{myName}</div>
            <div className="text-base sm:text-xl md:text-2xl font-bold score-glow">{myScore}</div>
          </div>

          {/* Timer */}
          {session.status === 'playing' && (
            <Card className={`p-0.5 sm:p-1 md:p-2 shadow-lg border-2 transition-all min-w-[50px] ${
              isMyTurn && turnTimeRemaining <= WARNING_THRESHOLD
                ? 'border-destructive bg-destructive/10 animate-pulse' 
                : 'border-primary bg-primary/5'
            }`}>
              <div className="text-center">
                <div className={`text-base sm:text-xl md:text-2xl font-bold ${
                  isMyTurn && turnTimeRemaining <= WARNING_THRESHOLD 
                    ? 'text-destructive' 
                    : 'text-primary'
                }`}>
                  {turnTimeRemaining}s
                </div>
              </div>
            </Card>
          )}

          {/* VS text when game ended */}
          {session.status === 'finished' && (
            <div className="flex items-center justify-center px-2">
              <div className="text-base sm:text-xl md:text-2xl font-bold text-muted-foreground">VS</div>
            </div>
          )}

          {/* Opponent */}
          <div className={`p-1 sm:p-2 rounded-lg text-center shadow-md transition-all duration-500 flex-1 ${
            !isMyTurn && session.status === 'playing'
              ? 'bg-player-2/20 border-2 border-player-2/30 scale-105 animate-fade-in' 
              : 'bg-card/80 border border-border opacity-70'
          }`}>
            <div className="text-xs sm:text-sm font-bold text-player-2 truncate">{opponentName}</div>
            <div className="text-base sm:text-xl md:text-2xl font-bold score-glow">{opponentScore}</div>
          </div>
        </div>

        {/* Grids - side by side on all screens */}
        <div className="flex flex-row justify-center items-start gap-1 sm:gap-2 md:gap-3 w-full">
          <div className={`flex flex-col items-center transition-all duration-500 ${
            isMyTurn ? 'scale-102 animate-fade-in' : 'opacity-90'
          }`}>
            {renderGrid(false)}
          </div>
          <div className={`flex flex-col items-center transition-all duration-500 ${
            !isMyTurn && session.status === 'playing' ? 'scale-102 animate-fade-in' : 'opacity-90'
          }`}>
            {renderGrid(true)}
          </div>
        </div>
      </div>

      {/* Victory Dialog */}
      <Dialog open={showVictoryDialog} onOpenChange={setShowVictoryDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl text-center">
              {session.winner_index === myPlayerIndex ? '🎉 Victory! 🎉' : '😔 Defeat'}
            </DialogTitle>
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
                        {word} <span className="text-muted-foreground">({word.length})</span>
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
                        {word} <span className="text-muted-foreground">({word.length})</span>
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
                  <Button onClick={() => navigate('/')} variant="outline" size="lg">
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
                  <Button onClick={() => navigate('/')} variant="outline" size="lg">
                    Home
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnlineMultiplayerBoard;
