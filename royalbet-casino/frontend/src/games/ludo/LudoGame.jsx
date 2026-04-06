import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import toast from 'react-hot-toast';

function DiceIcon({ value }) {
  const icons = [null, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
  const Icon = icons[value];
  return Icon ? <Icon size={40} className="text-white" /> : null;
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b']; // R, B, G, Y
const NAMES  = ['Red', 'Blue', 'Green', 'Yellow'];
const BETs = [10, 25, 50, 100];

// Simplified Ludo for demo: 
// 1 pawn per player. Move 57 steps to win.
// Board is just a list of steps.

export default function LudoGame() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(25);
  const [started, setStarted] = useState(false);
  const [numPlayers, setNumPlayers] = useState(2);
  const [positions, setPositions] = useState([0,0,0,0]); // 0=home, 1-56=path, 57=win
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [winner, setWinner] = useState(null);

  useQuery({
    queryKey: ['balance'],
    queryFn: () => axios.get('/wallet/balance').then(r=>r.data),
    refetchInterval: 10000,
    onSuccess: d => setBalance(d.balance??0),
  });

  function start() {
    if (balance < bet) { toast.error('Not enough coins!'); return; }
    setBalance(b => b - bet);
    setPositions([0,0,0,0]);
    setTurn(0);
    setDice(null);
    setStarted(true);
    setWinner(null);
  }

  function roll() {
    if (rolling || winner) return;
    setRolling(true);
    let iter = 0;
    const iv = setInterval(() => {
      setDice(Math.ceil(Math.random()*6));
      iter++;
      if (iter >= 8) {
        clearInterval(iv);
        const val = Math.ceil(Math.random()*6);
        setDice(val);
        setRolling(false);
        move(val);
      }
    }, 80);
  }

  function move(val) {
    setPositions(prev => {
      const p = [...prev];
      let pos = p[turn];

      if (pos === 0) {
        if (val === 6) { pos = 1; } // start
      } else {
        pos += val;
        if (pos > 57) pos = p[turn]; // need exact
      }

      p[turn] = pos;

      // Check win
      if (pos === 57) {
        setWinner(turn);
        if (turn === 0) setBalance(b => b + bet * numPlayers * 0.9);
      } else {
        // Next turn
        const next = (turn + 1) % numPlayers;
        setTurn(next);
        
        // AI turn
        if (next !== 0 && numPlayers > 1) {
          setTimeout(() => {
            const aiRoll = Math.ceil(Math.random()*6);
            setDice(aiRoll);
            setPositions(prev2 => {
              const p2 = [...prev2];
              let pos2 = p2[next];
              if (pos2 === 0) {
                if (aiRoll === 6) pos2 = 1;
              } else {
                pos2 += aiRoll;
                if (pos2 > 57) pos2 = p2[next];
              }
              p2[next] = pos2;
              if (pos2 === 57) { setWinner(next); }
              return p2;
            });
            setTurn(0);
          }, 1000);
        }
      }
      return p;
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0f00] to-[#3d1f00] text-white flex flex-col items-center px-4 py-8">
      <button onClick={()=>navigate('/lobby')} className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={18}/> Lobby
      </button>
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black text-red-500 tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">LUDO 🎲</h1>
          <p className="text-yellow-400 font-mono font-bold mt-1">🪙 {balance.toLocaleString()}</p>
        </div>

        {!started ? (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Select Opponents</h2>
            <div className="flex gap-3 justify-center mb-6">
              {[2,3,4].map(n => (
                <button key={n} onClick={()=>setNumPlayers(n)}
                  className={`w-12 h-12 rounded-xl font-bold text-lg transition ${numPlayers===n?'bg-red-500 text-white':'bg-gray-800 text-gray-400'}`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-6 justify-center">
              {BETs.map(a => (
                <button key={a} onClick={()=>setBet(a)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold ${bet===a?'bg-red-500 text-white':'bg-gray-800 text-gray-400'}`}>
                  {a}
                </button>
              ))}
            </div>
            <button onClick={start} disabled={balance<bet}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 font-black text-xl hover:brightness-110 active:scale-95 transition shadow-lg">
              START GAME
            </button>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            {/* Simple Track view */}
            <div className="mb-6 space-y-4">
              {Array.from({length:numPlayers}).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: COLORS[i] }}>
                    {NAMES[i][0]}
                  </div>
                  <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 left-0 transition-all duration-300"
                      style={{ width: `${(positions[i]/57)*100}%`, backgroundColor: COLORS[i] }} />
                  </div>
                  <div className="w-8 text-right text-xs font-mono text-gray-400">{positions[i]}/57</div>
                </div>
              ))}
            </div>

            {winner !== null ? (
              <div className="text-center py-6">
                <h2 className="text-3xl font-black mb-2" style={{ color: COLORS[winner] }}>
                  {winner === 0 ? 'YOU WIN!' : `${NAMES[winner].toUpperCase()} WINS!`}
                </h2>
                <button onClick={()=>setStarted(false)} className="mt-4 px-6 py-2 bg-red-600 rounded-lg font-bold">Play Again</button>
              </div>
            ) : (
              <div className="text-center">
                <p className="mb-4 font-bold" style={{ color: COLORS[turn] }}>
                  {turn === 0 ? 'Your Turn' : `${NAMES[turn]}'s Turn`}
                </p>
                {turn === 0 ? (
                  <button onClick={roll} disabled={rolling}
                    className="w-full py-4 rounded-2xl bg-red-600 font-black flex items-center justify-center gap-3 active:scale-95">
                    {dice && <DiceIcon value={dice}/>}
                    {rolling ? 'ROLLING...' : 'ROLL DICE'}
                  </button>
                ) : (
                  <div className="py-4 text-gray-500 font-bold animate-pulse">Waiting for opponent...</div>
                )}
                {turn === 0 && positions[0] === 0 && <p className="text-xs text-gray-500 mt-2">Roll a 6 to start!</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
