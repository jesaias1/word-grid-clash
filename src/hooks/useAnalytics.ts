import { useCallback, useEffect } from 'react';

type EventType = 
  | 'page_view'
  | 'game_start'
  | 'game_end'
  | 'tutorial_start'
  | 'tutorial_complete'
  | 'tutorial_skip'
  | 'word_found'
  | 'turn_timeout'
  | 'rematch'
  | 'online_game_create'
  | 'online_game_join';

interface AnalyticsEvent {
  type: EventType;
  properties?: Record<string, any>;
  timestamp: string;
  sessionId: string;
  url: string;
}

// Generate a session ID that persists for the browser session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

// Get stored analytics data
const getStoredEvents = (): AnalyticsEvent[] => {
  try {
    return JSON.parse(localStorage.getItem('analytics_events') || '[]');
  } catch {
    return [];
  }
};

// Store analytics event locally
const storeEvent = (event: AnalyticsEvent) => {
  try {
    const events = getStoredEvents();
    events.push(event);
    // Keep only last 100 events to prevent localStorage bloat
    const trimmedEvents = events.slice(-100);
    localStorage.setItem('analytics_events', JSON.stringify(trimmedEvents));
  } catch (e) {
    // Silently fail if localStorage is full or unavailable
  }
};

// Get analytics summary
export const getAnalyticsSummary = () => {
  const events = getStoredEvents();
  
  const summary = {
    totalGames: events.filter(e => e.type === 'game_start').length,
    gamesCompleted: events.filter(e => e.type === 'game_end').length,
    tutorialCompletions: events.filter(e => e.type === 'tutorial_complete').length,
    tutorialSkips: events.filter(e => e.type === 'tutorial_skip').length,
    wordsFound: events.filter(e => e.type === 'word_found').length,
    rematches: events.filter(e => e.type === 'rematch').length,
    onlineGamesCreated: events.filter(e => e.type === 'online_game_create').length,
    onlineGamesJoined: events.filter(e => e.type === 'online_game_join').length,
    gamesByMode: {} as Record<string, number>,
    lastPlayed: events.filter(e => e.type === 'game_start').pop()?.timestamp || null
  };

  // Count games by mode
  events
    .filter(e => e.type === 'game_start' && e.properties?.mode)
    .forEach(e => {
      const mode = e.properties!.mode;
      summary.gamesByMode[mode] = (summary.gamesByMode[mode] || 0) + 1;
    });

  return summary;
};

export const useAnalytics = () => {
  const sessionId = getSessionId();

  // Track page views on mount
  useEffect(() => {
    trackEvent('page_view', { path: window.location.pathname });
  }, []);

  const trackEvent = useCallback((type: EventType, properties?: Record<string, any>) => {
    const event: AnalyticsEvent = {
      type,
      properties,
      timestamp: new Date().toISOString(),
      sessionId,
      url: window.location.href
    };

    storeEvent(event);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', type, properties);
    }
  }, [sessionId]);

  const trackGameStart = useCallback((mode: string, playerCount?: number) => {
    trackEvent('game_start', { mode, playerCount });
  }, [trackEvent]);

  const trackGameEnd = useCallback((mode: string, winner?: string, scores?: number[]) => {
    trackEvent('game_end', { mode, winner, scores });
  }, [trackEvent]);

  const trackTutorial = useCallback((action: 'start' | 'complete' | 'skip') => {
    trackEvent(action === 'start' ? 'tutorial_start' : action === 'complete' ? 'tutorial_complete' : 'tutorial_skip');
  }, [trackEvent]);

  const trackWordFound = useCallback((word: string, points: number) => {
    trackEvent('word_found', { word, points, wordLength: word.length });
  }, [trackEvent]);

  const trackRematch = useCallback((mode: string) => {
    trackEvent('rematch', { mode });
  }, [trackEvent]);

  const trackOnlineGame = useCallback((action: 'create' | 'join', inviteCode?: string) => {
    trackEvent(action === 'create' ? 'online_game_create' : 'online_game_join', { inviteCode });
  }, [trackEvent]);

  return {
    trackEvent,
    trackGameStart,
    trackGameEnd,
    trackTutorial,
    trackWordFound,
    trackRematch,
    trackOnlineGame,
    getAnalyticsSummary
  };
};

export default useAnalytics;
