import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getDictionary } from '@/game/dictionary';
import { calculateScore } from '@/game/calculateScore';
import { SCORE_OPTS } from '@/game/scoreConfig';

interface OnlineMultiplayerBoardProps {
  sessionId: string;
}

type Letter = string;
type GridCell = { letter: Letter | null };
type Grid = GridCell[][];
type CooldownState = { [key: string]: number };

const TURN_TIME_LIMIT = 30; // 30 seconds per turn
const WARNING_THRESHOLD = 10; // Show warning at 10 seconds

const OnlineMultiplayerBoard: React.FC<OnlineMultiplayerBoardProps> = ({ sessionId }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState<number | null>(null);
  const [myState, setMyState] = useState<any>(null);
  const [opponentState, setOpponentState] = useState<any>(null);
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIME_LIMIT);

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
        if (payload.new.status === 'finished') {
          setShowWinnerDialog(true);
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
  }, [sessionId, myPlayerIndex]);

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
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMyTurn, session?.status, session?.current_player, myState?.id]);

  const placeLetter = async (row: number, col: number) => {
    if (!isMyTurn || !selectedLetter || !myState) {
      if (!isMyTurn) {
        toast({
          title: "Not your turn",
          description: "Wait for your opponent to play",
          variant: "destructive"
        });
      }
      return;
    }

    const grid = myState.grid_data;
    if (grid[row][col].letter !== null) return;

    const hasAdjacentLetter = [
      [row - 1, col], [row + 1, col],
      [row, col - 1], [row, col + 1]
    ].some(([r, c]) => {
      if (r >= 0 && r < grid.length && c >= 0 && c < grid[0].length) {
        return grid[r][c].letter !== null;
      }
      return false;
    });

    if (!hasAdjacentLetter) {
      toast({
        title: "Invalid placement",
        description: "Letters must be placed adjacent to existing letters",
        variant: "destructive"
      });
      return;
    }

    const newGrid = grid.map((rowArr: GridCell[], r: number) =>
      rowArr.map((cell, c) => 
        r === row && c === col ? { letter: selectedLetter } : cell
      )
    );

    // Convert grid to string format for calculateScore
    const gridForScoring = newGrid.map(row => 
      row.map(cell => cell.letter)
    );

    const result = calculateScore(gridForScoring, SCORE_OPTS());

    const newAvailableLetters = myState.available_letters.filter((l: string) => l !== selectedLetter);
    const newCooldowns = { ...myState.cooldowns };
    newCooldowns[selectedLetter] = session.cooldown_turns;

    Object.keys(newCooldowns).forEach(letter => {
      newCooldowns[letter] = Math.max(0, newCooldowns[letter] - 1);
      if (newCooldowns[letter] === 0) {
        delete newCooldowns[letter];
        newAvailableLetters.push(letter);
      }
    });

    const newScore = myState.score + result.score;
    const newTurnNumber = myState.turn_number + 1;

    await supabase
      .from('game_state')
      .update({
        grid_data: newGrid,
        score: newScore,
        available_letters: newAvailableLetters,
        cooldowns: newCooldowns,
        turn_number: newTurnNumber
      })
      .eq('id', myState.id);

    const nextPlayer = session.current_player === 1 ? 2 : 1;
    await supabase
      .from('game_sessions')
      .update({ current_player: nextPlayer })
      .eq('id', sessionId);

    setSelectedLetter(null);
    setTurnTimeRemaining(TURN_TIME_LIMIT);

    toast({
      title: `+${result.score} points!`,
      description: result.words.map(w => `${w.text} (${w.text.length})`).join(', ')
    });

    if (newAvailableLetters.length === 0 && Object.keys(newCooldowns).length === 0) {
      const opponentScore = opponentState?.score || 0;
      const winnerId = newScore > opponentScore ? myPlayerIndex : (newScore < opponentScore ? (myPlayerIndex === 1 ? 2 : 1) : null);
      
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
    
    const grid = gridState.grid_data;
    const size = grid.length;
    const canPlace = !isOpponent && isMyTurn && selectedLetter;

    return (
      <div className={`inline-grid gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-xl border-2 shadow-lg ${
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
                  w-10 h-10 sm:w-14 sm:h-14 cursor-pointer flex items-center justify-center transition-all duration-300 border border-border/40 rounded-lg
                  ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                  ${cell.letter ? (isOpponent ? 'bg-gradient-player-2' : 'bg-gradient-player-1') : ''}
                  ${canPlace && !cell.letter ? 'hover:scale-110 hover:shadow-lg hover:bg-accent/20' : ''}
                  ${isOpponent || !canPlace ? 'cursor-not-allowed' : ''}
                `}
              >
                {cell.letter && (
                  <span className="font-bold text-sm sm:text-lg drop-shadow-lg text-white">
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
    if (!myState) return null;

    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const cooldowns = myState.cooldowns || {};
    
    return (
      <div className="flex flex-wrap gap-1 sm:gap-2 justify-center max-w-2xl mx-auto">
        {allLetters.map((letter: string) => {
          const cooldown = cooldowns[letter] || 0;
          const isOnCooldown = cooldown > 0;
          const isSelected = selectedLetter === letter;
          const canSelect = !isOnCooldown && isMyTurn;
          
          return (
            <button
              key={letter}
              onClick={() => canSelect && setSelectedLetter(letter)}
              disabled={!canSelect}
              className={`
                w-10 h-10 sm:w-12 sm:h-12 rounded font-bold text-sm sm:text-base transition-all duration-200 relative
                ${isSelected && canSelect
                  ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                  : isOnCooldown
                    ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                    : canSelect
                      ? 'bg-card hover:bg-accent hover:text-accent-foreground cursor-pointer hover:scale-105 border border-border'
                      : 'bg-card text-muted-foreground cursor-not-allowed opacity-50 border border-border'
                }
              `}
            >
              {letter}
              {isOnCooldown && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold">{cooldown}</span>
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

  return (
    <div className="min-h-screen p-2 sm:p-4 space-y-2 sm:space-y-4 max-w-7xl mx-auto flex flex-col">
      <AlertDialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl text-center">
              {session.winner_index === myPlayerIndex ? '🎉 You Win!' : 
               session.winner_index ? '😔 You Lost' : '🤝 Draw!'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base">
              Final Score: {myScore} - {opponentScore}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => navigate('/')}>Back to Menu</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          LETTUS - Online Multiplayer
        </h1>
        <p className="text-xs text-muted-foreground">
          Play against your friend online
        </p>
      </div>

      {/* Game Stats and Controls */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {/* Back Button */}
        <Card className="p-2 sm:p-3 bg-gradient-card">
          <Button onClick={() => navigate('/')} variant="outline" className="w-full text-xs sm:text-sm h-8 sm:h-10">
            Back
          </Button>
        </Card>

        {/* Timer and Turn Info */}
        <Card className="p-2 sm:p-3 bg-gradient-card">
          <div className="text-center space-y-1">
            {session.status === 'finished' ? (
              <div className="space-y-1">
                <div className="text-sm font-bold text-accent">
                  {session.winner_index === myPlayerIndex ? 'You Win!' : 
                   session.winner_index ? 'You Lost' : 'Tie!'}
                </div>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">Game Time</div>
                <div className="text-sm font-semibold">
                  {isMyTurn ? (
                    <span className="text-primary">Your Turn</span>
                  ) : (
                    <span className="text-muted-foreground">Opponent's Turn</span>
                  )}
                </div>
                <div className={`text-lg font-bold ${
                  isMyTurn && turnTimeRemaining <= WARNING_THRESHOLD 
                    ? 'text-destructive animate-pulse' 
                    : 'text-accent'
                }`}>
                  {formatTime(gameTime)}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Selected Letter */}
        <Card className="p-2 sm:p-3 bg-gradient-card">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Selected</div>
            <div className="text-xl sm:text-2xl font-bold text-accent">
              {selectedLetter || '?'}
            </div>
          </div>
        </Card>
      </div>

      {/* Available Letters */}
      {session.status === 'playing' && (
        <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-2 sm:p-3 mx-auto">
          <div className="text-center mb-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {isMyTurn ? 'Select a Letter' : 'Opponent\'s Turn'}
            </span>
          </div>
          {renderAvailableLetters()}
        </div>
      )}

      {/* Game Grids */}
      <div className="flex flex-col items-center gap-2 sm:gap-4">
        {/* Player cards with timer in the middle */}
        <div className="flex justify-center items-center gap-2 sm:gap-4 w-full max-w-2xl">
          {/* You */}
          <div className={`p-2 sm:p-4 rounded-xl text-center shadow-md transition-all duration-300 flex-1 ${
            isMyTurn 
              ? 'bg-player-1/20 border-2 border-player-1/30 scale-105' 
              : 'bg-card/80 border border-border'
          }`}>
            <div className="text-sm sm:text-xl font-bold text-player-1 truncate">{myName}</div>
            <div className="text-2xl sm:text-3xl font-bold score-glow">{myScore}</div>
          </div>

          {/* Timer */}
          {session.status === 'playing' && (
            <Card className={`p-2 sm:p-4 shadow-lg border-2 transition-all ${
              isMyTurn && turnTimeRemaining <= WARNING_THRESHOLD
                ? 'border-destructive bg-destructive/10 animate-pulse' 
                : 'border-primary bg-primary/5'
            }`}>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">
                  {isMyTurn ? 'Time' : 'Wait'}
                </div>
                <div className={`text-2xl sm:text-4xl font-bold ${
                  isMyTurn && turnTimeRemaining <= WARNING_THRESHOLD 
                    ? 'text-destructive' 
                    : 'text-primary'
                }`}>
                  {isMyTurn ? `${turnTimeRemaining}s` : '...'}
                </div>
              </div>
            </Card>
          )}

          {/* VS text when game ended */}
          {session.status === 'finished' && (
            <div className="flex items-center justify-center px-2 sm:px-6">
              <div className="text-2xl sm:text-3xl font-bold text-muted-foreground">VS</div>
            </div>
          )}

          {/* Opponent */}
          <div className={`p-2 sm:p-4 rounded-xl text-center shadow-md transition-all duration-300 flex-1 ${
            !isMyTurn && session.status === 'playing'
              ? 'bg-player-2/20 border-2 border-player-2/30 scale-105' 
              : 'bg-card/80 border border-border'
          }`}>
            <div className="text-sm sm:text-xl font-bold text-player-2 truncate">{opponentName}</div>
            <div className="text-2xl sm:text-3xl font-bold score-glow">{opponentScore}</div>
          </div>
        </div>

        {/* Grids - side by side on desktop, stacked on mobile */}
        <div className="flex flex-col sm:flex-row justify-center items-start gap-2 sm:gap-6 w-full">
          <div className="flex flex-col items-center w-full sm:w-auto">
            {renderGrid(false)}
          </div>
          <div className="flex flex-col items-center w-full sm:w-auto">
            {renderGrid(true)}
          </div>
        </div>
      </div>

      {/* Compact Rules */}
      <div className="text-center mt-4">
        <div className="text-sm text-muted-foreground font-medium">
          30s per turn • Click letter then cell to place • 3+ letter words • Score = letters in valid words
        </div>
      </div>
    </div>
  );
};

export default OnlineMultiplayerBoard;
