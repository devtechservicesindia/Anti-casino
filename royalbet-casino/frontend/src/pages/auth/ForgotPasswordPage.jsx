import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: New Password
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState('');
  
  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  
  // Password state
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // --- Step 1: Request OTP ---
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast.error('Enter a valid phone number');
      return;
    }
    setIsLoading(true);
    try {
      // In a real app you need a dedicated /forgot-password endpoint
      await axios.post('/auth/forgot-password', { phone: `+91${phone}` });
      toast.success('OTP sent to your phone');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 2: Verify OTP ---
  const handleOtpChange = (index, e) => {
    const value = e.target.value;
    if (isNaN(value)) return;

    const newOtp = [...otp];
    if (value.length > 1) {
      const pastedData = value.slice(0, 6).split('');
      for (let i = 0; i < pastedData.length; i++) {
        if (index + i < 6) newOtp[index + i] = pastedData[i];
      }
      setOtp(newOtp);
      const focusIndex = Math.min(index + pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) return;

    setIsLoading(true);
    try {
      await axios.post('/auth/verify-forgot-password-otp', { phone: `+91${phone}`, otp: otpValue });
      toast.success('OTP verified');
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 3: Reset Password ---
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (passwords.new.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post('/auth/reset-password', {
        phone: `+91${phone}`,
        otp: otp.join(''),
        newPassword: passwords.new,
      });
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-casino-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-casino-card rounded-2xl p-8 shadow-2xl border border-brand-accent/20 relative">
        
        <Link to="/login" className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </Link>

        <div className="text-center mb-8 mt-2">
          <h1 className="font-display text-4xl text-brand-accent mb-2">Reset Password</h1>
          <p className="text-gray-400">
            {step === 1 && "Enter your registered phone number"}
            {step === 2 && "Enter the 6-digit OTP sent to your phone"}
            {step === 3 && "Create a new strong password"}
          </p>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={handleRequestOTP} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
              <div className="flex">
                <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-700 bg-gray-800 text-gray-300">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-casino-bg border border-gray-700 rounded-r-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent transition-colors"
                  placeholder="9876543210"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || phone.length < 10}
              className="w-full bg-gradient-to-r from-brand-accent to-yellow-600 text-casino-bg font-bold py-3 rounded-lg hover:shadow-[0_0_15px_rgba(255,215,0,0.4)] transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Send OTP'}
            </button>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-8">
            <div className="flex justify-center gap-2 sm:gap-4">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold bg-casino-bg border border-gray-700 text-brand-accent rounded-lg focus:outline-none focus:border-brand-accent"
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={isLoading || otp.join('').length !== 6}
              className="w-full bg-gradient-to-r from-brand-accent to-yellow-600 text-casino-bg font-bold py-3 rounded-lg hover:shadow-[0_0_15px_rgba(255,215,0,0.4)] transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Verify OTP'}
            </button>
          </form>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  className="w-full bg-casino-bg border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                className="w-full bg-casino-bg border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || passwords.new.length < 8}
              className="w-full bg-gradient-to-r from-brand-accent to-yellow-600 text-casino-bg font-bold py-3 rounded-lg hover:shadow-[0_0_15px_rgba(255,215,0,0.4)] transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Reset Password'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
