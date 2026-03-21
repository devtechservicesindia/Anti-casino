// api/index.js – Axios API client and service barrel
import axios from 'axios';

// Base Axios instance – all requests go to /api (proxied by Vite to backend)
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor – attach JWT access token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor – handle 401 token refresh (placeholder)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // TODO: implement token refresh logic here
    return Promise.reject(error);
  }
);

// Service re-exports (uncomment as services are created)
// export * from './authService';
// export * from './gameService';
// export * from './walletService';
// export * from './paymentService';
