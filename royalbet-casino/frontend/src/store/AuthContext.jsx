import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Configure global Axios settings for Auth
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '/api/v1';
axios.defaults.withCredentials = true; // IMPORTANT: send cookies (refreshToken) with every request

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Configure Axios interceptor to attach access token globally
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        // If 401 Unauthorized and not already retrying, try to refresh token once
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            // Note: withCredentials: true sends the httpOnly cookie automatically
            const res = await axios.post('/auth/refresh-token');
            const newAccessToken = res.data.accessToken;
            setAccessToken(newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return axios(originalRequest); // retry original request
          } catch (refreshError) {
            // Refresh token failed, force logout
            setUser(null);
            setAccessToken(null);
            navigate('/login');
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [accessToken, navigate]);

  // Initial silent authentication via refresh token
  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await axios.post('/auth/refresh-token');
        setAccessToken(res.data.accessToken);
        setUser(res.data.user); // Assuming the backend returns the user obj
      } catch (err) {
        console.log('No valid session found');
        setUser(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    setAccessToken(token);
    navigate('/');
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setAccessToken(null);
      toast.success('Logged out successfully');
      navigate('/login');
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isAuthenticated, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
