import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';

const loginSchema = z.object({
  emailOrPhone: z.string().min(1, 'Email or Phone is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const res = await axios.post('/auth/login', data);
      toast.success('Welcome back to RoyalBet!');
      login(res.data.user, res.data.accessToken);
      // Navigate to lobby or dashboard after AuthContext processes it
      navigate('/lobby');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post('/auth/google', { googleToken: 'mock_google_token' });
      toast.success('Welcome, Demo Player! 🎰');
      login(res.data.user, res.data.accessToken);
      navigate('/lobby');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Google Sign In failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-casino-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-casino-card rounded-2xl p-8 shadow-2xl border border-brand-accent/20">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-brand-accent mb-2">Welcome Back</h1>
          <p className="text-gray-400">Login to access your Royal Tokens</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email or Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email or Phone</label>
            <input
              type="text"
              {...register('emailOrPhone')}
              className={`w-full bg-casino-bg border ${errors.emailOrPhone ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent transition-colors`}
              placeholder="jay@example.com or +919876543210"
            />
            {errors.emailOrPhone && <p className="mt-1 text-sm text-red-500">{errors.emailOrPhone.message}</p>}
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-300">Password</label>
              <Link to="/forgot-password" className="text-sm text-brand-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                className={`w-full bg-casino-bg border ${errors.password ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent transition-colors pr-12`}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-brand-accent to-yellow-600 text-casino-bg font-bold py-3 rounded-lg hover:shadow-[0_0_15px_rgba(255,215,0,0.4)] transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Log In 🎲'}
          </button>
        </form>

        <div className="mt-6 flex items-center">
          <div className="flex-1 border-t border-gray-700"></div>
          <span className="px-3 text-sm text-gray-500">OR</span>
          <div className="flex-1 border-t border-gray-700"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="mt-6 w-full bg-white text-gray-900 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 24c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 21.53 7.7 24 12 24z" />
            <path fill="#FBBC05" d="M5.84 15.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V8.07H2.18C1.43 9.55 1 11.22 1 13s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 4.64c1.61 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>

        <p className="mt-8 text-center text-sm text-gray-400">
          New user?{' '}
          <Link to="/register" className="text-brand-accent hover:underline font-medium">
            Register free
          </Link>
        </p>
      </div>
    </div>
  );
}
