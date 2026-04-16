import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCoins } from '../../hooks/useCoins';

// ─── SNAKES & LADDERS DATA ──────────────────────────────────────────────────
const BOARD_SIZE = 10;
const SNAKES  = { 97:78, 95:75, 88:20, 72:51, 56:6, 53:33, 42:11, 31:14 }; // Adjusted slightly for visual balance
const LADDERS = { 3:21, 8:30, 28:84, 50:67, 57:76, 60:78, 71:92, 80:99 };

// Colors
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const NAMES  = ['Red (You)', 'Blue', 'Green', 'Yellow'];
const BETs   = [10, 25, 50, 100, 500];

// Util to map 1..100 to [col, row] where 0,0 is bottom-left
function getCellCoord(cell) {
  if (cell <= 0) return [-1, 0]; // Start off-board
  const validCell = Math.min(cell, 100);
  const r = Math.floor((validCell - 1) / 10);
  let c = (validCell - 1) % 10;
  if (r % 2 !== 0) {
    c = 9 - c; // serpentine reversing
  }
  return [c, r];
}

// Convert cell to % coordinates for SVG / Pawn positioning (Center of cell)
function getCellCenterPct(cell) {
  if (cell <= 0) return [-5, 95];
  const [c, r] = getCellCoord(cell);
  const x = c * 10 + 5;
  const y = (9 - r) * 10 + 5; 
  return [x, y];
}

// ─── 3D DICE COMPONENT ────────────────────────────────────────────────────────
function Dice3D({ value, isRolling }) {
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);

  useEffect(() => {
    let ival;
    if (isRolling) {
      ival = setInterval(() => {
        setRotX(r => r + Math.random() * 90 + 90);
        setRotY(r => r + Math.random() * 90 + 90);
      }, 50);
    } else {
      const faceRotations = {
        1: { x: 0, y: 0 },
        2: { x: 0, y: -90 },
        3: { x: -90, y: 0 },
        4: { x: 90, y: 0 },
        5: { x: 0, y: 90 },
        6: { x: 180, y: 0 }
      };
      const r = faceRotations[value || 1];
      setRotX(r.x + 360 * 2);
      setRotY(r.y + 360 * 2);
    }
    return () => clearInterval(ival);
  }, [isRolling, value]);

  return (
    <div className="w-16 h-16 relative perspective-1000 origin-center scale-125">
      <div 
        className="w-full h-full absolute preserve-3d transition-transform duration-[600ms] ease-out shadow-2xl"
        style={{ transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}
      >
        <div className="cube-face front flex justify-center items-center absolute w-full h-full bg-white border-4 border-orange-200 rounded-xl">
          <span className="w-3 h-3 bg-red-600 rounded-full shadow-inner"></span>
        </div>
        <div className="cube-face right flex justify-between p-3 absolute w-full h-full bg-white border-4 border-orange-200 rounded-xl" style={{ transform: 'rotateY(90deg) translateZ(32px)' }}>
          <span className="w-3 h-3 bg-black rounded-full self-start"></span>
          <span className="w-3 h-3 bg-black rounded-full self-end"></span>
        </div>
        <div className="cube-face bottom flex justify-between p-2 absolute w-full h-full bg-white border-4 border-orange-200 rounded-xl" style={{ transform: 'rotateX(-90deg) translateZ(32px)' }}>
          <span className="w-3 h-3 bg-black rounded-full self-start"></span>
          <span className="w-3 h-3 bg-black rounded-full self-center"></span>
          <span className="w-3 h-3 bg-black rounded-full self-end"></span>
        </div>
        <div className="cube-face top flex flex-wrap justify-between p-2 absolute w-full h-full bg-white border-4 border-orange-200 rounded-xl" style={{ transform: 'rotateX(90deg) translateZ(32px)' }}>
          <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
          <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
        </div>
        <div className="cube-face left flex flex-wrap justify-center items-center content-between p-2 absolute w-full h-full bg-white border-4 border-orange-200 rounded-xl" style={{ transform: 'rotateY(-90deg) translateZ(32px)' }}>
          <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
          <div className="w-full flex justify-center items-center"><span className="w-3 h-3 bg-black rounded-full"></span></div>
          <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
        </div>
        <div className="cube-face back flex flex-wrap justify-between p-2 absolute w-full h-full bg-white border-4 border-orange-200 rounded-xl" style={{ transform: 'rotateY(180deg) translateZ(32px)' }}>
           <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
           <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
           <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
        </div>
      </div>
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .cube-face { backface-visibility: hidden; }
        .front { transform: translateZ(32px); }
      `}</style>
    </div>
  );
}

// ─── SVG OVERLAYS ─────────────────────────────────────────────────────────────
const SVGLayer = () => {
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[0_5px_10px_rgba(0,0,0,0.6)]" style={{ zIndex: 10 }}>
            <defs>
                <filter id="shadow">
                  <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.7"/>
                </filter>
                <pattern id="ladderPat" width="20" height="20" patternUnits="userSpaceOnUse" viewBox="0 0 10 10" preserveAspectRatio="none">
                    <line x1="2" y1="0" x2="2" y2="10" stroke="#78350f" strokeWidth="1" />
                    <line x1="8" y1="0" x2="8" y2="10" stroke="#78350f" strokeWidth="1" />
                    <line x1="2" y1="3" x2="8" y2="3" stroke="#b45309" strokeWidth="1.5" />
                    <line x1="2" y1="7" x2="8" y2="7" stroke="#b45309" strokeWidth="1.5" />
                </pattern>
                {/* Snake Texture Gradient */}
                <linearGradient id="snakeBody" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#166534" />
                    <stop offset="50%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#14532d" />
                </linearGradient>
            </defs>
            
            {/* Ladders */}
            {Object.entries(LADDERS).map(([start, end]) => {
                const [sx, sy] = getCellCenterPct(parseInt(start));
                const [ex, ey] = getCellCenterPct(parseInt(end));
                return (
                    <line key={`L-${start}`} x1={`${sx}%`} y1={`${sy}%`} x2={`${ex}%`} y2={`${ey}%`} stroke="url(#ladderPat)" strokeWidth="6%" filter="url(#shadow)" strokeLinecap="round"/>
                );
            })}

            {/* Snakes */}
            {Object.entries(SNAKES).map(([head, tail]) => {
                const [sx, sy] = getCellCenterPct(parseInt(head));
                const [ex, ey] = getCellCenterPct(parseInt(tail));
                // Add some bezier curvature
                const cx = (sx + ex) / 2 + (Math.random() * 20 - 10);
                const cy = (sy + ey) / 2 + (Math.random() * 20 - 10);
                return (
                    <path 
                      key={`S-${head}`} 
                      d={`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`} 
                      stroke="url(#snakeBody)" 
                      fill="none" 
                      strokeWidth="3.5%" 
                      filter="url(#shadow)" 
                      strokeLinecap="round"
                    />
                );
            })}
             {/* Snake Eyes on heads */}
             {Object.keys(SNAKES).map((head) => {
                const [sx, sy] = getCellCenterPct(parseInt(head));
                return (
                    <g key={`head-${head}`}>
                        <circle cx={`${sx}%`} cy={`${sy}%`} r="2%" fill="#166534" filter="url(#shadow)"/>
                        <circle cx={`${sx - 0.7}%`} cy={`${sy - 0.5}%`} r="0.5%" fill="red"/>
                        <circle cx={`${sx + 0.7}%`} cy={`${sy - 0.5}%`} r="0.5%" fill="red"/>
                    </g>
                );
             })}
        </svg>
    )
}


export default function SnakesGame() {
  const { balance, spend, earn } = useCoins();
  const [bet, setBet] = useState(25);
  const [started, setStarted] = useState(false);
  const [numPlayers, setNumPlayers] = useState(2);
  const [positions, setPositions] = useState([0, 0, 0, 0]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceVal, setDiceVal] = useState(6);
  const [rolling, setRolling] = useState(false);
  const [winner, setWinner] = useState(null);
  const [log, setLog] = useState([]);

  async function startGame() {
    if (balance < bet) { toast.error('Not enough tokens!'); return; }
    const ok = await spend(bet, 'SNAKES');
    if (!ok) return;
    setPositions(Array(numPlayers).fill(0));
    setCurrentPlayer(0);
    setStarted(true);
    setWinner(null);
    setLog(['Game started! Reach 100 first to win.']);
  }

  function addLog(msg) {
    setLog(prev => [msg, ...prev].slice(0, 3));
  }

  function rollDice() {
    if (rolling || winner) return;
    setRolling(true);
    
    setTimeout(() => {
      const val = Math.ceil(Math.random() * 6);
      setDiceVal(val);
      setRolling(false);
      movePlayer(0, val);
    }, 1200);
  }

  function movePlayer(playerIdx, dice) {
    setPositions(prev => {
      const newPos = [...prev];
      let pos = newPos[playerIdx] + dice;
      let msg = `${NAMES[playerIdx]} rolled ${dice}`;

      let displayPos = pos;
      let finalPos = pos;

      if (pos > 100) {
        finalPos = newPos[playerIdx]; // bounce back logic or just don't move
        msg += ' (needs exact roll)';
      } else if (SNAKES[pos]) {
        finalPos = SNAKES[pos];
        msg += ` → 🐍 down to ${finalPos}`;
      } else if (LADDERS[pos]) {
        finalPos = LADDERS[pos];
        msg += ` → 🪜 up to ${finalPos}`;
      } else {
         msg += ` → ${pos}`;
      }

      newPos[playerIdx] = finalPos;
      addLog(msg);

      if (finalPos === 100) {
        const prize = bet * numPlayers * 0.9;
        setWinner(playerIdx);
        if (playerIdx === 0) {
          earn(prize, 'SNAKES');
          toast.success(`You WIN! +${prize.toFixed(0)} 🪙`, { duration: 4000 });
        } else {
          toast(`${NAMES[playerIdx]} wins!`, { icon: '💀' });
        }
        return newPos;
      }

      const nextP = (playerIdx + 1) % numPlayers;
      setCurrentPlayer(nextP);
      
      // AI schedule
      if (nextP !== 0 && numPlayers > 1) {
        setTimeout(() => {
          setRolling(true);
          setTimeout(() => {
            const aiDice = Math.ceil(Math.random() * 6);
            setDiceVal(aiDice);
            setRolling(false);
            
            // Nested state setter for AI move to avoid stale closures
            setPositions(p2 => {
                const np = [...p2];
                let ap = np[nextP] + aiDice;
                let amsg = `${NAMES[nextP]} rolled ${aiDice}`;
                
                if (ap > 100) ap = np[nextP];
                else if (SNAKES[ap]) { amsg += ` → 🐍 ${SNAKES[ap]}`; ap = SNAKES[ap]; }
                else if (LADDERS[ap]) { amsg += ` → 🪜 ${LADDERS[ap]}`; ap = LADDERS[ap]; }
                
                np[nextP] = ap;
                addLog(amsg);
                if (ap === 100) { setWinner(nextP); }
                setCurrentPlayer((nextP + 1) % numPlayers);
                return np;
            });

          }, 1000);
        }, 800);
      }

      return newPos;
    });
  }

  // Handle cascading AIs (when 3 or 4 players)
  useEffect(() => {
    if (currentPlayer !== 0 && !winner && started && !rolling) {
      const t = setTimeout(() => {
        setRolling(true);
        setTimeout(() => {
          const val = Math.ceil(Math.random() * 6);
          setDiceVal(val);
          setRolling(false);
          movePlayer(currentPlayer, val);
        }, 1000);
      }, 1000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, winner, started, rolling]);


  // Build Grid Cells simply
  const cellsArray = Array.from({ length: 100 }, (_, i) => i + 1);

  // Function to render animated player pawns
  const renderPawn = (idx) => {
    if (idx >= numPlayers) return null;
    const [c, r] = getCellCoord(positions[idx]);
    const left = `${c * 10}%`;
    const top  = `${(9 - r) * 10}%`;

    return (
      <div 
        key={idx}
        className="absolute z-20 transition-all duration-[800ms] ease-bounce flex items-center justify-center pointer-events-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]"
        style={{ left, top, width: '10%', height: '10%', transform: `translate(${(idx%2)*15}%, ${(Math.floor(idx/2))*15}%)` }}
      >
        <div 
          className="w-[60%] h-[60%] rounded-[30%] shadow-[inset_0_4px_8px_rgba(255,255,255,0.7),inset_0_-4px_8px_rgba(0,0,0,0.5)] border border-white/20 relative"
          style={{ backgroundColor: COLORS[idx] }}
        >
          <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-white/60 rounded-[40%] blur-[1px]"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0601] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#3a1a01] via-[#0a0601] to-[#040200] text-white flex flex-col items-center px-4 py-8 overflow-hidden font-sans">
      <div className="w-full max-w-md w-full relative z-10 flex flex-col gap-6">
        
        {/* Header Panel */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl px-5 py-4 shadow-2xl">
          <Link to="/lobby" className="text-gray-400 hover:text-white transition flex items-center shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black italic tracking-wider bg-gradient-to-tr from-green-500 via-emerald-400 to-green-200 text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(34,197,94,0.5)]">
            SNAKES & LADDERS
          </h1>
          <div className="font-mono text-yellow-500 font-bold bg-black/40 border border-yellow-500/30 px-3 py-1.5 rounded-full shadow-inner text-sm shrink-0">
             🪙 {balance.toLocaleString()}
          </div>
        </div>

        {!started ? (
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2 text-white">Setup Match</h2>
              <p className="text-gray-400 text-sm">Select number of players and bet.</p>
            </div>
            
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Opponents</label>
            <div className="flex gap-3 justify-between mb-8">
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => setNumPlayers(n)}
                  className={`flex-1 py-3 rounded-xl font-black text-xl transition-all duration-300 ${numPlayers === n ? 'bg-gradient-to-t from-green-700 to-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] text-white scale-105 border border-green-400/50' : 'bg-black/30 border border-white/10 text-gray-500 hover:text-gray-300'}`}>{n}
                </button>
              ))}
            </div>

            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Bet Amount</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {BETs.map(a => (
                <button key={a} onClick={() => setBet(a)}
                  className={`flex-1 min-w-[60px] py-2.5 rounded-xl font-bold transition-all duration-300 ${bet === a ? 'bg-gradient-to-t from-yellow-700 to-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-400/50 scale-105' : 'bg-black/30 border border-white/10 text-gray-400'}`}>
                  {a}
                </button>
              ))}
            </div>
            <div className="text-center text-yellow-500/80 text-sm mb-8 bg-yellow-500/10 py-2 rounded-lg border border-yellow-500/20">
              Win Prize: <b>{(bet * numPlayers * 0.9).toFixed(0)} 🪙</b>
            </div>

            <button onClick={startGame} disabled={balance < bet}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-orange-400 to-orange-600 text-black font-black text-2xl uppercase tracking-widest shadow-[0_10px_20px_rgba(249,115,22,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 border border-orange-300/50">
              Play Now
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
             {/* Realistic Grid Board */}
             <div className="relative w-full aspect-square bg-[#fff] rounded-md p-1 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5),0_10px_30px_rgba(0,0,0,0.8)] border-[12px] border-[#593006] overflow-hidden">
                {/* Vintage paper texture */}
                <div className="absolute inset-0 z-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/rice-paper-3.png')] pointer-events-none"></div>
                
                {/* Tiles */}
                <div className="w-full h-full grid grid-cols-10 grid-rows-10 relative z-0">
                   {cellsArray.map(c => {
                       const [col, row] = getCellCoord(c);
                       const isDark = (col + row) % 2 === 0;
                       return (
                           <div 
                             key={c} 
                             className={`relative flex items-center justify-center border-[0.5px] border-amber-900/10 ${isDark ? 'bg-[#eecda3]' : 'bg-[#f4dfc3]'} shadow-[inset_0_0_10px_rgba(0,0,0,0.05)]`}
                             style={{ gridColumn: col + 1, gridRow: 10 - row }} // CSS Grid rows start at 1 top down
                           >
                              <span className={`text-[10px] sm:text-xs font-black absolute ${isDark ? 'text-amber-900/30' : 'text-amber-700/30'} select-none`} style={{ left: '5%', top: '2%' }}>{c}</span>
                              {c === 1 && <span className="text-[10px] font-bold text-green-700/60 uppercase">Start</span>}
                              {c === 100 && <span className="text-[10px] font-bold text-red-700/60 uppercase">Win</span>}
                           </div>
                       )
                   })}
                </div>

                <SVGLayer />

                {/* Pawns mapped independently of the DOM Grid structure */}
                {renderPawn(0)}
                {renderPawn(1)}
                {renderPawn(2)}
                {renderPawn(3)}
             </div>

             {/* Bottom Panel */}
             <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                {/* Winner Overlay */}
                {winner !== null && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
                    <h2 className="text-3xl font-black uppercase tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] animate-bounce" style={{ color: COLORS[winner] }}>
                      {winner === 0 ? '🏆 YOU WIN!' : `❌ ${NAMES[winner]} WINS!`}
                    </h2>
                    <p className="text-gray-300 font-bold mb-6">
                      {winner === 0 ? `+${(bet * numPlayers * 0.9).toFixed(0)} Tokens` : `Better luck next match.`}
                    </p>
                    <div className="flex gap-4 w-full">
                      <button onClick={() => setStarted(false)} className="flex-1 py-3 bg-white/20 border border-white/30 rounded-xl hover:bg-white/30 transition text-white font-bold">Play Again</button>
                      <Link to="/lobby" className="flex-1 py-3 bg-green-600 border border-green-500 rounded-xl hover:bg-green-500 transition text-white font-bold text-center">Back to Lobby</Link>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4 items-center">
                    {/* Log */}
                    <div className="flex-1 flex flex-col justify-center h-[90px] px-2 overflow-hidden mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)">
                        {log.map((l, i) => (
                           <div key={i} className={`text-sm font-medium ${i===0 ? 'text-white' : 'text-gray-500'} truncate transition-all`}>
                             {l}
                           </div>
                        ))}
                    </div>

                    {/* Interactive Dice */}
                    <div className="shrink-0 flex flex-col items-center gap-2">
                        <div className={`transition-all duration-300 ${currentPlayer !== 0 || winner || rolling ? 'opacity-80 scale-95' : 'scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]'}`}>
                          <Dice3D value={diceVal} isRolling={rolling} />
                        </div>
                        <button 
                          onClick={rollDice} 
                          disabled={currentPlayer !== 0 || rolling || winner !== null}
                          className="px-6 py-2 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 font-black text-sm uppercase text-black shadow-[0_4px_15px_rgba(245,158,11,0.5)] active:scale-95 transition disabled:opacity-50 disabled:grayscale"
                        >
                          Roll Dice
                        </button>
                    </div>
                </div>

                {/* Player Status indicators */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                    {Array.from({ length: numPlayers }).map((_, i) => (
                        <div key={i} className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition ${currentPlayer === i ? 'bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)] scale-105' : 'opacity-60'}`}>
                            <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: COLORS[i] }}></div>
                            <span className="text-[10px] uppercase font-bold text-gray-300">{NAMES[i].split(' ')[0]}</span>
                            <span className="text-[10px] font-mono text-gray-500">[{positions[i] || 0}]</span>
                        </div>
                    ))}
                </div>
             </div>

          </div>
        )}
      </div>
    </div>
  );
}
