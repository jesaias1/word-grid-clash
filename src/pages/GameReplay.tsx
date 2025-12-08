import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, FastForward } from 'lucide-react';

interface GameMove {
  id: string;
  session_id: string;
  player_index: number;
  move_number: number;
  letter: string;
  position_row: number;
  position_col: number;
  words_formed: string[];
  points_scored: number;
  created_at: string;
}

interface GameSession {
  id: string;
  player1_name: string;
  player2_name: string;
  board_size: number;
  winner_index: number | null;
}

type GridCell = { letter: string | null; playerIndex: number | null };
type Grid = GridCell[][];

const GameReplay: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<GameSession | null>(null);
  const [moves, setMoves] = useState<GameMove[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState<Grid>([]);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  
  const playbackRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchReplayData = async () => {
      if (!sessionId) return;
      
      // Fetch session details
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('id, player1_name, player2_name, board_size, winner_index')
        .eq('id', sessionId)
        .single();
      
      if (sessionData) {
        setSession(sessionData);
        // Initialize empty grid
        const emptyGrid: Grid = Array(sessionData.board_size).fill(null).map(() =>
          Array(sessionData.board_size).fill(null).map(() => ({ letter: null, playerIndex: null }))
        );
        setGrid(emptyGrid);
      }
      
      // Fetch all moves for this session
      const { data: movesData } = await supabase
        .from('game_moves')
        .select('*')
        .eq('session_id', sessionId)
        .order('move_number', { ascending: true });
      
      if (movesData) {
        setMoves(movesData as GameMove[]);
      }
      
      setLoading(false);
    };
    
    fetchReplayData();
  }, [sessionId]);

  // Playback effect
  useEffect(() => {
    if (isPlaying && currentMoveIndex < moves.length - 1) {
      playbackRef.current = setTimeout(() => {
        stepForward();
      }, 1500 / playbackSpeed);
    } else if (currentMoveIndex >= moves.length - 1) {
      setIsPlaying(false);
    }
    
    return () => {
      if (playbackRef.current) {
        clearTimeout(playbackRef.current);
      }
    };
  }, [isPlaying, currentMoveIndex, playbackSpeed, moves.length]);

  const resetToStart = () => {
    setCurrentMoveIndex(-1);
    setIsPlaying(false);
    if (session) {
      setGrid(Array(session.board_size).fill(null).map(() =>
        Array(session.board_size).fill(null).map(() => ({ letter: null, playerIndex: null }))
      ));
    }
    setScores({ player1: 0, player2: 0 });
  };

  const stepForward = () => {
    if (currentMoveIndex >= moves.length - 1) return;
    
    const nextIndex = currentMoveIndex + 1;
    const move = moves[nextIndex];
    
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));
      newGrid[move.position_row][move.position_col] = {
        letter: move.letter,
        playerIndex: move.player_index
      };
      return newGrid;
    });
    
    setScores(prev => ({
      player1: prev.player1 + (move.player_index === 1 ? move.points_scored : 0),
      player2: prev.player2 + (move.player_index === 2 ? move.points_scored : 0)
    }));
    
    setCurrentMoveIndex(nextIndex);
  };

  const stepBackward = () => {
    if (currentMoveIndex < 0) return;
    
    const move = moves[currentMoveIndex];
    
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));
      newGrid[move.position_row][move.position_col] = { letter: null, playerIndex: null };
      return newGrid;
    });
    
    setScores(prev => ({
      player1: prev.player1 - (move.player_index === 1 ? move.points_scored : 0),
      player2: prev.player2 - (move.player_index === 2 ? move.points_scored : 0)
    }));
    
    setCurrentMoveIndex(currentMoveIndex - 1);
  };

  const jumpToMove = (index: number) => {
    // Reset and replay up to index
    if (!session) return;
    
    const newGrid: Grid = Array(session.board_size).fill(null).map(() =>
      Array(session.board_size).fill(null).map(() => ({ letter: null, playerIndex: null }))
    );
    let p1Score = 0;
    let p2Score = 0;
    
    for (let i = 0; i <= index; i++) {
      const move = moves[i];
      newGrid[move.position_row][move.position_col] = {
        letter: move.letter,
        playerIndex: move.player_index
      };
      if (move.player_index === 1) p1Score += move.points_scored;
      else p2Score += move.points_scored;
    }
    
    setGrid(newGrid);
    setScores({ player1: p1Score, player2: p2Score });
    setCurrentMoveIndex(index);
  };

  const togglePlayPause = () => {
    if (currentMoveIndex >= moves.length - 1) {
      resetToStart();
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const currentMove = currentMoveIndex >= 0 ? moves[currentMoveIndex] : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading replay...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold mb-4">Game not found</h2>
          <Button onClick={() => navigate('/history')}>Back to History</Button>
        </Card>
      </div>
    );
  }

  if (moves.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold mb-4">No replay data available</h2>
          <p className="text-muted-foreground mb-4">This game was played before replay recording was enabled.</p>
          <Button onClick={() => navigate('/history')}>Back to History</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-4xl mx-auto" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Game Replay
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.player1_name} vs {session.player2_name}
          </p>
        </div>
      </div>

      {/* Scoreboard */}
      <Card className="p-4">
        <div className="flex justify-around items-center">
          <div className="text-center">
            <div className="font-bold text-lg">{session.player1_name}</div>
            <div className="text-3xl font-bold text-primary">{scores.player1}</div>
          </div>
          <div className="text-muted-foreground font-bold text-xl">vs</div>
          <div className="text-center">
            <div className="font-bold text-lg">{session.player2_name}</div>
            <div className="text-3xl font-bold text-secondary">{scores.player2}</div>
          </div>
        </div>
      </Card>

      {/* Grid */}
      <div className="flex justify-center">
        <div 
          className="inline-grid gap-1 p-3 rounded-xl border-2 bg-gradient-card border-border shadow-lg"
          style={{ gridTemplateColumns: `repeat(${session.board_size}, 1fr)` }}
        >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const isLightSquare = (rowIndex + colIndex) % 2 === 0;
              const isLastPlaced = currentMove && 
                currentMove.position_row === rowIndex && 
                currentMove.position_col === colIndex;
              
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center 
                    transition-all duration-300 border border-border/40 rounded-lg
                    ${isLightSquare ? 'bg-muted/60' : 'bg-muted-foreground/10'}
                    ${cell.letter ? (cell.playerIndex === 1 ? 'bg-gradient-player-1' : 'bg-gradient-player-2') : ''}
                    ${isLastPlaced ? 'ring-2 ring-yellow-400 scale-110' : ''}
                  `}
                >
                  <span className="font-bold text-lg text-foreground">
                    {cell.letter}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Current move info */}
      {currentMove && (
        <Card className="p-3 text-center">
          <div className="text-sm text-muted-foreground">
            Move {currentMoveIndex + 1} of {moves.length}
          </div>
          <div className="font-semibold">
            {currentMove.player_index === 1 ? session.player1_name : session.player2_name} placed <span className="text-primary font-bold">{currentMove.letter}</span>
          </div>
          {currentMove.words_formed.length > 0 && (
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              +{currentMove.points_scored} points: {currentMove.words_formed.join(', ')}
            </div>
          )}
        </Card>
      )}

      {/* Timeline slider */}
      <div className="px-4">
        <Slider
          value={[currentMoveIndex + 1]}
          min={0}
          max={moves.length}
          step={1}
          onValueChange={([value]) => jumpToMove(value - 1)}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Start</span>
          <span>{currentMoveIndex + 1} / {moves.length}</span>
          <span>End</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={resetToStart}>
          <SkipBack className="w-5 h-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={stepBackward} disabled={currentMoveIndex < 0}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button size="lg" onClick={togglePlayPause} className="w-16 h-16 rounded-full">
          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
        </Button>
        <Button variant="outline" size="icon" onClick={stepForward} disabled={currentMoveIndex >= moves.length - 1}>
          <SkipForward className="w-5 h-5" />
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setPlaybackSpeed(prev => prev === 2 ? 0.5 : prev === 0.5 ? 1 : 2)}
          className="text-xs"
        >
          <FastForward className="w-4 h-4 mr-1" />
          {playbackSpeed}x
        </Button>
      </div>

      {/* Final result */}
      {currentMoveIndex === moves.length - 1 && (
        <Card className="p-4 text-center bg-gradient-card">
          <div className="text-lg font-bold">
            {session.winner_index === null ? (
              <span className="text-yellow-500">Draw!</span>
            ) : session.winner_index === 1 ? (
              <span className="text-primary">{session.player1_name} wins!</span>
            ) : (
              <span className="text-secondary">{session.player2_name} wins!</span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default GameReplay;
