import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SolitaireGame() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(10);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);

  useQuery({
    queryKey: ['balance'],
    queryFn: () => axios.get('/wallet/balance').then(r=>r.data),
    refetchInterval: 10000,
    onSuccess: d => setBalance(d.balance??0),
  });

  useEffect(() => {
    let t;
    if (started) t = setInterval(()=>setTime(s=>s+1), 1000);
    return ()=>clearInterval(t);
  }, [started]);

  function start() {
    if (balance < bet) { toast.error('Not enough coins!'); return; }
    setBalance(b => b - bet);
    setStarted(true);
    setScore(0);
    setTime(0);
  }

  function simulateWin() {
    const prize = bet * 3;
    toast.success(`You won solitaire! +${prize} coins`);
    setBalance(b => b + prize);
    setStarted(false);
  }

  return (
    <div className="min-h-screen bg-[#004d00] text-white flex flex-col px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <button onClick={()=>navigate('/lobby')} className="flex items-center gap-2 text-gray-300 hover:text-white transition">
           <ArrowLeft size={18}/> Lobby
        </button>
        <div className="font-mono bg-black/30 px-4 py-1 rounded text-yellow-400">🪙 {balance.toLocaleString()}</div>
      </div>
      
      {!started ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-black/50 p-6 rounded-2xl text-center max-w-sm w-full border border-green-800">
            <h1 className="text-3xl font-black mb-4">SOLITAIRE ♥</h1>
            <div className="flex gap-2 justify-center mb-6">
              {[5,10,25].map(a => (
                <button key={a} onClick={()=>setBet(a)} className={`px-4 py-2 rounded font-bold ${bet===a?'bg-green-600':'bg-black/40 text-gray-400'}`}>
                  {a}
                </button>
              ))}
            </div>
            <button onClick={start} disabled={balance<bet} className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200">
              DEAL CARDS
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6 bg-black/20 p-3 rounded">
            <div>Score: {score}</div>
            <div>Time: {Math.floor(time/60)}:{(time%60).toString().padStart(2,'0')}</div>
            <button onClick={()=>setStarted(false)} className="text-red-400 text-sm font-bold">End Game</button>
          </div>
          
          {/* Mock Board */}
          <div className="flex-1 border-2 border-dashed border-green-800 rounded-xl flex items-center justify-center flex-col gap-4">
             <div className="text-4xl opacity-50">🂠 🂠 🂠 🂠</div>
             <p className="text-green-300 font-mono text-sm">(Interactive board coming soon)</p>
             <button onClick={simulateWin} className="mt-8 bg-green-600 px-6 py-2 rounded-full font-bold shadow-lg">
               Simulate Win (Test)
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
