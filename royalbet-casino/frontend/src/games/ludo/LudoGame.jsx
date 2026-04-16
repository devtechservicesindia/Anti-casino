import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCoins } from '../../hooks/useCoins';

// ─── LUDO PATH CALCULATIONS ──────────────────────────────────────────────────
// 15x15 grid coordinates for the 52 perimeter steps
const PERIMETER = [
  [1,6],[2,6],[3,6],[4,6],[5,6],         // 0-4
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],   // 5-10
  [7,0],[8,0],                           // 11-12
  [8,1],[8,2],[8,3],[8,4],[8,5],         // 13-17 (Blue Start = 13)
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6], // 18-23
  [14,7],[14,8],                         // 24-25
  [13,8],[12,8],[11,8],[10,8],[9,8],     // 26-30 (Green Start = 26)
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14], // 31-36
  [7,14],[6,14],                         // 37-38
  [6,13],[6,12],[6,11],[6,10],[6,9],     // 39-43 (Yellow Start = 39)
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],   // 44-49
  [0,7]                                  // 50 
]; // Missing one closing link: [0,6] gets it back to start, but the start is [1,6]. Red actually starts at [1,6]. Wait, [0,7] to [1,6] needs [0,6]. Let's add [0,6]
PERIMETER.splice(51, 0, [0,6]);

// Map position to grid XY [0..14]
function getPawnCoord(playerIdx, pos) {
  if (pos === 0) {
    // Base positions
    if (playerIdx === 0) return [2.5, 2.5]; // Red
    if (playerIdx === 1) return [11.5, 2.5]; // Blue
    if (playerIdx === 2) return [11.5, 11.5]; // Green
    if (playerIdx === 3) return [2.5, 11.5]; // Yellow
  }

  // 1 to 51: traversing perimeter
  if (pos <= 51) {
    const startOffsets = [0, 13, 26, 39];
    const rawIdx = (startOffsets[playerIdx] + pos - 1) % 52;
    return PERIMETER[rawIdx];
  }

  // 52 to 57: home straights
  const homeStraights = [
    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]], // Red
    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]], // Blue
    [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]], // Green
    [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]]  // Yellow
  ];
  return homeStraights[playerIdx][Math.min(pos - 52, 5)];
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const NAMES  = ['Red (You)', 'Blue', 'Green', 'Yellow'];
const BETs   = [10, 25, 50, 100, 500];
const WIN_STEPS = 57;

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
      // Snap to final face
      const faceRotations = {
        1: { x: 0, y: 0 },
        2: { x: 0, y: -90 },
        3: { x: -90, y: 0 },
        4: { x: 90, y: 0 },
        5: { x: 0, y: 90 },
        6: { x: 180, y: 0 }
      };
      const r = faceRotations[value || 1];
      setRotX(r.x + 360 * 2); // spin extra 2 times for stopping
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
        <div className="cube-face front flex justify-center items-center absolute w-full h-full bg-white border-4 border-gray-200 rounded-xl">
          <span className="w-3 h-3 bg-red-600 rounded-full shadow-inner"></span>
        </div>
        <div className="cube-face right flex justify-between p-3 absolute w-full h-full bg-white border-4 border-gray-200 rounded-xl" style={{ transform: 'rotateY(90deg) translateZ(32px)' }}>
          <span className="w-3 h-3 bg-black rounded-full self-start"></span>
          <span className="w-3 h-3 bg-black rounded-full self-end"></span>
        </div>
        <div className="cube-face bottom flex justify-between p-2 absolute w-full h-full bg-white border-4 border-gray-200 rounded-xl" style={{ transform: 'rotateX(-90deg) translateZ(32px)' }}>
          <span className="w-3 h-3 bg-black rounded-full self-start"></span>
          <span className="w-3 h-3 bg-black rounded-full self-center"></span>
          <span className="w-3 h-3 bg-black rounded-full self-end"></span>
        </div>
        <div className="cube-face top flex flex-wrap justify-between p-2 absolute w-full h-full bg-white border-4 border-gray-200 rounded-xl" style={{ transform: 'rotateX(90deg) translateZ(32px)' }}>
          <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
          <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
        </div>
        <div className="cube-face left flex flex-wrap justify-center items-center content-between p-2 absolute w-full h-full bg-white border-4 border-gray-200 rounded-xl" style={{ transform: 'rotateY(-90deg) translateZ(32px)' }}>
          <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
          <div className="w-full flex justify-center items-center"><span className="w-3 h-3 bg-black rounded-full"></span></div>
          <div className="w-full flex justify-between"><span className="w-3 h-3 bg-black rounded-full"></span><span className="w-3 h-3 bg-black rounded-full"></span></div>
        </div>
        <div className="cube-face back flex flex-wrap justify-between p-2 absolute w-full h-full bg-white border-4 border-gray-200 rounded-xl" style={{ transform: 'rotateY(180deg) translateZ(32px)' }}>
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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LudoGame() {
  const { balance, spend, earn } = useCoins();
  const [bet, setBet] = useState(25);
  const [started, setStarted] = useState(false);
  const [numPlayers, setNumPlayers] = useState(2);
  const [positions, setPositions] = useState([0, 0, 0, 0]);
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState(6); // Default 6 to show face
  const [rolling, setRolling] = useState(false);
  const [winner, setWinner] = useState(null);
  const [log, setLog] = useState([]);

  async function start() {
    if (balance < bet) { toast.error('Not enough tokens!'); return; }
    const ok = await spend(bet, 'LUDO');
    if (!ok) return;
    setPositions([0, 0, 0, 0]);
    setTurn(0);
    setStarted(true);
    setWinner(null);
    setLog(['Game started! Roll a 6 to enter the board.']);
  }

  function addLog(msg) {
    setLog(prev => [msg, ...prev].slice(0, 3));
  }

  function roll() {
    if (rolling || winner) return;
    setRolling(true);
    
    // Simulate dice roll time
    setTimeout(() => {
      const val = Math.ceil(Math.random() * 6);
      setDice(val);
      setRolling(false);
      doMove(0, val);
    }, 1200);
  }

  function doMove(playerIdx, val, currentPos = null) {
    setPositions(prev => {
      const p = [...prev];
      let pos = currentPos !== null ? currentPos : p[playerIdx];

      if (pos === 0) {
        if (val === 6) { pos = 1; addLog(`${NAMES[playerIdx]} rolled 6 — enters!`); }
        else { addLog(`${NAMES[playerIdx]} rolled ${val} — needs 6`); }
      } else {
        pos += val;
        if (pos > WIN_STEPS) {
          pos = p[playerIdx]; // need exact
          addLog(`${NAMES[playerIdx]} rolled ${val} — needs exact`);
        } else {
          addLog(`${NAMES[playerIdx]} moved +${val}`);
        }
      }

      p[playerIdx] = pos;

      if (pos === WIN_STEPS) {
        setWinner(playerIdx);
        if (playerIdx === 0) {
          const prize = bet * numPlayers * 0.9;
          earn(prize, 'LUDO');
          toast.success(`You WIN! +${prize.toFixed(0)} 🪙`, { duration: 4000 });
        } else {
          toast(`${NAMES[playerIdx]} Wins!`, { icon: '💀' });
        }
        return p;
      }

      const nextRow = (playerIdx + 1) % numPlayers;
      setTurn(nextRow);
      
      // Schedule AI turn
      if (nextRow !== 0 && numPlayers > 1) {
        setTimeout(() => {
          setRolling(true);
          setTimeout(() => {
            const aiRoll = Math.ceil(Math.random() * 6);
            setDice(aiRoll);
            setRolling(false);
            
            setPositions(prev2 => {
              const ap = [...prev2];
              let apos = ap[nextRow];
              if (apos === 0) { if (aiRoll === 6) apos = 1; }
              else { apos += aiRoll; if (apos > WIN_STEPS) apos = ap[nextRow]; }
              ap[nextRow] = apos;
              
              if (apos === WIN_STEPS) { setWinner(nextRow); }
              addLog(`${NAMES[nextRow]} rolled ${aiRoll}`);
              setTurn( (nextRow + 1) % numPlayers );
              
              // Chain next AI if needed
              const futureTurn = (nextRow + 1) % numPlayers;
              if (futureTurn !== 0 && futureTurn !== nextRow && apos !== WIN_STEPS) {
                  // Wait and then we let React handle the next effect manually or we just trigger doMove recursively? 
                  // Because state updates are queued, recursive doMove inside state setter is bad.
                  // simpler approach: we just call doMove for the next player outside.
              }
              return ap;
            });
            
          }, 1000);
        }, 800);
      }

      return p;
    });
  }

  // React strictly to chained AI turns using an effect
  useEffect(() => {
    if (turn !== 0 && !winner && started && !rolling) {
      // AI's turn is active but it hasn't rolled.
      // This catches the condition where the nextRow above was also an AI.
      const aiLoop = setTimeout(() => {
        setRolling(true);
        setTimeout(() => {
          const val = Math.ceil(Math.random() * 6);
          setDice(val);
          setRolling(false);
          doMove(turn, val);
        }, 1000);
      }, 1000);
      return () => clearTimeout(aiLoop);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, started, rolling]);


  // Calculate SVG pawn positions based on Grid Coords
  function renderPawn(idx) {
    if (idx >= numPlayers) return null;
    const [c, r] = getPawnCoord(idx, positions[idx]);
    // Grid matches 0-14, Box width inside board is 40px (15 * 40 = 600px max)
    // Board is 100% width up to 400px. Let's use percentages for absolute positioning.
    const left = `${(c / 15) * 100}%`;
    const top  = `${(r / 15) * 100}%`;
    const cellW = `${100/15}%`;

    return (
      <div 
        key={idx}
        className="absolute z-10 transition-all duration-500 ease-in-out flex items-center justify-center pointer-events-none drop-shadow-2xl"
        style={{ left, top, width: cellW, height: cellW }}
      >
        <div 
          className="w-3/4 h-3/4 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.8),inset_0_4px_8px_rgba(255,255,255,0.7),inset_0_-4px_8px_rgba(0,0,0,0.5)] border border-white/20 relative"
          style={{ backgroundColor: COLORS[idx] }}
        >
          {/* Pawn Highlight point (3D feel) */}
          <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-white/60 rounded-full blur-[1px]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050012] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1f0e38] via-[#050012] to-[#010005] text-white flex flex-col items-center px-4 py-8 overflow-hidden font-sans">
      <div className="w-full max-w-md w-full relative z-10 flex flex-col gap-6">

        {/* Header Panel */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl px-5 py-4 shadow-2xl">
          <Link to="/lobby" className="text-gray-400 hover:text-white transition flex items-center shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black italic tracking-wider bg-gradient-to-tr from-red-600 via-red-400 to-yellow-400 text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(2ef,68,68,0.5)]">
            LUDO ROYALE
          </h1>
          <div className="font-mono text-yellow-500 font-bold bg-black/40 border border-yellow-500/30 px-3 py-1.5 rounded-full shadow-inner text-sm shrink-0">
            🪙 {balance.toLocaleString()}
          </div>
        </div>

        {!started ? (
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2 text-white">Setup Match</h2>
              <p className="text-gray-400 text-sm">Select players and place your tokens.</p>
            </div>
            
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Opponents</label>
            <div className="flex gap-3 justify-between mb-8">
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => setNumPlayers(n)}
                  className={`flex-1 py-3 rounded-xl font-black text-xl transition-all duration-300 ${numPlayers === n ? 'bg-gradient-to-t from-red-700 to-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] text-white scale-105 border border-red-400/50' : 'bg-black/30 border border-white/10 text-gray-500 hover:text-gray-300'}`}>{n}
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

            <button onClick={start} disabled={balance < bet}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-green-400 to-green-700 text-white font-black text-2xl uppercase tracking-widest shadow-[0_10px_20px_rgba(22,163,74,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 border border-green-300/50">
              Play Now
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* 3D Realistic Ludo Board Container */}
            <div className="relative w-full aspect-square bg-[#ececec] rounded-3xl p-3 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5),0_10px_30px_rgba(0,0,0,0.8)] border-[10px] border-[#3d1f00] overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
              
              {/* Board CSS Grid Graphic */}
              <div className="w-full h-full relative" style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)', gap: '1px', backgroundColor: '#ccc' }}>
                {Array.from({ length: 225 }).map((_, i) => {
                  const x = i % 15; const y = Math.floor(i / 15);
                  let bg = '#fff';
                  
                  // Home bases
                  if (x < 6 && y < 6) bg = COLORS[0];
                  if (x > 8 && y < 6) bg = COLORS[1];
                  if (x > 8 && y > 8) bg = COLORS[2];
                  if (x < 6 && y > 8) bg = COLORS[3];
                  
                  // Home straights
                  if (y === 7 && x > 0 && x < 6) bg = COLORS[0];
                  if (x === 7 && y > 0 && y < 6) bg = COLORS[1];
                  if (y === 7 && x > 8 && x < 14) bg = COLORS[2];
                  if (x === 7 && y > 8 && y < 14) bg = COLORS[3];
                  
                  // Start squares
                  if (x === 1 && y === 6) bg = COLORS[0];
                  if (x === 8 && y === 1) bg = COLORS[1];
                  if (x === 13 && y === 8) bg = COLORS[2];
                  if (x === 6 && y === 13) bg = COLORS[3];

                  // Colored Home Base Inners (make them white distinct boxes)
                  if ((x > 0 && x < 5 && y > 0 && y < 5) || 
                      (x > 9 && x < 14 && y > 0 && y < 5) || 
                      (x > 9 && x < 14 && y > 9 && y < 14) || 
                      (x > 0 && x < 5 && y > 9 && y < 14)) bg = '#fff';

                  return <div key={i} style={{ backgroundColor: bg }} className="w-full h-full border border-black/10"></div>;
                })}
              </div>

              {/* Center Home Triangle Image overlay - pure css using borders */}
              <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] z-0">
                <div className="w-full h-full relative overflow-hidden bg-white shadow-inner border border-black/20">
                    <div className="absolute top-0 left-0 border-t-[30px] border-l-[30px] border-r-[30px] border-b-0 border-t-transparent border-r-transparent border-l-red-500 w-full h-full rotate-45 transform origin-top-left"></div>
                    <div className="absolute top-0 right-0 border-t-[30px] border-l-0 border-r-[30px] border-b-[30px] border-t-transparent border-b-transparent border-r-blue-500 w-full h-full -rotate-45 transform origin-top-right"></div>
                    <div className="absolute bottom-0 right-0 border-t-0 border-l-[30px] border-r-[30px] border-b-[30px] border-b-green-500 border-r-transparent border-l-transparent w-full h-full -rotate-45 transform origin-bottom-right"></div>
                    <div className="absolute bottom-0 left-0 border-t-[30px] border-l-[30px] border-r-0 border-b-[30px] border-l-transparent border-t-transparent border-b-yellow-500 w-full h-full rotate-45 transform origin-bottom-left"></div>
                </div>
              </div>

              {/* Dynamic Animated Tokens */}
              {renderPawn(0)}
              {renderPawn(1)}
              {renderPawn(2)}
              {renderPawn(3)}
            </div>

            {/* Bottom Actions Panel */}
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
                      <Link to="/lobby" className="flex-1 py-3 bg-red-600 border border-red-500 rounded-xl hover:bg-red-500 transition text-white font-bold text-center">Back to Lobby</Link>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4 items-center">
                    {/* Log details */}
                    <div className="flex-1 flex flex-col justify-center h-[90px] px-2 overflow-hidden mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)">
                        {log.map((l, i) => (
                           <div key={i} className={`text-sm font-medium ${i===0 ? 'text-white' : 'text-gray-500'} truncate transition-all`}>
                             {l}
                           </div>
                        ))}
                    </div>

                    {/* Interactive Dice */}
                    <div className="shrink-0 flex flex-col items-center gap-2">
                        <div className={`transition-all duration-300 ${turn !== 0 || winner || rolling ? 'opacity-80 scale-95' : 'scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]'}`}>
                          <Dice3D value={dice} isRolling={rolling} />
                        </div>
                        <button 
                          onClick={roll} 
                          disabled={turn !== 0 || rolling || winner !== null}
                          className="px-6 py-2 rounded-full bg-gradient-to-r from-red-600 to-orange-500 font-black text-sm uppercase shadow-[0_4px_15px_rgba(220,38,38,0.5)] active:scale-95 transition disabled:opacity-50 disabled:grayscale"
                        >
                          Roll Dice
                        </button>
                    </div>
                </div>

                {/* Player Status indicators */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                    {Array.from({ length: numPlayers }).map((_, i) => (
                        <div key={i} className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition ${turn === i ? 'bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)] scale-105' : 'opacity-60'}`}>
                            <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: COLORS[i] }}></div>
                            <span className="text-[10px] uppercase font-bold text-gray-300">{NAMES[i].split(' ')[0]}</span>
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
