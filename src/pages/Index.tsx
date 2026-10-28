import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import GameBoard, { DIFFICULTY_LABEL } from '@/components/GameBoard';
import LocalMultiplayerBoard from '@/components/LocalMultiplayerBoard';
import TutorialMode from '@/components/TutorialMode';
import InstallInstructionsDialog from '@/components/InstallInstructionsDialog';
import FloatingTiles from '@/components/home/FloatingTiles';
import ProgressCard from '@/components/home/ProgressCard';
import { SoundToggle } from '@/components/game/GameChrome';
import lettusLogo from '@/assets/lettus-logo.webp';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useDailyChallenge } from '@/hooks/useDailyChallenge';
import { useIsMobile } from '@/hooks/use-mobile';
import { loadSoloGameState } from '@/hooks/useGameStatePersistence';
import type { Difficulty } from '@/game/ai';
import { BOARD_SIZE, COOLDOWN_TURNS } from '@/game/constants';
import { useProgress } from '@/lib/progress';
import { GraduationCap, Users, ArrowLeft, Target, Flame, Clock, Download, Bot, Globe, History, Play } from 'lucide-react';

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

type GameMode = 'menu' | 'solo-select' | 'local' | 'local-multiplayer-select' | 'local-multiplayer';

// Store the deferred prompt for PWA installation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredPrompt: any = null;

const DIFFICULTIES: { id: Difficulty; emoji: string; blurb: string }[] = [
  { id: 'easy', emoji: '🌱', blurb: 'Relaxed. Great for learning.' },
  { id: 'medium', emoji: '🥬', blurb: 'A fair fight. Plays solid words.' },
  { id: 'hard', emoji: '🦖', blurb: 'Hunts the best move every turn. 2× XP for a win.' },
];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } };
const item: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } } };

const MenuButton = ({ onClick, className = '', children }: { onClick: () => void; className?: string; children: React.ReactNode }) => (
  <motion.button
    type="button"
    variants={item}
    whileHover={{ scale: 1.03, y: -2 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`btn-game w-full flex items-center justify-center gap-2 ${className}`}
  >
    {children}
  </motion.button>
);

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [localPlayerCount, setLocalPlayerCount] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    try { return (localStorage.getItem('lettus_difficulty') as Difficulty) || 'medium'; } catch { return 'medium'; }
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const navigate = useNavigate();
  const { playFeedback } = useSoundEffects();
  const { trackGameStart, trackTutorial } = useAnalytics();
  const { streak, hasCompletedToday } = useDailyChallenge();
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  const isMobile = useIsMobile();
  const progress = useProgress();
  const savedSolo = gameMode === 'menu' ? loadSoloGameState() : null;

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    if (window.matchMedia('(display-mode: standalone)').matches) setCanInstall(false);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setCanInstall(false);
    deferredPrompt = null;
  };

  // Countdown timer for next daily challenge
  useEffect(() => {
    if (!hasCompletedToday) return;
    const interval = setInterval(() => setCountdown(getTimeUntilMidnight()), 1000);
    return () => clearInterval(interval);
  }, [hasCompletedToday]);

  // First visit: show the tutorial
  useEffect(() => {
    try {
      if (!localStorage.getItem('hasSeenTutorial')) setShowTutorial(true);
    } catch { /* storage blocked */ }
  }, []);

  const startSolo = (d: Difficulty) => {
    playFeedback('click');
    setDifficulty(d);
    try { localStorage.setItem('lettus_difficulty', d); } catch { /* ignore */ }
    trackGameStart('solo');
    setGameMode('local');
  };

  const handleBackToMenu = () => setGameMode('menu');

  const subScreen = (title: string, icon: React.ReactNode, body: React.ReactNode) => (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 pt-safe">
      <FloatingTiles count={8} />
      <motion.div initial="hidden" animate="show" variants={container} className="relative text-center space-y-5 max-w-sm w-full">
        <motion.div variants={item} className="flex items-center justify-center gap-3">
          {icon}
          <h1 className="text-3xl font-bold">{title}</h1>
        </motion.div>
        {body}
        <motion.button
          variants={item}
          onClick={() => { playFeedback('click'); setGameMode('menu'); }}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors pt-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </motion.button>
      </motion.div>
    </div>
  );

  if (gameMode === 'solo-select') {
    return subScreen('Choose your rival', <Bot className="w-9 h-9 text-primary" />, (
      <div className="flex flex-col gap-3">
        {DIFFICULTIES.map(d => (
          <motion.button
            key={d.id}
            variants={item}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => startSolo(d.id)}
            className={`glass rounded-2xl p-4 flex items-center gap-4 text-left ${difficulty === d.id ? 'ring-2 ring-primary' : ''}`}
          >
            <span className="text-4xl">{d.emoji}</span>
            <span className="flex-1">
              <span className="block font-display font-semibold text-xl">{DIFFICULTY_LABEL[d.id]}</span>
              <span className="block text-sm text-muted-foreground">{d.blurb}</span>
            </span>
            {d.id === 'hard' && progress.stats.hardWins > 0 && <span className="text-xs text-gold font-bold">🗡️ ×{progress.stats.hardWins}</span>}
          </motion.button>
        ))}
      </div>
    ));
  }

  if (gameMode === 'local-multiplayer-select') {
    return subScreen('Local Multiplayer', <Users className="w-9 h-9 text-primary" />, (
      <>
        <motion.p variants={item} className="text-muted-foreground">Pass the device around. How many players?</motion.p>
        <div className="grid grid-cols-3 gap-3">
          {[2, 3, 4].map(count => (
            <motion.button
              key={count}
              variants={item}
              whileHover={{ scale: 1.06, y: -3 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                playFeedback('click');
                trackGameStart('local-multiplayer', count);
                setLocalPlayerCount(count);
                setGameMode('local-multiplayer');
              }}
              className={`tile ${count === 3 ? 'tile-leaf' : 'tile-p1'} aspect-square flex flex-col items-center justify-center`}
            >
              <span className="text-5xl">{count}</span>
              <span className="text-xs font-sans font-bold opacity-80">players</span>
            </motion.button>
          ))}
        </div>
      </>
    ));
  }

  if (gameMode === 'local') {
    return <GameBoard boardSize={BOARD_SIZE} difficulty={difficulty} onBackToMenu={handleBackToMenu} />;
  }

  if (gameMode === 'local-multiplayer') {
    return <LocalMultiplayerBoard onBackToMenu={handleBackToMenu} boardSize={BOARD_SIZE} playerCount={localPlayerCount} cooldownTurns={COOLDOWN_TURNS} />;
  }

  // Menu
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-4 pt-safe relative">
      <FloatingTiles />
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
      <div className="absolute top-3 right-3" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <SoundToggle />
      </div>

      <motion.div initial="hidden" animate="show" variants={container} className="relative text-center max-w-md w-full space-y-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="flex items-center justify-center mb-1"
        >
          <motion.img
            src={lettusLogo}
            alt="Lettus"
            className="w-[min(92vw,440px)] h-auto object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.5)]"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
        <motion.p variants={item} className="text-sm text-muted-foreground -mt-1 mb-2">Grow words. Grab letters. Outscore everyone.</motion.p>

        <motion.div variants={item}><ProgressCard /></motion.div>

        <MenuButton
          onClick={() => { playFeedback('click'); navigate('/daily'); }}
          className="h-16 text-lg text-white bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 overflow-hidden shimmer"
        >
          <Target className="w-5 h-5" />
          Daily Challenge
          {streak > 0 && (
            <span className="ml-1 flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full text-sm font-sans">
              <Flame className="w-4 h-4" />{streak}
            </span>
          )}
          {hasCompletedToday && (
            <span className="ml-1 flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full text-sm font-sans tabular-nums">
              <Clock className="w-3 h-3" />{formatCountdown(countdown)}
            </span>
          )}
        </MenuButton>

        <div className="grid grid-cols-2 gap-3">
          <MenuButton
            onClick={() => {
              playFeedback('click');
              // A game in progress resumes straight away
              if (savedSolo) setGameMode('local'); else setGameMode('solo-select');
            }}
            className="h-16 tile-p1 text-primary-foreground text-lg flex-col !gap-0"
          >
            <span className="flex items-center gap-2">{savedSolo ? <Play className="w-5 h-5" /> : <Bot className="w-5 h-5" />} Solo</span>
            <span className="text-[11px] font-sans font-bold opacity-75">{savedSolo ? 'Continue game' : 'vs AI'}</span>
          </MenuButton>
          <MenuButton
            onClick={() => { playFeedback('click'); navigate('/online-setup'); }}
            className="h-16 tile-leaf text-cream text-lg flex-col !gap-0"
          >
            <span className="flex items-center gap-2"><Globe className="w-5 h-5" /> Online</span>
            <span className="text-[11px] font-sans font-bold opacity-75">1v1 with a friend</span>
          </MenuButton>
        </div>

        <MenuButton
          onClick={() => { playFeedback('click'); setGameMode('local-multiplayer-select'); }}
          className="h-14 bg-secondary/80 text-secondary-foreground"
        >
          <Users className="w-5 h-5" /> Local Multiplayer <span className="font-sans text-xs opacity-70">(2–4)</span>
        </MenuButton>

        <div className="grid grid-cols-2 gap-3">
          <MenuButton onClick={() => { playFeedback('click'); navigate('/history'); }} className="h-12 bg-muted text-foreground text-sm">
            <History className="w-4 h-4" /> History
          </MenuButton>
          <MenuButton onClick={() => { playFeedback('click'); setShowTutorial(true); }} className="h-12 bg-muted text-foreground text-sm">
            <GraduationCap className="w-4 h-4" /> How to play
          </MenuButton>
        </div>

        {isMobile && (
          <MenuButton
            onClick={() => {
              playFeedback('click');
              if (canInstall) handleInstallClick(); else setShowInstallDialog(true);
            }}
            className="h-11 bg-transparent border border-primary/40 text-primary text-sm !shadow-none"
          >
            <Download className="w-4 h-4" /> {canInstall ? 'Install App' : 'Add to Home Screen'}
          </MenuButton>
        )}

        <InstallInstructionsDialog open={showInstallDialog} onOpenChange={setShowInstallDialog} />
      </motion.div>
    </div>
  );
};

export default Index;
