import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const COLS = 9;
const ROWS = 12;
const BALL_RADIUS = 12;
const COL_W = 56;
const ROW_H = 36;

// Multipliers for Plinko landing zones (middle = low, edges = high)
const MULTIPLIERS = [30, 10, 5, 2, 0.5, 0.2, 0.5, 2, 5, 10, 30];

function getColor(m) {
  if (m >= 10) return '#FFD700';
  if (m >= 5)  return '#f97316';
  if (m >= 2)  return '#22c55e';
  if (m >= 1)  return '#3b82f6';
  return '#6b7280';
}

export default function PlinkoGame() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(10);
  const [dropping, setDropping] = useState(false);
  const [result, setResult] = useState(null);
  const [risk, setRisk] = useState('medium'); // low|medium|high

  useQuery({
    queryKey: ['balance'],
    queryFn: () => axios.get('/wallet/balance').then(r=>r.data),
    refetchInterval:10000,
    onSuccess: d=>setBalance(d.balance??0),
  });

  const BETs = [5,10,25,50,100];

  // Risk levels map to different multiplier scales
  const multis = {
    low:    [2.5,1.5,1.2,1.1,0.5,0.3,0.5,1.1,1.2,1.5,2.5],
    medium: [30,10,5,2,0.5,0.2,0.5,2,5,10,30],
    high:   [100,20,10,5,1,0.1,1,5,10,20,100],
  }[risk];

  // Compute peg positions
  const pegs = [];
  for (let row = 0; row < ROWS; row++) {
    const pegCount = row + 3;
    const offsetX = (COL_W * (COLS - 1) - COL_W * (pegCount - 1)) / 2;
    for (let col = 0; col < pegCount; col++) {
      pegs.push({ x: offsetX + col * COL_W + COL_W/2 + 20, y: row * ROW_H + 40 });
    }
  }

  const W = COL_W * COLS + 40;
  const H = ROWS * ROW_H + 100;

  function drop() {
    if (dropping || balance < bet) return;
    setBalance(b=>b-bet);
    setDropping(true);
    setResult(null);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Simulate ball path
    let bx = W / 2;
    let by = 10;
    const path = [{x:bx,y:by}];
    for (let row=0;row<ROWS;row++){
      // At each row, randomly go left or right
      bx += (Math.random()<0.5?-1:1) * COL_W/2;
      by += ROW_H;
      path.push({x:bx,y:by});
    }

    // Determine landing slot (clamp)
    const finalX = Math.max(20+COL_W/2, Math.min(W-20-COL_W/2, bx));
    const slotIdx = Math.round((finalX - (20+COL_W/2)) / COL_W);
    const clampedIdx = Math.max(0, Math.min(multis.length-1, slotIdx));
    const multi = multis[clampedIdx];
    const payout = bet * multi;

    let step = 0;
    function animate() {
      ctx.clearRect(0,0,W,H);

      // Draw pegs
      ctx.fillStyle = '#4ade80';
      pegs.forEach(p=> {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fill();
      });

      // Draw slots
      multis.forEach((m,i)=> {
        const sx = 20 + i*COL_W;
        const sy = H - 42;
        ctx.fillStyle = getColor(m);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(sx+2, sy, COL_W-4, 36);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${m}×`, sx+COL_W/2, sy+22);
      });

      // Draw ball
      if (step < path.length) {
        const pos = path[step];
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BALL_RADIUS, 0, Math.PI*2);
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        step++;
        animRef.current = setTimeout(animate, 60);
      } else {
        // Land
        setBalance(b=>b+payout);
        setResult({multi, payout, slot: clampedIdx});
        setDropping(false);
      }
    }
    animate();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0020] to-[#1a003a] text-white flex flex-col items-center px-4 py-8">
      <button onClick={()=>navigate('/lobby')} className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={18}/> Lobby
      </button>
      <div className="w-full" style={{maxWidth: W+40}}>
        <div className="text-center mb-4">
          <h1 className="text-4xl font-black text-pink-400 tracking-widest">PLINKO 🎯</h1>
          <p className="text-gray-400 text-sm mt-1">Drop the ball · Win big multipliers</p>
          <p className="text-yellow-400 font-mono font-bold mt-1">🪙 {balance.toLocaleString()}</p>
        </div>

        {/* Canvas */}
        <div className="flex justify-center mb-4">
          <canvas ref={canvasRef} width={W} height={H}
            className="rounded-2xl border border-purple-800/40 bg-black/50"/>
        </div>

        {/* Result */}
        {result && (
          <div className={`text-center py-2 mb-4 rounded-xl font-bold text-lg ${result.payout>0?'text-yellow-400':'text-gray-400'}`}>
            {result.multi}× = {result.payout>0?`+${result.payout.toLocaleString()} 🪙`:'Better luck!'}
          </div>
        )}

        {/* Risk */}
        <div className="flex gap-2 mb-3 justify-center">
          {['low','medium','high'].map(r=>(
            <button key={r} onClick={()=>setRisk(r)} disabled={dropping}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition capitalize ${
                risk===r?'bg-pink-500 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {r}
            </button>
          ))}
        </div>

        {/* Bet */}
        <div className="flex gap-2 mb-4">
          {BETs.map(a=>(
            <button key={a} onClick={()=>setBet(a)} disabled={dropping}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${bet===a?'bg-pink-500 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {a}
            </button>
          ))}
        </div>

        <button onClick={drop} disabled={dropping||balance<bet}
          className={`w-full py-4 rounded-2xl font-black text-2xl transition active:scale-95 ${
            dropping?'bg-gray-700 text-gray-500 cursor-not-allowed'
            :balance<bet?'bg-gray-800 text-gray-500 cursor-not-allowed'
            :'bg-gradient-to-b from-pink-500 to-pink-700 text-white shadow-[0_4px_0_#9d174d] hover:brightness-110'
          }`}>
          {dropping ? '⏳ Dropping…' : 'DROP 🎯'}
        </button>
      </div>
    </div>
  );
}
