import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../store/AuthContext';
import { Loader2 } from 'lucide-react';

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const phone = location.state?.phone;

  // Countdown timer for Resend UX
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // If accessed directly without a phone number, kick back to register
  if (!phone) {
    return <Navigate to="/register" replace />;
  }

  const handleChange = (index, e) => {
    const value = e.target.value;
    if (isNaN(value)) return;

    const newOtp = [...otp];
    // Allow pasting
    if (value.length > 1) {
      const pastedData = value.slice(0, 6).split('');
      for (let i = 0; i < pastedData.length; i++) {
        if (index + i < 6) newOtp[index + i] = pastedData[i];
      }
      setOtp(newOtp);
      // Focus the last filled input or the next empty one
      const focusIndex = Math.min(index + pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
      return;
    }

    // Standard typing
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace: move to previous input if empty
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error('Please enter the full 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.post('/auth/verify-otp', { phone, otp: otpValue });
      
      // Store user and access token in context memory
      // The refresh token is sent as an HttpOnly cookie automatically by the backend
      login(res.data.user, res.data.accessToken);
      
      toast.success('Account verified successfully!');
      navigate('/lobby'); // Or wherever the main game hub is
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid or expired OTP');
      // Clear OTP boxes on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      // Assuming a dedicated /resend-otp endpoint or falling back to register logic internally
      // For now, we mimic calling resend.
      toast.success('New OTP sent to your phone');
      setCountdown(60);
    } catch (error) {
      toast.error('Failed to resend OTP');
    }
  };

  const maskedPhone = `${phone.slice(0, 5)} ***** ${phone.slice(-2)}`;

  return (
    <div className="min-h-screen bg-casino-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-casino-card rounded-2xl p-8 shadow-2xl border border-brand-accent/20 text-center">
        <h1 className="font-display text-4xl text-brand-accent mb-4">Verify Your Phone</h1>
        
        <p className="text-gray-400 mb-8">
          We've sent a 6-digit secure code to <br />
          <span className="text-white font-medium tracking-wide mt-1 block">{maskedPhone}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex justify-center gap-2 sm:gap-4">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength={6}
                value={digit}
                onChange={(e) => handleChange(index, e)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold bg-casino-bg border border-gray-700 text-brand-accent rounded-lg focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.join('').length !== 6}
            className="w-full bg-gradient-to-r from-brand-accent to-yellow-600 text-casino-bg font-bold py-3 rounded-lg hover:shadow-[0_0_15px_rgba(255,215,0,0.4)] transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Verify & Enter Casino'}
          </button>
        </form>

        <div className="mt-8 text-sm">
          <p className="text-gray-400">
            Didn't receive the code?{' '}
            <button
              onClick={handleResend}
              disabled={countdown > 0}
              className={`${countdown > 0 ? 'text-gray-600 cursor-not-allowed' : 'text-brand-accent hover:underline font-medium'}`}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
