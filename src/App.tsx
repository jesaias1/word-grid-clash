import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import PageTransition from "./components/PageTransition";
import AchievementToaster from "./components/game/AchievementToaster";
import SplashScreen from "./components/SplashScreen";
import Index from "./pages/Index";
// Secondary screens load on demand so the menu opens fast
const NotFound = lazy(() => import("./pages/NotFound"));
const OnlineGameSetup = lazy(() => import("./pages/OnlineGameSetup"));
const OnlineGame = lazy(() => import("./pages/OnlineGame"));
const GameHistory = lazy(() => import("./pages/GameHistory"));
const GameReplay = lazy(() => import("./pages/GameReplay"));
const DailyChallenge = lazy(() => import("./pages/DailyChallenge"));

const RouteFallback = () => (
  <div className="min-h-[100dvh] flex items-center justify-center text-4xl animate-bounce-subtle">🥬</div>
);
import { loadDictionary, loadCommonWords } from "./game/dictionary";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation();

  return (
    <PageTransition key={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/daily" element={<DailyChallenge />} />
        <Route path="/history" element={<GameHistory />} />
        <Route path="/replay/:sessionId" element={<GameReplay />} />
        <Route path="/online-setup" element={<OnlineGameSetup />} />
        <Route path="/online/:gameId" element={<OnlineGame />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </PageTransition>
  );
};

const App = () => {
  useEffect(() => {
    loadDictionary();
    loadCommonWords();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AchievementToaster />
        <SplashScreen />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
        <Analytics />
        <SpeedInsights />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
