import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Get local date string in YYYY-MM-DD format
const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface DailyChallenge {
  id: string;
  challenge_date: string;
  starting_grid: (string | null)[][];
  letter_sequence: string[];
  bronze_target: number;
  silver_target: number;
  gold_target: number;
}

interface DailyAttempt {
  id: string;
  user_id: string;
  challenge_date: string;
  score: number;
  tier_achieved: 'none' | 'bronze' | 'silver' | 'gold' | 'diamond' | null;
  words_found: string[];
  completed: boolean;
  completed_at: string | null;
}

export type Tier = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';

export const getTierFromScore = (score: number, targets: { bronze: number; silver: number; gold: number }): Tier => {
  if (score >= targets.gold + 20) return 'diamond';
  if (score >= targets.gold) return 'gold';
  if (score >= targets.silver) return 'silver';
  if (score >= targets.bronze) return 'bronze';
  return 'none';
};

export const getTierColor = (tier: Tier): string => {
  switch (tier) {
    case 'diamond': return 'text-cyan-400';
    case 'gold': return 'text-yellow-400';
    case 'silver': return 'text-gray-300';
    case 'bronze': return 'text-orange-600';
    default: return 'text-muted-foreground';
  }
};

export const getTierEmoji = (tier: Tier): string => {
  switch (tier) {
    case 'diamond': return '💎';
    case 'gold': return '🥇';
    case 'silver': return '🥈';
    case 'bronze': return '🥉';
    default: return '⬜';
  }
};

export const useDailyChallenge = () => {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [attempt, setAttempt] = useState<DailyAttempt | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initializeUser();
  }, []);

  const initializeUser = async () => {
    try {
      // Get or create anonymous user
      let { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Sign in anonymously
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      
      if (session?.user) {
        setUserId(session.user.id);
        await fetchDailyData(session.user.id);
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyData = async (uid: string) => {
    try {
      // Get or create today's challenge using the database function
      const { data: challengeData, error: challengeError } = await supabase
        .rpc('get_or_create_daily_challenge');
      
      if (challengeError) throw challengeError;
      
      if (challengeData) {
        setChallenge({
          id: challengeData.id,
          challenge_date: challengeData.challenge_date,
          starting_grid: challengeData.starting_grid as (string | null)[][],
          letter_sequence: challengeData.letter_sequence as string[],
          bronze_target: challengeData.bronze_target,
          silver_target: challengeData.silver_target,
          gold_target: challengeData.gold_target,
        });
      }
      
      // Get today's attempt if exists - use local date
      const today = getLocalDateString();
      const { data: attemptData } = await supabase
        .from('daily_challenge_attempts')
        .select('*')
        .eq('user_id', uid)
        .eq('challenge_date', today)
        .maybeSingle();
      
      if (attemptData) {
        setAttempt({
          ...attemptData,
          words_found: attemptData.words_found as string[] || [],
          tier_achieved: attemptData.tier_achieved as Tier | null,
        });
      }
      
      // Get streak
      const { data: streakData } = await supabase
        .rpc('get_user_streak', { p_user_id: uid });
      
      setStreak(streakData || 0);
    } catch (error) {
      console.error('Error fetching daily data:', error);
    }
  };

  const startAttempt = async () => {
    if (!userId || !challenge) return null;
    
    const today = getLocalDateString();
    
    // Check if attempt already exists
    if (attempt) return attempt;
    
    const { data, error } = await supabase
      .from('daily_challenge_attempts')
      .insert({
        user_id: userId,
        challenge_date: today,
        score: 0,
        tier_achieved: 'none',
        words_found: [],
        completed: false,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error starting attempt:', error);
      return null;
    }
    
    const newAttempt: DailyAttempt = {
      ...data,
      words_found: data.words_found as string[] || [],
      tier_achieved: data.tier_achieved as Tier,
    };
    setAttempt(newAttempt);
    return newAttempt;
  };

  const updateAttempt = async (score: number, words: string[]) => {
    if (!userId || !attempt || !challenge) return;
    
    const tier = getTierFromScore(score, {
      bronze: challenge.bronze_target,
      silver: challenge.silver_target,
      gold: challenge.gold_target,
    });
    
    const { error } = await supabase
      .from('daily_challenge_attempts')
      .update({
        score,
        words_found: words,
        tier_achieved: tier,
      })
      .eq('id', attempt.id);
    
    if (error) {
      console.error('Error updating attempt:', error);
      return;
    }
    
    setAttempt(prev => prev ? { ...prev, score, words_found: words, tier_achieved: tier } : null);
  };

  const completeAttempt = async (finalScore: number, words: string[]) => {
    if (!userId || !attempt || !challenge) return;
    
    const tier = getTierFromScore(finalScore, {
      bronze: challenge.bronze_target,
      silver: challenge.silver_target,
      gold: challenge.gold_target,
    });
    
    const { error } = await supabase
      .from('daily_challenge_attempts')
      .update({
        score: finalScore,
        words_found: words,
        tier_achieved: tier,
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', attempt.id);
    
    if (error) {
      console.error('Error completing attempt:', error);
      return;
    }
    
    setAttempt(prev => prev ? { 
      ...prev, 
      score: finalScore, 
      words_found: words, 
      tier_achieved: tier,
      completed: true,
      completed_at: new Date().toISOString()
    } : null);
    
    // Update streak
    const { data: newStreak } = await supabase
      .rpc('get_user_streak', { p_user_id: userId });
    setStreak(newStreak || 0);
  };

  const generateShareText = (score: number, tier: Tier): string => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const emoji = getTierEmoji(tier);
    
    // Generate progress bar based on tier
    const tiers = ['none', 'bronze', 'silver', 'gold', 'diamond'];
    const tierIndex = tiers.indexOf(tier);
    const progressBar = tiers.slice(1).map((t, i) => 
      i < tierIndex ? getTierEmoji(t as Tier) : '⬜'
    ).join('');
    
    return `Lettus Daily ${today}\n${emoji} ${score} pts\n${progressBar}\n🔥 ${streak} day streak\nlettus.fun`;
  };

  return {
    challenge,
    attempt,
    streak,
    loading,
    userId,
    startAttempt,
    updateAttempt,
    completeAttempt,
    generateShareText,
    hasCompletedToday: attempt?.completed || false,
  };
};
