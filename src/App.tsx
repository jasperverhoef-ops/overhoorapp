import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { ListsPage } from './pages/ListsPage';
import { QuizPage } from './pages/QuizPage';
import { StatsPage } from './pages/StatsPage';
import { ModeSelectPage } from './pages/ModeSelectPage';
import { SelfPlaySelectPage } from './pages/SelfPlaySelectPage';
import { ListDetail } from './components/lists/ListDetail';
import { QuizScreen } from './components/quiz/QuizScreen';
import { ListStats } from './components/stats/ListStats';
import { SplashScreen } from './components/SplashScreen';
import { useAppStore } from './stores/useAppStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  if (!selectedChildId) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem('tt-splash-shown')
  );

  const handleSplashDone = useCallback(() => {
    sessionStorage.setItem('tt-splash-shown', '1');
    setShowSplash(false);
  }, []);

  return (
    <BrowserRouter basename="/overhoorapp">
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:listId" element={<ListDetail />} />
          <Route path="/play" element={<QuizPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/stats/:listId" element={<ListStats />} />
        </Route>
        {/* Mode selection: self vs parent */}
        <Route
          path="/play/:listId/mode"
          element={
            <ProtectedRoute>
              <ModeSelectPage />
            </ProtectedRoute>
          }
        />
        {/* Self-play type selection: MC vs Typing */}
        <Route
          path="/play/:listId/self"
          element={
            <ProtectedRoute>
              <SelfPlaySelectPage />
            </ProtectedRoute>
          }
        />
        {/* Quiz screens with mode parameter */}
        <Route
          path="/play/:listId/self/mc"
          element={
            <ProtectedRoute>
              <QuizScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play/:listId/self/typing"
          element={
            <ProtectedRoute>
              <QuizScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play/:listId/self/blitz"
          element={
            <ProtectedRoute>
              <QuizScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play/:listId/self/memory"
          element={
            <ProtectedRoute>
              <QuizScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play/:listId/self/hangman"
          element={
            <ProtectedRoute>
              <QuizScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play/:listId/self/race"
          element={
            <ProtectedRoute>
              <QuizScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play/:listId/self/eindtoets"
          element={
            <ProtectedRoute>
              <QuizScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play/:listId/parent"
          element={
            <ProtectedRoute>
              <QuizScreen />
            </ProtectedRoute>
          }
        />
        {/* Legacy route: redirect to mode select */}
        <Route
          path="/play/:listId"
          element={
            <ProtectedRoute>
              <ModeSelectPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
