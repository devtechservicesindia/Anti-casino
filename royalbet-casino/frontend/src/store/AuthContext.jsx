import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

/**
 * CRITICAL: Vite proxy maps /api → http://localhost:4000/api
 * Backend routes are prefixed /api/v1, so:
 *   /api/v1/auth/login  →  http://localhost:4000/api/v1/auth/login ✅
 */
const API = '/api/v1';

// Apply baseURL globally so all bare `axios` calls go through the proxy
axios.defaults.baseURL = API;
axios.defaults.withCredentials = true;

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [loading, setLoading]         = useState(true);
  const navigate = useNavigate();

  // ── Axios interceptor: attach Bearer token ─────────────────────────────────
  useEffect(() => {
    const req = axios.interceptors.request.use(config => {
      const token = localStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    const res = axios.interceptors.response.use(
      r => r,
      async error => {
        const orig = error.config;
        if (error.response?.status === 401 && !orig._retry) {
          orig._retry = true;
          try {
            const r = await axios.post('/auth/refresh-token');
            const newToken = r.data.accessToken;
            localStorage.setItem('accessToken', newToken);
            setAccessToken(newToken);
            orig.headers.Authorization = `Bearer ${newToken}`;
            return axios(orig);
          } catch {
            _clearAuth();
            navigate('/login');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(req);
      axios.interceptors.response.eject(res);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _clearAuth() {
    localStorage.removeItem('accessToken');
    setUser(null);
    setAccessToken(null);
  }

  function _setAuth(userData, token) {
    localStorage.setItem('accessToken', token);
    setUser(userData);
    setAccessToken(token);
  }

  // ── Initial silent auth via refresh-token cookie ──────────────────────────
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('accessToken');
      if (!stored) {
        // Try cookie-based refresh
        try {
          const r = await axios.post('/auth/refresh-token');
          _setAuth(r.data.user, r.data.accessToken);
        } catch {
          _clearAuth();
        }
      } else {
        // Validate the stored token by fetching fresh state if needed
        // We keep the stored token and let the interceptor handle 401s
        // Attempt to hydrate user from stored state
        // We'll read user from localStorage if we stored it
        const storedUser = localStorage.getItem('userData');
        if (storedUser) {
          try { setUser(JSON.parse(storedUser)); } catch { /* ignore */ }
        }
      }
      setLoading(false);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────
  const login = (userData, token) => {
    _setAuth(userData, token);
    localStorage.setItem('userData', JSON.stringify(userData));
    navigate('/lobby');
  };

  const logout = async () => {
    try { await axios.post('/auth/logout'); } catch { /* ignore */ }
    _clearAuth();
    localStorage.removeItem('userData');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const isAuthenticated = !!user || !!accessToken;

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isAuthenticated, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
