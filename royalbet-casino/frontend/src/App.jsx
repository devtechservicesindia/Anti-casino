import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './store/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Auth Pages
import LandingPage from './pages/auth/LandingPage';
import RegisterPage from './pages/auth/RegisterPage';
import LoginPage from './pages/auth/LoginPage';
import VerifyOTPPage from './pages/auth/VerifyOTPPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Main App Pages
import CoinStore from './pages/CoinStore';
import Lobby from './pages/Lobby';
import Leaderboard from './pages/Leaderboard';
import SlotsGame from './games/slots/SlotsGame';
import RouletteGame from './games/roulette/RouletteGame';
import BlackjackGame from './games/blackjack/BlackjackGame';
import CrashGame from './games/crash/CrashGame';
import PokerLobby from './games/poker/PokerLobby';
import PokerTable from './games/poker/PokerTable';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A0B2E',
              color: '#fff',
              border: '1px solid #FFD700',
            },
            success: {
              iconTheme: { primary: '#FFD700', secondary: '#1A0B2E' },
            },
            error: {
              style: { border: '1px solid #EF4444' },
            },
          }}
        />
        
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-otp" element={<VerifyOTPPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/coin-store" element={<CoinStore />} />
            <Route path="/game/slots" element={<SlotsGame />} />
            <Route path="/game/roulette" element={<RouletteGame />} />
            <Route path="/game/blackjack" element={<BlackjackGame />} />
            <Route path="/game/crash" element={<CrashGame />} />
            <Route path="/game/poker" element={<PokerLobby />} />
            <Route path="/game/poker/table/:tableId" element={<PokerTable />} />
            {/* Add games, wallet, profile here */}
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
    </QueryClientProvider>
  );
}

export default App;
