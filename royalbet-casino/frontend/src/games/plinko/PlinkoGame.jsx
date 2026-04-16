import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCoins } from '../../hooks/useCoins';

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const COLS = 9;
const ROWS = 12;
const COL_W = 56;
const ROW_H = 36;
const BALL_RADIUS = 11;
const PEG_RADIUS = 5;

// Colors mapping for multiplier slots
function getColor(m) {
  if (m >= 100) return '#ef4444'; // Red
  if (m >= 20)  return '#f97316'; // Orange
  if (m >= 5)   return '#eab308'; // Yellow
  if (m >= 2)   return '#22c55e'; // Green
  if (m >= 1)   return '#3b82f6'; // Blue
  return '#6b7280';               // Gray
}

const RISK_MULTIS = {
  low:    [2.5, 1.5, 1.2, 1.1, 0.5, 0.3, 0.5, 1.1, 1.2, 1.5, 2.5],
  medium: [30, 10, 5, 2, 0.5, 0.2, 0.5, 2, 5, 10, 30],
  high:   [100, 20, 10, 5, 1, 0.1, 1, 5, 10, 20, 100],
};

const BETs = [5, 10, 25, 50, 100, 500];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PlinkoGame() {
  const { balance, spend, earn } = useCoins();
  const canvasRef = useRef(null);
  const animReqId = useRef(null);
  
  const [bet, setBet] = useState(10);
  const [dropping, setDropping] = useState(false);
  const [result, setResult] = useState(null);
  const [risk, setRisk] = useState('medium');
  const [history, setHistory] = useState([]);

  const multis = RISK_MULTIS[risk];
  
  // Pre-compute pegs for rendering
  const pegs = [];
  for (let row = 0; row < ROWS; row++) {
    const pegCount = row + 3;
    const offsetX = (COL_W * (COLS - 1) - COL_W * (pegCount - 1)) / 2;
    for (let col = 0; col < pegCount; col++) {
      pegs.push({ x: offsetX + col * COL_W + COL_W / 2 + 20, y: row * ROW_H + 40 });
    }
  }

  const W = COL_W * COLS + 40;
  const H = ROWS * ROW_H + 110;

  // Cleanup active animation on unmount
  useEffect(() => {
    return () => {
        if (animReqId.current) cancelAnimationFrame(animReqId.current);
    }
  }, []);

  // Ensure canvas always renders the static board initially and when Risk changes
  useEffect(() => {
     if (!dropping) renderStaticBoard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk]);

  function renderStaticBoard() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#020010');
      bgGrad.addColorStop(1, '#11032a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Pegs with glow
      pegs.forEach(p => {
        const pGrad = ctx.createRadialGradient(p.x - 2, p.y - 2, 0, p.x, p.y, PEG_RADIUS);
        pGrad.addColorStop(0, '#a5f3fc'); // Cyan bright core
        pGrad.addColorStop(1, '#0891b2'); // Darker cyan edge
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = pGrad;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Multiplier Slots (3D Blocks)
      multis.forEach((m, i) => {
        const sx = 20 + i * COL_W;
        const sy = H - 50;
        const colHex = getColor(m);

        // Slot bucket base
        ctx.fillStyle = colHex + '40'; // 25% opacity
        ctx.fillRect(sx + 3, sy, COL_W - 6, 40);

        // Slot bottom rim
        ctx.fillStyle = colHex;
        ctx.fillRect(sx + 3, sy + 36, COL_W - 6, 4);

        ctx.fillStyle = '#fff';
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(`${m}×`, sx + COL_W / 2, sy + 24);
        ctx.shadowBlur = 0;
      });
  }

  async function drop() {
    if (dropping || balance < bet) return;
    const ok = await spend(bet, 'PLINKO');
    if (!ok) return;
    
    setDropping(true);
    setResult(null);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });

    // Generate waypoints (bounces off pegs)
    let bx = W / 2;
    let by = 0; // Starts slightly above top
    const waypoints = [{ x: bx, y: by }];
    
    for (let row = 0; row < ROWS; row++) {
      bx += (Math.random() < 0.5 ? -1 : 1) * COL_W / 2;
      by += ROW_H;
      waypoints.push({ x: bx, y: by });
    }
    
    // Final bucket drop
    const finalX = Math.max(20 + COL_W / 2, Math.min(W - 20 - COL_W / 2, bx));
    const slotIdx = Math.round((finalX - (20 + COL_W / 2)) / COL_W);
    const clampedIdx = Math.max(0, Math.min(multis.length - 1, slotIdx));
    const finalY = H - 35; // Drop into the slot
    waypoints.push({ x: finalX, y: finalY });

    const multi = multis[clampedIdx];
    const payout = bet * multi;

    // Generate Hi-Res Interpolated Path array (Smooth bezier curves for bouncing)
    const framesPerHop = 15;
    const pathFrames = [];
    
    for (let i = 0; i < waypoints.length - 1; i++) {
        const p0 = waypoints[i];
        const p1 = waypoints[i+1];
        // Control point: slightly offset upwards to simulate a bounce arc.
        // On the final drop into the bucket, we make the arc straight down.
        const isFinalHop = i === waypoints.length - 2;
        const topHoleArch = i === 0;

        const cpX = (p0.x + p1.x) / 2;
        let cpY = p0.y - (isFinalHop ? 0 : 25);
        if (topHoleArch) cpY = p0.y; // Straight drop from hole

        for (let t = 0; t <= 1; t += 1/framesPerHop) {
             const nx = (1-t)*(1-t)*p0.x + 2*(1-t)*t*cpX + t*t*p1.x;
             const ny = (1-t)*(1-t)*p0.y + 2*(1-t)*t*cpY + t*t*p1.y;
             pathFrames.push({ x: nx, y: ny });
        }
    }

    let frame = 0;

    function animate() {
      // 1. Redraw static board
      renderStaticBoard();

      // 2. Draw Ball
      if (frame < pathFrames.length) {
        const pos = pathFrames[frame];
        
        // Shiny 3D Ball Gradient
        const ballGrad = ctx.createRadialGradient(pos.x - 4, pos.y - 4, 0, pos.x, pos.y, BALL_RADIUS);
        ballGrad.addColorStop(0, '#ffffff');    // Hotspot reflection
        ballGrad.addColorStop(0.3, '#fbbf24');  // Yellow gold
        ballGrad.addColorStop(1, '#b45309');    // Dark orange rim

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        
        // Ball Glow
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Motion Trails (Ghosting)
        if (frame > 2) {
             const ghost = pathFrames[frame - 2];
             ctx.beginPath();
             ctx.arc(ghost.x, ghost.y, BALL_RADIUS*0.8, 0, Math.PI * 2);
             ctx.fillStyle = '#fbbf2433';
             ctx.fill();
        }
        
        frame++;
        animReqId.current = requestAnimationFrame(animate);
      } else {
        // Animation finished
        if (payout > 0) earn(payout, 'PLINKO');
        const res = { multi, payout, slot: clampedIdx };
        setResult(res);
        setHistory(h => [res, ...h].slice(0, 10));
        setDropping(false);
        renderStaticBoard(); // final redraw without ball so it "falls in"

        if (multi >= 5) {
             toast.success(`🎯 ${multi}× MULTIPLIER! +${payout.toLocaleString()} 🪙`, {
                 duration: 4000,
                 style: { background: getColor(multi), color: '#fff', fontWeight: 'bold' }
             });
        } else if (payout > 0) {
            toast(`+${payout.toLocaleString()} 🪙`);
        }
      }
    }
    
    animReqId.current = requestAnimationFrame(animate);
  }

  return (
    <div className="min-h-screen bg-[#060312] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a0e4a] via-[#060312] to-[#010005] text-white flex flex-col items-center px-4 py-8 overflow-hidden font-sans">
      <div className="w-full flex-col relative z-10 flex gap-6" style={{ maxWidth: W + 10 }}>
        
        {/* Header Panel */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl px-5 py-4 shadow-2xl">
          <Link to="/lobby" className="text-gray-400 hover:text-white transition flex items-center shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black italic tracking-wider bg-gradient-to-tr from-pink-500 via-fuchsia-400 to-purple-300 text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(236,72,153,0.5)]">
            PLINKO BLAZE
          </h1>
          <div className="font-mono text-yellow-500 font-bold bg-black/40 border border-yellow-500/30 px-3 py-1.5 rounded-full shadow-inner text-sm shrink-0">
             🪙 {balance.toLocaleString()}
          </div>
        </div>

        {/* Info & Canvas Container */}
        <div className="flex flex-col relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-3 shadow-2xl overflow-hidden">
            
            {/* Overlay Effect for Big Wins */}
            {result && result.multi >= 10 && !dropping && (
               <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center animate-bounce">
                  <div className="text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-t from-yellow-600 via-yellow-300 to-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" style={{ WebkitTextStroke: '2px #ca8a04' }}>
                     {result.multi}X HIT!
                  </div>
               </div>
            )}

            <div className="flex justify-center rounded-2xl overflow-hidden bg-[#020010] shadow-[inset_0_5px_30px_rgba(0,0,0,0.8)] relative isolate">
                {/* Visual glass sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-10"></div>
                <canvas 
                   ref={canvasRef} 
                   width={W} 
                   height={H}
                   className="relative z-0"
                />
            </div>
            
            {/* History Tracker */}
            <div className="h-10 mt-3 flex items-center gap-1.5 overflow-x-hidden border-t border-white/10 pt-3">
               <span className="text-xs text-gray-500 uppercase tracking-widest font-bold px-2">History</span>
               {history.map((h, i) => (
                    <div 
                        key={i} 
                        className="text-xs px-2 py-1 rounded-md font-bold shrink-0 transition-all animate-fade-in"
                        style={{ 
                            background: getColor(h.multi) + '22', 
                            color: getColor(h.multi), 
                            border: `1px solid ${getColor(h.multi)}80`,
                            boxShadow: i === 0 ? `0 0 10px ${getColor(h.multi)}40` : 'none'
                        }}
                    >
                        {h.multi}×
                    </div>
                ))}
            </div>
        </div>

        {/* Controls Panel */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl mt-[-10px]">
           <div className="flex flex-col gap-5">
              
              <div className="flex gap-4 items-center">
                  <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider w-12">Risk</label>
                  <div className="flex flex-1 gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10">
                      {['low', 'medium', 'high'].map(r => (
                        <button key={r} onClick={() => { if (!dropping) setRisk(r); }} 
                          className={`flex-1 py-1.5 rounded-lg text-sm font-bold capitalize transition-all duration-300 ${risk === r ? 'bg-gradient-to-t from-pink-700 to-pink-500 text-white shadow-[0_4px_10px_rgba(236,72,153,0.5)]' : 'text-gray-500 hover:text-gray-300'}`}>
                          {r}
                        </button>
                      ))}
                  </div>
              </div>

              <div className="flex gap-4 items-center">
                  <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider w-12">Bet</label>
                  <div className="flex flex-wrap flex-1 gap-2">
                      {BETs.map(a => (
                        <button key={a} onClick={() => { if (!dropping) setBet(a); }}
                          className={`flex-1 min-w-[50px] py-2 rounded-xl text-sm font-black transition-all duration-300 ${bet === a ? 'bg-gradient-to-t from-yellow-600 to-yellow-400 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-400/50 scale-105' : 'bg-black/30 border border-white/10 text-gray-400'}`}>
                          {a}
                        </button>
                      ))}
                  </div>
              </div>

              <button onClick={drop} disabled={dropping || balance < bet}
                className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-b from-fuchsia-400 to-pink-600 text-white font-black text-2xl uppercase tracking-widest shadow-[0_10px_20px_rgba(219,39,119,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 border border-pink-300/50 flex flex-col items-center justify-center leading-none">
                <span>{dropping ? 'DROPPING...' : 'DROP BALL 🚀'}</span>
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}
