import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain uppercase, lowercase and number'),
  terms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms',
  }),
});

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      // Backend expects phone with prefix (or will validate it)
      const phoneWithPrefix = `+91${data.phone}`;
      
      const payload = {
        name: data.name,
        email: data.email,
        phone: phoneWithPrefix,
        password: data.password,
      };

      await axios.post('/auth/register', payload);
      toast.success('OTP sent successfully!');
      // Navigate to OTP page and pass the phone number in state
      navigate('/verify-otp', { state: { phone: phoneWithPrefix } });
    } catch (error) {
      if (error.response?.data?.details) {
        toast.error(error.response.data.details[0].message || 'Validation failed');
      } else {
        toast.error(error.response?.data?.error || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Note: In real setup, you use @react-oauth/google. 
    // This is placeholder for standard Google OAuth redirect or SDK popup.
    toast.error('Google Auth SDK not initialized yet.');
  };

  return (
    <div className="min-h-screen bg-casino-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-casino-card rounded-2xl p-8 shadow-2xl border border-brand-accent/20">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-brand-accent mb-2">Create Account</h1>
          <p className="text-gray-400">Join RoyalBet and start winning</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
            <input
              type="text"
              {...register('name')}
              className={`w-full bg-casino-bg border ${errors.name ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent transition-colors`}
              placeholder="Jay Tester"
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
            <input
              type="email"
              {...register('email')}
              className={`w-full bg-casino-bg border ${errors.email ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent transition-colors`}
              placeholder="jay@example.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
            <div className="flex">
              <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-700 bg-gray-800 text-gray-300">
                +91
              </span>
              <input
                type="tel"
                {...register('phone')}
                maxLength={10}
                className={`flex-1 bg-casino-bg border ${errors.phone ? 'border-red-500' : 'border-gray-700'} rounded-r-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent transition-colors`}
                placeholder="9876543210"
              />
            </div>
            {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
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

          {/* Terms */}
          <div className="flex items-start mt-2">
            <div className="flex items-center h-5">
              <input
                id="terms"
                type="checkbox"
                {...register('terms')}
                className="w-4 h-4 rounded bg-casino-bg border-gray-700 text-brand-accent focus:ring-brand-accent focus:ring-offset-casino-bg accent-brand-accent"
              />
            </div>
            <label htmlFor="terms" className="ml-2 text-sm text-gray-400">
              I am at least 18 years old and I agree to the <a href="#" className="text-brand-accent hover:underline">Terms of Service</a>
            </label>
          </div>
          {errors.terms && <p className="text-sm text-red-500">{errors.terms.message}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-brand-accent to-yellow-600 text-casino-bg font-bold py-3 rounded-lg hover:shadow-[0_0_15px_rgba(255,215,0,0.4)] transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Register Now'}
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
          Sign up with Google
        </button>

        <p className="mt-8 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-accent hover:underline font-medium">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
