import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './store/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Auth Pages
import LandingPage from './pages/auth/LandingPage';
import RegisterPage from './pages/auth/RegisterPage';
import LoginPage from './pages/auth/LoginPage';
import VerifyOTPPage from './pages/auth/VerifyOTPPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Placeholder Pages (to be implemented later)
const LobbyPlaceholder = () => (
  <div className="min-h-screen bg-casino-bg text-white flex items-center justify-center font-display text-4xl">
    Welcome to the RoyalBet Lobby 🎰
  </div>
);

function App() {
  return (
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
            <Route path="/lobby" element={<LobbyPlaceholder />} />
            {/* Add games, wallet, profile here */}
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
