import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '@/components/GameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import TutorialMode from '@/components/TutorialMode';
import { Button } from '@/components/ui/button';
import lettusLogo from '@/assets/lettus-logo.png';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useDailyChallenge } from '@/hooks/useDailyChallenge';
import { useIsMobile } from '@/hooks/use-mobile';
import { GraduationCap, Users, ArrowLeft, Target, Flame, Clock, Download } from 'lucide-react';

// Calculate time until midnight for next daily challenge
const getTimeUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
};

const formatCountdown = (ms: number) => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

type GameMode = 'menu' | 'local' | 'local-multiplayer-select' | 'local-multiplayer';

// Store the deferred prompt for PWA installation
let deferredPrompt: any = null;

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [localPlayerCount, setLocalPlayerCount] = useState<number>(2);
  const [showTutorial, setShowTutorial] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const navigate = useNavigate();
  const { playFeedback } = useSoundEffects(true, true);
  const { trackGameStart, trackTutorial } = useAnalytics();
  const { streak, hasCompletedToday, loading: dailyLoading } = useDailyChallenge();
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  const isMobile = useIsMobile();
  
  const boardSize = 5;
  const cooldownTurns = 4;

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setCanInstall(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    playFeedback('click');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    deferredPrompt = null;
  };

  // Countdown timer for next daily challenge
  useEffect(() => {
    if (!hasCompletedToday) return;
    
    const interval = setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [hasCompletedToday]);

  // Check if user has seen tutorial
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleBackToMenu = () => {
    setGameMode('menu');
  };

  // Player count selection screen
  if (gameMode === 'local-multiplayer-select') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
        <div className="text-center space-y-6 max-w-md w-full animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Users className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-bold">Local Multiplayer</h1>
          </div>
          
          <p className="text-muted-foreground">How many players?</p>
          
          <div className="grid grid-cols-2 gap-3">
            {[2, 3, 4, 5].map((count) => (
              <Button
                key={count}
                onClick={() => {
                  playFeedback('click');
                  trackGameStart('local-multiplayer', count);
                  setLocalPlayerCount(count);
                  setGameMode('local-multiplayer');
                }}
                size="lg"
                variant="secondary"
                className="h-20 text-xl font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105"
              >
                {count} Players
              </Button>
            ))}
          </div>
          
          <Button
            onClick={() => {
              playFeedback('click');
              setGameMode('menu');
            }}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  // Menu screen
  if (gameMode === 'menu') {
    return (
      <div className="min-h-screen flex items-center justify-center p-2 py-2" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}>
        {showTutorial && (
          <TutorialMode
            forceOpen={true}
            onComplete={() => {
              setShowTutorial(false);
              trackTutorial('complete');
              localStorage.setItem('hasSeenTutorial', 'true');
            }}
          />
        )}
        <div className="text-center space-y-1.5 max-w-2xl w-full animate-fade-in-up">
          <div className="flex items-center justify-center mb-4 animate-float">
            <img src={lettusLogo} alt="Lettus Logo" className="max-w-full h-auto w-[380px] sm:w-[480px] object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-105" />
          </div>

          {/* Daily Challenge Button - Featured */}
          <Button 
            onClick={() => {
              playFeedback('click');
              navigate('/daily');
            }}
            size="lg" 
            className="w-full max-w-md mx-auto h-16 text-base font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white border-0"
          >
            <Target className="w-5 h-5 mr-2" />
            Daily Challenge
            {streak > 0 && (
              <span className="ml-2 flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full text-sm">
                <Flame className="w-4 h-4" />
                {streak}
              </span>
            )}
            {hasCompletedToday && (
              <span className="ml-2 flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full text-sm">
                <Clock className="w-3 h-3" />
                {formatCountdown(countdown)}
              </span>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <Button 
              onClick={() => {
                playFeedback('click');
                trackGameStart('solo');
                setGameMode('local');
              }}
              size="lg" 
              className="w-full h-14 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
            >
              Solo Game
            </Button>
            <Button 
              onClick={() => {
                playFeedback('click');
                navigate('/online-setup');
              }}
              size="lg" 
              className="w-full h-14 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              variant="default"
            >
              Online 1v1
            </Button>
            <Button 
              onClick={() => {
                playFeedback('click');
                setGameMode('local-multiplayer-select');
              }}
              size="lg" 
              className="w-full h-14 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up col-span-2"
              variant="secondary"
            >
              <Users className="w-5 h-5 mr-2" />
              Local Multiplayer (2-5 Players)
            </Button>
          </div>

          {/* Game History and Tutorial Buttons */}
          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <Button 
              onClick={() => {
                playFeedback('click');
                navigate('/history');
              }}
              size="lg" 
              variant="outline"
              className="w-full h-12 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
            >
              Game History
            </Button>
            <Button 
              onClick={() => {
                playFeedback('click');
                setShowTutorial(true);
              }}
              size="lg" 
              variant="outline"
              className="w-full h-12 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Tutorial
            </Button>
          </div>

          {/* Add to Home Screen Button - Only shows on mobile */}
          {isMobile && (
            <div className="max-w-md mx-auto">
              <Button 
                onClick={() => {
                  playFeedback('click');
                  if (canInstall) {
                    handleInstallClick();
                  } else {
                    // Show instructions for browsers that don't support beforeinstallprompt
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const message = isIOS 
                      ? "Tap the Share button (box with arrow) in Safari, then 'Add to Home Screen'"
                      : "Tap the browser menu (⋮), then 'Add to Home Screen' or 'Install App'";
                    alert(message);
                  }
                }}
                size="lg" 
                variant="outline"
                className="w-full h-12 text-sm font-bold shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up border-primary/50 text-primary hover:bg-primary/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Add to Home Screen
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Local solo game
  if (gameMode === 'local') {
    return <GameBoard boardSize={boardSize} onBackToMenu={handleBackToMenu} />;
  }

  // Local multiplayer game (2-5 players)
  if (gameMode === 'local-multiplayer') {
    return <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} boardSize={boardSize} playerCount={localPlayerCount} cooldownTurns={cooldownTurns} />;
  }

  return <GameBoard boardSize={boardSize} onBackToMenu={handleBackToMenu} />;
};

export default Index;
