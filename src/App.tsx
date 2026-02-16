import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { useAppStore } from './stores/useAppStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  if (!selectedChildId) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter basename="/overhoorapp">
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
