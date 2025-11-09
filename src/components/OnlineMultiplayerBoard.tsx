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
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionData) {
        setSession(sessionData);
        
        const { data: states } = await supabase
          .from('game_state')
          .select('*')
          .eq('session_id', sessionId);

        if (states && states.length > 0) {
          const playerIndex = states.length === 1 ? 1 : 2;
          setMyPlayerIndex(playerIndex);
          
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
    const dict = getDictionary();

    if (result.words.length === 0) {
      toast({
        title: "Invalid word",
        description: "The placed letter doesn't form any valid words",
        variant: "destructive"
      });
      return;
    }

    const allValid = result.words.every(w => dict.has(w.text));
    if (!allValid) {
      const invalidWords = result.words.filter(w => !dict.has(w.text)).map(w => w.text);
      toast({
        title: "Invalid word(s)",
        description: `Not valid: ${invalidWords.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

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

  const renderGrid = () => {
    if (!myState) return null;
    
    const grid = myState.grid_data;
    const size = grid.length;

    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
          {grid.map((row: GridCell[], rowIndex: number) =>
            row.map((cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => placeLetter(rowIndex, colIndex)}
                disabled={!isMyTurn || !selectedLetter}
                className={`
                  w-14 h-14 rounded-lg border-2 font-bold text-lg
                  transition-all duration-200
                  ${cell.letter 
                    ? 'bg-primary/20 border-primary text-primary shadow-md' 
                    : 'bg-card border-border hover:border-primary/40 hover:bg-card/80 hover:scale-105'
                  }
                  ${!isMyTurn || !selectedLetter ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                `}
              >
                {cell.letter}
              </button>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderAvailableLetters = () => {
    if (!myState || !isMyTurn) return null;

    const letters = myState.available_letters;
    
    return (
      <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
        {letters.map((letter: string, index: number) => (
          <button
            key={`${letter}-${index}`}
            onClick={() => setSelectedLetter(letter)}
            className={`
              w-12 h-12 rounded-xl border-2 font-bold text-base
              transition-all duration-200
              ${selectedLetter === letter
                ? 'bg-primary border-primary text-primary-foreground shadow-glow scale-110'
                : 'bg-card border-border hover:border-primary/60 hover:scale-105 hover:shadow-md'
              }
            `}
          >
            {letter}
          </button>
        ))}
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

  return (
    <div className="min-h-screen p-4 py-6">
      <AlertDialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">
              {session.winner_index === myPlayerIndex ? '🎉 You Win!' : 
               session.winner_index ? '😔 You Lost' : '🤝 Draw!'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Final Score: {myState.score} - {opponentState?.score || 0}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => navigate('/')}>Back to Menu</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <Button onClick={() => navigate('/')} variant="outline" className="shadow-lg">
            Back to Menu
          </Button>
          <Card className="px-4 py-2 shadow-lg">
            <div className="text-center font-bold text-lg">{formatTime(gameTime)}</div>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-3 items-center">
          <Card className={`p-3 shadow-lg border-2 ${isMyTurn ? 'border-primary bg-primary/10 scale-105' : ''} transition-all`}>
            <div className="text-sm text-muted-foreground">You</div>
            <div className="font-bold text-xl">{myName}</div>
            <div className="text-2xl font-bold text-primary">{myState.score}</div>
          </Card>

          {isMyTurn && session.status === 'playing' && (
            <Card className={`p-4 shadow-lg border-2 transition-all ${
              turnTimeRemaining <= WARNING_THRESHOLD 
                ? 'border-destructive bg-destructive/10 animate-pulse' 
                : 'border-primary bg-primary/5'
            }`}>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Time Left</div>
                <div className={`text-4xl font-bold ${
                  turnTimeRemaining <= WARNING_THRESHOLD ? 'text-destructive' : 'text-primary'
                }`}>
                  {turnTimeRemaining}s
                </div>
              </div>
            </Card>
          )}

          {(!isMyTurn || session.status !== 'playing') && (
            <div className="flex items-center justify-center">
              <div className="text-2xl font-bold text-muted-foreground">VS</div>
            </div>
          )}

          <Card className={`p-3 shadow-lg border-2 ${!isMyTurn && session.status === 'playing' ? 'border-primary bg-primary/10 scale-105' : ''} transition-all`}>
            <div className="text-sm text-muted-foreground">Opponent</div>
            <div className="font-bold text-xl">{opponentName || 'Waiting...'}</div>
            <div className="text-2xl font-bold text-primary">{opponentState?.score || 0}</div>
          </Card>
        </div>

        {selectedLetter && isMyTurn && (
          <Card className="p-3 shadow-lg border-2 border-primary bg-primary/10">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Selected Letter</div>
              <div className="text-3xl font-bold text-primary">{selectedLetter}</div>
            </div>
          </Card>
        )}

        <Card className="p-4 shadow-lg border-2">
          {renderGrid()}
        </Card>

        {isMyTurn ? (
          <Card className="p-4 shadow-lg border-2">
            <h3 className="text-center font-bold mb-3 text-foreground">Your Turn - Available Letters</h3>
            {renderAvailableLetters()}
          </Card>
        ) : (
          <Card className="p-4 shadow-lg border-2 bg-muted/50">
            <p className="text-center text-muted-foreground font-medium">Waiting for {opponentName}'s move...</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OnlineMultiplayerBoard;
