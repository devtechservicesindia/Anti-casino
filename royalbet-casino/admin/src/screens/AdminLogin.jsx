import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post('/api/v1/auth/login', { emailOrPhone: email, password });
      if (data.user?.role !== 'ADMIN') {
        toast.error('Not an admin account');
        return;
      }
      localStorage.setItem('adminToken', data.accessToken);
      localStorage.setItem('adminUser', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d18] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-4">
            <Shield size={32} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white">RoyalBet Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Admin access only</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500 transition"
              placeholder="admin@royalbet.com"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500 transition"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-b from-yellow-400 to-yellow-600 text-black font-black text-sm hover:brightness-110 transition active:translate-y-0.5 disabled:opacity-40 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'SIGN IN AS ADMIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
