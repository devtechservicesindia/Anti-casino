import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const TOTAL = 80; // Numbers 1-80
const DRAW  = 20; // How many are drawn
const MAX_PICK = 10;

// Keno payout table (for 10 picks): pick → match → multiplier
const PAYOUTS = {
  1:  {1:3},
  2:  {1:1,2:9},
  3:  {2:2,3:27},
  4:  {2:1,3:5,4:100},
  5:  {3:2,4:12,5:800},
  6:  {3:1,4:4,5:90,6:1600},
  7:  {4:2,5:20,6:400,7:7000},
  8:  {5:12,6:100,7:1500,8:25000},
  9:  {5:6,6:44,7:300,8:6000,9:50000},
  10: {5:2,6:20,7:150,8:1000,9:10000,10:100000},
};

function getPayout(picks, matches) {
  const table = PAYOUTS[picks];
  if (!table) return 0;
  return table[matches] ?? 0;
}

export default function KenoGame() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(10);
  const [selected, setSelected] = useState(new Set());
  const [drawn, setDrawn] = useState([]);
  const [hits, setHits] = useState([]);
  const [phase, setPhase] = useState('pick'); // pick | drawing | result
  const [result, setResult] = useState(null);

  useQuery({
    queryKey: ['balance'],
    queryFn: () => axios.get('/wallet/balance').then(r=>r.data),
    refetchInterval: 10000,
    onSuccess: d => setBalance(d.balance??0),
  });

  function toggleNum(n) {
    if (phase !== 'pick') return;
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(n)) { s.delete(n); return s; }
      if (s.size >= MAX_PICK) { toast.error(`Max ${MAX_PICK} picks`); return s; }
      s.add(n);
      return s;
    });
  }

  function play() {
    if (selected.size === 0) { toast.error('Pick at least 1 number!'); return; }
    if (balance < bet)       { toast.error('Not enough coins!'); return; }
    setBalance(b => b - bet);
    setPhase('drawing');
    setDrawn([]);
    setHits([]);
    setResult(null);

    // Draw 20 unique numbers 1-80
    const pool = Array.from({length:80},(_,i)=>i+1).sort(()=>Math.random()-0.5);
    const drawnNums = pool.slice(0,20).sort((a,b)=>a-b);

    // Reveal one-by-one
    drawnNums.forEach((num,i) => {
      setTimeout(()=>{
        setDrawn(prev=>[...prev,num]);
        if (i === 19) {
          const h = drawnNums.filter(n=>selected.has(n));
          setHits(h);
          const multi = getPayout(selected.size, h.length);
          const payout = bet * multi;
          setBalance(b => b + payout);
          setResult({ matched: h.length, picked: selected.size, payout, multi });
          setPhase('result');
        }
      }, i * 80);
    });
  }

  function clearPicks() {
    if (phase==='drawing') return;
    setSelected(new Set());
    setDrawn([]);
    setHits([]);
    setResult(null);
    setPhase('pick');
  }

  const BETs = [5,10,25,50,100];
  const numRows = Array.from({length:8},(_,r)=>Array.from({length:10},(_,c)=>r*10+c+1));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a2e] to-[#1a1a4e] text-white flex flex-col items-center px-4 py-8">
      <button onClick={()=>navigate('/lobby')} className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={18}/> Lobby
      </button>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black text-blue-400 tracking-widest">KENO 🎱</h1>
          <p className="text-gray-400 text-sm mt-1">Pick up to 10 numbers · 20 drawn · USA Lottery style</p>
          <p className="text-yellow-400 font-mono font-bold mt-1">🪙 {balance.toLocaleString()}</p>
        </div>

        {/* Number grid */}
        <div className="bg-black/40 border border-blue-900/40 rounded-2xl p-4 mb-4">
          {numRows.map((row,ri)=>(
            <div key={ri} className="flex gap-1.5 mb-1.5">
              {row.map(n=>{
                const isSel  = selected.has(n);
                const isHit  = hits.includes(n);
                const isDrawn = drawn.includes(n) && !isSel;
                return (
                  <button key={n} onClick={()=>toggleNum(n)}
                    className={`flex-1 aspect-square rounded-lg text-xs font-bold transition-all ${
                      isHit   ? 'bg-yellow-400 text-black scale-110 shadow-[0_0_10px_rgba(255,215,0,0.6)]'
                      : isSel ? 'bg-blue-500 text-white'
                      : isDrawn ? 'bg-gray-600 text-gray-300'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>
                    {n}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Status / result */}
        <div className="text-center mb-4 h-12 flex items-center justify-center">
          {result ? (
            <div className={`text-lg font-bold ${result.payout>0?'text-yellow-400':'text-gray-400'}`}>
              {result.matched}/{result.picked} matched → {result.payout>0?`${result.multi}× = +${result.payout.toLocaleString()} 🪙`:'No win'}
            </div>
          ) : phase==='drawing' ? (
            <div className="text-blue-400 font-bold animate-pulse">Drawing numbers…</div>
          ) : (
            <div className="text-gray-500 text-sm">{selected.size}/{MAX_PICK} numbers selected</div>
          )}
        </div>

        {/* Bet */}
        <div className="flex gap-2 mb-4">
          {BETs.map(a=>(
            <button key={a} onClick={()=>setBet(a)} disabled={phase==='drawing'}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${bet===a?'bg-blue-500 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {a}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={clearPicks} disabled={phase==='drawing'}
            className="flex-1 py-3 bg-gray-800 text-gray-400 font-bold rounded-xl hover:bg-gray-700 transition">
            Clear
          </button>
          <button onClick={phase==='result'?clearPicks:play} disabled={phase==='drawing'||balance<bet}
            className={`flex-[2] py-3 rounded-xl font-black text-xl transition active:scale-95 ${
              phase==='drawing'?'bg-gray-700 text-gray-500 cursor-not-allowed'
              :balance<bet?'bg-gray-800 text-gray-500 cursor-not-allowed'
              :'bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0_4px_0_#1e40af] hover:brightness-110'
            }`}>
            {phase==='result' ? '🔄 Play Again' : phase==='drawing' ? '⏳ Drawing…' : 'PLAY 🎱'}
          </button>
        </div>
      </div>
    </div>
  );
}
