import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Landing from '../landing/Landing';
import Privacy from '../pages/Privacy';
import Terms from '../pages/Terms';
import AuthPage from '../pages/AuthPage';
import AppShell from '../layout/AppShell';
import Dashboard from '../pages/Dashboard';
import Instructions from '../pages/Instructions';
import Exam from '../pages/Exam';
import Result from '../pages/Result';
import Sheets from '../pages/Sheets';
import Settings from '../pages/Settings';
import Typing from '../pages/Typing';
import Svar from '../pages/Svar';
import Interview from '../pages/Interview';
import Health from '../pages/Health';
import SessionSync from '../auth/SessionSync';
import { useSession } from '../stores/session';

function Root() {
  return <Landing />;
}

function LoginRoute() {
  const ready = useSession((s) => s.ready);
  const userId = useSession((s) => s.userId);
  if (!ready) return <div className="wrap"><div className="card">Loading…</div></div>;
  if (userId) return <Navigate to="/app" replace />;
  return <AuthPage />;
}

function RequireAuth() {
  const ready = useSession((s) => s.ready);
  const userId = useSession((s) => s.userId);
  if (!ready) return <div className="wrap"><div className="card">Loading…</div></div>;
  if (!userId) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <SessionSync />
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/app" element={<RequireAuth />}>
          <Route index element={<Dashboard />} />
          <Route path="instructions" element={<Instructions />} />
          <Route path="exam" element={<Exam />} />
          <Route path="result" element={<Result />} />
          <Route path="sheets" element={<Sheets />} />
          <Route path="typing" element={<Typing />} />
          <Route path="speaking" element={<Svar />} />
          <Route path="interview" element={<Interview />} />
          <Route path="settings" element={<Settings />} />
          <Route path="health" element={<Health />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
