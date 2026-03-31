import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AdminLogin    from './screens/AdminLogin.jsx';
import Layout        from './components/Layout.jsx';
import Dashboard     from './screens/Dashboard.jsx';
import Users         from './screens/Users.jsx';
import Transactions  from './screens/Transactions.jsx';
import GameAudit     from './screens/GameAudit.jsx';
import Tournaments   from './screens/Tournaments.jsx';
import Notifications from './screens/Notifications.jsx';
import CoinManagement from './screens/CoinManagement.jsx';

function isLoggedIn() {
  return !!localStorage.getItem('adminToken');
}

function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' },
        }}
      />
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index          element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="users"        element={<Users />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="games"        element={<GameAudit />} />
          <Route path="tournaments"  element={<Tournaments />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="coins"        element={<CoinManagement />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
