import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../api.js';
import toast from 'react-hot-toast';
import { Send, Users, User } from 'lucide-react';

export default function Notifications() {
  const [message, setMessage]   = useState('');
  const [userId, setUserId]     = useState('');
  const [target, setTarget]     = useState('all'); // 'all' | 'user'

  const mutation = useMutation({
    mutationFn: () => api.post('/notifications/send', {
      message,
      userId: target === 'user' && userId ? userId : undefined,
    }),
    onSuccess: (data) => {
      toast.success(`Notification sent to: ${data.data.target}`);
      setMessage('');
      setUserId('');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed to send'),
  });

  const handleSend = () => {
    if (!message.trim()) { toast.error('Message is required'); return; }
    if (target === 'user' && !userId.trim()) { toast.error('User ID is required for targeted notifications'); return; }
    mutation.mutate();
  };

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">Notifications</h1>
        <p className="text-sm text-gray-500">Send in-app notifications via Socket.IO</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        {/* Target selector */}
        <div>
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">Send To</label>
          <div className="flex gap-2">
            {[
              { key: 'all',  label: 'All Users',     icon: Users },
              { key: 'user', label: 'Specific User', icon: User },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTarget(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition cursor-pointer
                  ${target === key
                    ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* User ID input (only for targeted) */}
        {target === 'user' && (
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1.5">User ID</label>
            <input
              type="text" value={userId} onChange={e => setUserId(e.target.value)}
              placeholder="Paste user UUID..."
              className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 font-mono"
            />
          </div>
        )}

        {/* Message */}
        <div>
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Message</label>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            rows={4} placeholder="Type your notification message..."
            className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 resize-none"
          />
          <p className="text-xs text-gray-600 mt-1">{message.length}/500 characters</p>
        </div>

        <button
          onClick={handleSend}
          disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-b from-yellow-400 to-yellow-600 text-black font-black text-sm hover:brightness-110 transition disabled:opacity-40 cursor-pointer"
        >
          <Send size={15} />
          {mutation.isPending ? 'Sending...' : target === 'all' ? 'Broadcast to All Users' : 'Send to User'}
        </button>

        {/* Info */}
        <div className="bg-black/30 rounded-xl p-4 text-xs text-gray-500">
          <p className="font-bold text-gray-400 mb-1">How it works</p>
          <p>Notifications are sent via Socket.IO in real time. Players see an in-app toast when connected. This does not send emails or push notifications.</p>
        </div>
      </div>
    </div>
  );
}
