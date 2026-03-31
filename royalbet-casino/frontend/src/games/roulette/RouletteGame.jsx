import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../store/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────────────────────
const RED_NUMBERS  = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const CHIP_VALUES  = [10, 25, 50, 100, 500];

// European roulette wheel order (single-zero)
const WHEEL_ORDER = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,
  5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];

const getColor = (n) => {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
};

// The 3×12 grid for numbers 1-36 (standard European table layout)
// Row 0 (top): 3,6,9,...,36  |  Row 1 (mid): 2,5,8,...,35  |  Row 2 (bot): 1,4,7,...,34
const TABLE_ROWS = [
  [3,6,9,12,15,18,21,24,27,30,33,36],
  [2,5,8,11,14,17,20,23,26,29,32,35],
  [1,4,7,10,13,16,19,22,25,28,31,34],
];

// ─── Chip Component ───────────────────────────────────────────────────────────
const CHIP_COLORS = {
  10:  { bg: '#e74c3c', ring: '#c0392b', text: '#fff' },
  25:  { bg: '#2ecc71', ring: '#27ae60', text: '#fff' },
  50:  { bg: '#3498db', ring: '#2980b9', text: '#fff' },
  100: { bg: '#f39c12', ring: '#e67e22', text: '#000' },
  500: { bg: '#9b59b6', ring: '#8e44ad', text: '#fff' },
};

function ChipBadge({ amount, size = 28 }) {
  // Find the best chip breakdown to display
  const sorted = [...CHIP_VALUES].sort((a, b) => b - a);
  let remainder = amount;
  let chipVal = sorted.find(v => v <= remainder) || 10;
  const colors = CHIP_COLORS[chipVal];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: colors.bg, border: `3px solid ${colors.ring}`,
      color: colors.text, fontSize: size * 0.35, fontWeight: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.5)', position: 'relative', zIndex: 10,
      lineHeight: 1, userSelect: 'none',
    }}>
      {amount}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RouletteGame() {
  const { user }      = useAuth();
  const queryClient   = useQueryClient();

  // State
  const [balance, setBalance]       = useState(0);
  const [selectedChip, setSelectedChip] = useState(10);
  const [bets, setBets]             = useState({});   // key -> { type, numbers, amount }
  const [spinning, setSpinning]     = useState(false);
  const [result, setResult]         = useState(null);  // { winningNumber, color, totalWin, betResults }
  const [history, setHistory]       = useState([]);    // last 20 numbers
  const [wheelAngle, setWheelAngle] = useState(0);
  const [showBall, setShowBall]     = useState(false);
  const wheelRef                    = useRef(null);
  const ballRef                     = useRef(null);

  // Balance query
  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => (await axios.get('/wallet/balance')).data,
  });
  useEffect(() => { if (balanceData) setBalance(balanceData.balance); }, [balanceData]);

  // Total bet
  const totalBet = Object.values(bets).reduce((s, b) => s + b.amount, 0);

  // ─── Place Bet ────────────────────────────────────────────────────────────
  const placeBet = useCallback((key, type, numbers) => {
    if (spinning) return;
    setBets(prev => {
      const existing = prev[key];
      if (existing) {
        return { ...prev, [key]: { ...existing, amount: existing.amount + selectedChip } };
      }
      return { ...prev, [key]: { type, numbers: [...numbers], amount: selectedChip } };
    });
  }, [selectedChip, spinning]);

  // ─── Clear Bets ───────────────────────────────────────────────────────────
  const clearBets = () => { if (!spinning) setBets({}); };

  // ─── Spin Mutation ────────────────────────────────────────────────────────
  const spinMutation = useMutation({
    mutationFn: async (betArray) => {
      const res = await axios.post('/games/roulette/spin', { bets: betArray });
      return res.data;
    },
    onSuccess: (data) => handleSpinResult(data),
    onError: (err) => {
      setSpinning(false);
      alert(err.response?.data?.error || 'Spin failed');
    },
  });

  // ─── Spin Action ──────────────────────────────────────────────────────────
  const handleSpin = () => {
    if (spinning || totalBet === 0 || totalBet > balance) return;
    setSpinning(true);
    setResult(null);
    setShowBall(false);

    const betArray = Object.values(bets);
    spinMutation.mutate(betArray);
  };

  // ─── Handle Spin Result ───────────────────────────────────────────────────
  const handleSpinResult = (data) => {
    const { winningNumber, color, totalWin, newBalance, betResults } = data;

    // Calculate wheel rotation
    const pocketIndex = WHEEL_ORDER.indexOf(winningNumber);
    const degreesPerPocket = 360 / 37;
    // Target angle: multiple full rotations + pocket position
    const extraRotations = 5 + Math.floor(Math.random() * 3); // 5-7 full turns
    const targetAngle = wheelAngle + (extraRotations * 360) + (360 - pocketIndex * degreesPerPocket);

    setWheelAngle(targetAngle);

    // Show ball after a small delay
    setTimeout(() => setShowBall(true), 300);

    // After spin animation completes (~4s)
    setTimeout(() => {
      setResult({ winningNumber, color, totalWin, betResults });
      setBalance(newBalance);
      setHistory(prev => [{ number: winningNumber, color }, ...prev].slice(0, 20));
      queryClient.invalidateQueries(['balance']);

      // Clear winning bets visual after showing result
      setTimeout(() => {
        setSpinning(false);
        setBets({});
      }, 2000);
    }, 4500);
  };

  // ─── Bet key helpers ──────────────────────────────────────────────────────
  const betOnNumber = (n) => placeBet(`straight_${n}`, 'straight', [n]);

  const betOnSplit = (a, b) => {
    const key = `split_${Math.min(a,b)}_${Math.max(a,b)}`;
    placeBet(key, 'split', [a, b]);
  };

  const betOnStreet = (row) => {
    const base = (row - 1) * 3 + 1;
    placeBet(`street_${base}`, 'street', [base, base+1, base+2]);
  };

  const betOnCorner = (a, b, c, d) => {
    const key = `corner_${[a,b,c,d].sort().join('_')}`;
    placeBet(key, 'corner', [a, b, c, d]);
  };

  const betOnDozen = (d) => {
    const nums = Array.from({ length: 12 }, (_, i) => i + 1 + (d - 1) * 12);
    placeBet(`dozen_${d}`, 'dozen', nums);
  };

  const betOnColumn = (col) => {
    const nums = TABLE_ROWS[3 - col].slice(); // col 1=bottom row, col 3=top row
    placeBet(`column_${col}`, 'column', nums);
  };

  const betOnRedBlack = (color) => {
    const nums = color === 'red' ? [...RED_NUMBERS] : [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
    placeBet(`red_black_${color}`, 'red_black', nums);
  };

  const betOnOddEven = (type) => {
    const nums = Array.from({ length: 36 }, (_, i) => i + 1).filter(n => type === 'odd' ? n % 2 === 1 : n % 2 === 0);
    placeBet(`odd_even_${type}`, 'odd_even', nums);
  };

  const betOnLowHigh = (type) => {
    const nums = type === 'low' ? Array.from({ length: 18 }, (_, i) => i + 1) : Array.from({ length: 18 }, (_, i) => i + 19);
    placeBet(`low_high_${type}`, 'low_high', nums);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-casino-bg text-gray-200 flex flex-col items-center p-4 md:p-6">
      {/* Header */}
      <div className="w-full max-w-6xl flex items-center justify-between mb-4">
        <Link to="/lobby" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
          <ArrowLeft size={20} /> <span className="text-sm font-bold">LOBBY</span>
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-brand-accent tracking-wider">EUROPEAN ROULETTE</h1>
        <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-1.5 border border-gray-700">
          <span className="text-brand-accent">🪙</span>
          <span className="font-mono font-bold text-white">{balance.toLocaleString()}</span>
        </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* LEFT: Wheel + Table */}
        <div className="space-y-6">

          {/* ─── WHEEL ─────────────────────────────────────── */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: 280, height: 280 }}>
              {/* Wheel pointer / marker */}
              <div style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
                borderTop: '18px solid #FFD700', zIndex: 30, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
              }} />

              {/* The wheel */}
              <div
                ref={wheelRef}
                style={{
                  width: 280, height: 280, borderRadius: '50%',
                  border: '8px solid #2d1810',
                  background: generateWheelGradient(),
                  transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  transform: `rotate(${wheelAngle}deg)`,
                  boxShadow: '0 0 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.4)',
                  position: 'relative',
                }}
              >
                {/* Number labels on wheel */}
                {WHEEL_ORDER.map((num, i) => {
                  const angle = (i * 360) / 37;
                  return (
                    <div key={num} style={{
                      position: 'absolute', left: '50%', top: '50%',
                      transform: `rotate(${angle}deg) translateY(-120px)`,
                      transformOrigin: '0 0',
                      fontSize: 9, fontWeight: 700, color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      width: 0, display: 'flex', justifyContent: 'center',
                    }}>
                      <span style={{ transform: `rotate(${-angle}deg)` }}>{num}</span>
                    </div>
                  );
                })}
                {/* Center circle */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'radial-gradient(circle, #3a2515 0%, #1a0b05 100%)',
                  border: '4px solid #4a3525',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)',
                }}>
                  <span style={{ fontSize: 10, color: '#c0a080', fontWeight: 700, letterSpacing: 1 }}>ROYALBET</span>
                </div>
              </div>

              {/* Ball indicator (appears after spin) */}
              {showBall && (
                <div style={{
                  position: 'absolute', top: 8, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 12, height: 12, borderRadius: '50%',
                  background: 'radial-gradient(circle at 30% 30%, #fff, #ccc)',
                  boxShadow: '0 0 8px rgba(255,255,255,0.8)',
                  zIndex: 25,
                  animation: 'ballPulse 0.6s ease-in-out infinite alternate',
                }} />
              )}
            </div>
          </div>

          {/* ─── RESULT DISPLAY ─────────────────────────────── */}
          {result && (
            <div className="text-center py-3 rounded-xl border" style={{
              background: result.totalWin > 0 ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)',
              borderColor: result.totalWin > 0 ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)',
            }}>
              <div className="flex items-center justify-center gap-3 mb-1">
                <span className="text-sm text-gray-400">Winning Number:</span>
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-lg"
                  style={{ background: result.color === 'red' ? '#e74c3c' : result.color === 'green' ? '#27ae60' : '#2c3e50' }}>
                  {result.winningNumber}
                </span>
              </div>
              <p className={`font-bold text-xl ${result.totalWin > 0 ? 'text-brand-accent' : 'text-gray-500'}`}>
                {result.totalWin > 0 ? `+${result.totalWin.toLocaleString()} tokens! 🎉` : 'No win this round'}
              </p>
            </div>
          )}

          {/* ─── BETTING TABLE ──────────────────────────────── */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[700px]">
              {/* Main grid: zero + 3×12 numbers + column bets */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '50px repeat(12, 1fr) 50px',
                gridTemplateRows: 'repeat(3, 50px)',
                gap: 2,
              }}>
                {/* Zero - spans all 3 rows in col 1 */}
                <button
                  onClick={() => betOnNumber(0)}
                  className="relative rounded-l-lg font-bold text-white text-lg hover:brightness-125 transition cursor-pointer"
                  style={{
                    gridColumn: '1', gridRow: '1 / 4',
                    background: '#27ae60',
                    border: bets['straight_0'] ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  0
                  {bets['straight_0'] && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ChipBadge amount={bets['straight_0'].amount} size={24} />
                    </div>
                  )}
                </button>

                {/* 3×12 number cells */}
                {TABLE_ROWS.map((row, ri) =>
                  row.map((num, ci) => {
                    const color = getColor(num);
                    const betKey = `straight_${num}`;
                    return (
                      <button
                        key={num}
                        onClick={() => betOnNumber(num)}
                        className="relative font-bold text-sm text-white hover:brightness-125 transition cursor-pointer"
                        style={{
                          gridColumn: ci + 2,
                          gridRow: ri + 1,
                          background: color === 'red' ? '#c0392b' : '#2c3e50',
                          border: bets[betKey] ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        {num}
                        {bets[betKey] && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ChipBadge amount={bets[betKey].amount} size={22} />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}

                {/* Column bets (2:1) - right side */}
                {[3, 2, 1].map((col, ri) => {
                  const betKey = `column_${col}`;
                  return (
                    <button
                      key={`col_${col}`}
                      onClick={() => betOnColumn(col)}
                      className="relative rounded-r-sm bg-gray-800 text-xs font-bold text-gray-300 hover:bg-gray-700 transition cursor-pointer"
                      style={{
                        gridColumn: 14, gridRow: ri + 1,
                        border: bets[betKey] ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      2:1
                      {bets[betKey] && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ChipBadge amount={bets[betKey].amount} size={20} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Dozens row */}
              <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(3, 1fr)', gap: 2, marginTop: 2 }}>
                <div /> {/* empty cell for zero column */}
                {[1, 2, 3].map(d => {
                  const betKey = `dozen_${d}`;
                  const labels = ['1st 12', '2nd 12', '3rd 12'];
                  return (
                    <button
                      key={`dozen_${d}`}
                      onClick={() => betOnDozen(d)}
                      className="relative h-10 bg-gray-800 text-sm font-bold text-gray-300 hover:bg-gray-700 transition cursor-pointer rounded-sm"
                      style={{
                        border: bets[betKey] ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {labels[d - 1]}
                      {bets[betKey] && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ChipBadge amount={bets[betKey].amount} size={20} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Outside bets row */}
              <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(6, 1fr)', gap: 2, marginTop: 2 }}>
                <div /> {/* empty cell for zero column */}
                {[
                  { label: '1-18',  fn: () => betOnLowHigh('low'),   key: 'low_high_low' },
                  { label: 'EVEN',  fn: () => betOnOddEven('even'),  key: 'odd_even_even' },
                  { label: '🔴',    fn: () => betOnRedBlack('red'),  key: 'red_black_red',  bg: '#c0392b' },
                  { label: '⚫',    fn: () => betOnRedBlack('black'), key: 'red_black_black', bg: '#2c3e50' },
                  { label: 'ODD',   fn: () => betOnOddEven('odd'),   key: 'odd_even_odd' },
                  { label: '19-36', fn: () => betOnLowHigh('high'),  key: 'low_high_high' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={item.fn}
                    className="relative h-10 text-sm font-bold text-gray-200 hover:brightness-125 transition cursor-pointer rounded-sm"
                    style={{
                      background: item.bg || '#374151',
                      border: bets[item.key] ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {item.label}
                    {bets[item.key] && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ChipBadge amount={bets[item.key].amount} size={20} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Chips + Controls + History */}
        <div className="space-y-4">
          {/* Chip Selector */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-bold mb-3 tracking-widest">Select Chip</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {CHIP_VALUES.map(val => {
                const colors = CHIP_COLORS[val];
                const isActive = selectedChip === val;
                return (
                  <button
                    key={val}
                    onClick={() => setSelectedChip(val)}
                    className="transition-transform cursor-pointer"
                    style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: colors.bg,
                      border: `4px solid ${isActive ? '#FFD700' : colors.ring}`,
                      color: colors.text,
                      fontSize: 14, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isActive
                        ? '0 0 15px rgba(255,215,0,0.6), 0 4px 8px rgba(0,0,0,0.4)'
                        : '0 2px 6px rgba(0,0,0,0.3)',
                      transform: isActive ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Total Bet + Controls */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm font-bold">Total Bet</span>
              <span className="font-mono text-xl text-white font-bold">🪙 {totalBet.toLocaleString()}</span>
            </div>

            <button
              onClick={handleSpin}
              disabled={spinning || totalBet === 0 || totalBet > balance}
              className={`w-full py-4 rounded-xl font-display text-2xl transition-all transform active:scale-95 cursor-pointer
                ${spinning ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : totalBet === 0 || totalBet > balance ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-b from-brand-accent to-yellow-600 text-black shadow-[0_5px_0_#b45309,0_10px_20px_rgba(255,215,0,0.4)] hover:brightness-110'}`}
            >
              {spinning ? 'SPINNING...' : 'SPIN 🎡'}
            </button>

            <button
              onClick={clearBets}
              disabled={spinning || totalBet === 0}
              className="w-full py-2.5 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm hover:bg-gray-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              CLEAR BETS
            </button>
          </div>

          {/* Quick Bets */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-bold mb-3 tracking-widest">Quick Bets</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Street 1-3', fn: () => betOnStreet(1) },
                { label: 'Street 4-6', fn: () => betOnStreet(2) },
                { label: 'Street 7-9', fn: () => betOnStreet(3) },
                { label: 'Split 1,2', fn: () => betOnSplit(1, 2) },
                { label: 'Corner 1-4', fn: () => betOnCorner(1, 2, 4, 5) },
                { label: 'Split 0,1', fn: () => betOnSplit(0, 1) },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.fn}
                  disabled={spinning}
                  className="text-xs py-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition font-medium cursor-pointer disabled:opacity-40"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result History */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-bold mb-3 tracking-widest">Recent Results</p>
            {history.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">No spins yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold"
                    style={{
                      background: h.color === 'red' ? '#e74c3c'
                        : h.color === 'green' ? '#27ae60' : '#2c3e50',
                      border: '2px solid rgba(255,255,255,0.15)',
                      opacity: 1 - (i * 0.03),
                    }}
                  >
                    {h.number}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes ballPulse {
          0% { opacity: 0.7; transform: translateX(-50%) scale(0.9); }
          100% { opacity: 1; transform: translateX(-50%) scale(1.1); }
        }
      `}</style>
    </div>
  );
}

// ─── Wheel Gradient Generator ─────────────────────────────────────────────────
function generateWheelGradient() {
  const sliceAngle = 360 / 37;
  const stops = [];

  WHEEL_ORDER.forEach((num, i) => {
    const color = num === 0 ? '#27ae60'
      : RED_NUMBERS.includes(num) ? '#c0392b' : '#1a1a2e';
    const start = i * sliceAngle;
    const end   = (i + 1) * sliceAngle;
    stops.push(`${color} ${start}deg ${end}deg`);
  });

  return `conic-gradient(from 0deg, ${stops.join(', ')})`;
}
