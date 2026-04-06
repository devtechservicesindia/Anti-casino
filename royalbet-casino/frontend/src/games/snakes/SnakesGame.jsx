import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import toast from 'react-hot-toast';

const BOARD_SIZE = 10;
const SNAKES = { 97:78,95:75,88:20,72:51,56:6,53:33,42:11,31:9 };
const LADDERS= { 3:21,8:30,28:84,50:67,57:76,60:78,71:92,80:99 };

function DiceIcon({ value }) {
  const icons = [null, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
  const Icon = icons[value];
  return Icon ? <Icon size={40} className="text-white" /> : null;
}

function getCell(pos) {
  if (pos < 1 || pos > 100) return { row: -1, col: -1 };
  const idx = pos - 1;
  const row = Math.floor(idx / BOARD_SIZE);
  const rawCol = idx % BOARD_SIZE;
  const col = row % 2 === 0 ? rawCol : BOARD_SIZE - 1 - rawCol;
  return { row: BOARD_SIZE - 1 - row, col };
}

const COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b'];
const PAWN = ['🔴','🔵','🟢','🟡'];

export default function SnakesGame() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(25);
  const [started, setStarted] = useState(false);
  const [positions, setPositions] = useState([0, 0, 0, 0]); // 0 = not started
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceVal, setDiceVal] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [lastMove, setLastMove] = useState('');
  const [winner, setWinner] = useState(null);
  const [numPlayers, setNumPlayers] = useState(2);

  useQuery({
    queryKey: ['balance'],
    queryFn: () => axios.get('/wallet/balance').then(r=>r.data),
    refetchInterval:10000,
    onSuccess: d=>setBalance(d.balance??0),
  });

  const BETs = [10,25,50,100];

  function startGame() {
    if (balance < bet) { toast.error('Not enough coins!'); return; }
    setBalance(b=>b-bet);
    setPositions(Array(numPlayers).fill(0));
    setCurrentPlayer(0);
    setDiceVal(null);
    setLastMove('');
    setWinner(null);
    setStarted(true);
  }

  function rollDice() {
    if (rolling || winner) return;
    setRolling(true);
    let iter = 0;
    const iv = setInterval(() => {
      setDiceVal(Math.ceil(Math.random() * 6));
      iter++;
      if (iter >= 8) {
        clearInterval(iv);
        const val = Math.ceil(Math.random() * 6);
        setDiceVal(val);
        setRolling(false);
        movePlayer(val);
      }
    }, 80);
  }

  function movePlayer(dice) {
    setPositions(prev => {
      const newPos = [...prev];
      let pos = prev[currentPlayer] + dice;
      let msg = `${PAWN[currentPlayer]} rolled ${dice}`;

      if (pos > 100) { pos = prev[currentPlayer]; msg += ' (can\'t move — need exact!)'; }
      else if (SNAKES[pos]) { const to=SNAKES[pos]; msg += ` → 🐍 Snake! ${pos}→${to}`; pos=to; }
      else if (LADDERS[pos]) { const to=LADDERS[pos]; msg += ` → 🪜 Ladder! ${pos}→${to}`; pos=to; }

      newPos[currentPlayer] = pos;
      setLastMove(msg);

      if (pos >= 100) {
        const prize = bet * numPlayers * 0.9;
        setBalance(b=>b+prize);
        setWinner(currentPlayer);
        toast.success(`${PAWN[currentPlayer]} wins! +${prize.toLocaleString()} 🪙`);
      } else {
        // AI players auto-roll (for single-human vs AI experience)
        const nextP = (currentPlayer + 1) % numPlayers;
        setCurrentPlayer(nextP);
        if (nextP !== 0 && numPlayers > 1) {
          // AI turn after short delay
          setTimeout(() => {
            const aiDice = Math.ceil(Math.random()*6);
            setDiceVal(aiDice);
            setPositions(p2 => {
              const np=[...p2];
              let ap=p2[nextP]+aiDice;
              if(ap>100) ap=p2[nextP];
              else if(SNAKES[ap]) ap=SNAKES[ap];
              else if(LADDERS[ap]) ap=LADDERS[ap];
              np[nextP]=ap;
              if(ap>=100){ setWinner(nextP); setBalance(b=>b+0); }
              return np;
            });
            setCurrentPlayer(0);
          }, 1000);
        }
      }
      return newPos;
    });
  }

  // Board cells: 100 down to 1
  const cells = Array.from({length:100},(_,i)=>100-i);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a00] to-[#2d1a00] text-white flex flex-col items-center px-4 py-8">
      <button onClick={()=>navigate('/lobby')} className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={18}/> Lobby
      </button>
      <div className="w-full max-w-xl">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-black text-orange-400 tracking-widest">SNAKES & LADDERS 🐍</h1>
          <p className="text-yellow-400 font-mono font-bold mt-1">🪙 {balance.toLocaleString()}</p>
        </div>

        {!started ? (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center">
            <p className="text-gray-400 mb-4">Players</p>
            <div className="flex gap-3 justify-center mb-6">
              {[2,3,4].map(n=>(
                <button key={n} onClick={()=>setNumPlayers(n)}
                  className={`w-12 h-12 rounded-xl font-bold text-lg transition ${numPlayers===n?'bg-orange-500 text-black':'bg-gray-800 text-gray-300'}`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4 justify-center">
              {BETs.map(a=>(
                <button key={a} onClick={()=>setBet(a)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold ${bet===a?'bg-orange-500 text-black':'bg-gray-800 text-gray-300'}`}>
                  {a}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mb-4">Entry: {bet} coins · Winner takes {bet*numPlayers*0.9}</p>
            <button onClick={startGame} disabled={balance<bet}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-orange-500 to-orange-700 text-black font-black text-xl hover:brightness-110 active:scale-95 transition">
              START GAME 🎲
            </button>
          </div>
        ) : (
          <>
            {/* Board */}
            <div className="bg-amber-950 border-4 border-amber-700 rounded-2xl p-2 mb-4 overflow-hidden">
              <div className="grid gap-0.5" style={{gridTemplateColumns:`repeat(${BOARD_SIZE}, 1fr)`}}>
                {Array.from({length:BOARD_SIZE},(_,row)=>
                  Array.from({length:BOARD_SIZE},(_,col)=>{
                    const r=row,c=col;
                    // Row 0 = top, numbers go right on even rows, left on odd rows (bottom-up)
                    const rowFromBottom=BOARD_SIZE-1-r;
                    const cellNum = rowFromBottom%2===0 ? rowFromBottom*BOARD_SIZE+c+1 : rowFromBottom*BOARD_SIZE+(BOARD_SIZE-c);
                    const isSnakeHead = Object.keys(SNAKES).includes(String(cellNum));
                    const isLadderBase = Object.keys(LADDERS).includes(String(cellNum));
                    const pawnsHere = positions.map((p,i)=>p===cellNum?PAWN[i]:null).filter(Boolean);
                    const isLight = (rowFromBottom+c)%2===0;
                    return (
                      <div key={`${r}-${c}`}
                        className={`relative aspect-square flex flex-col items-center justify-center text-[8px] font-bold rounded-sm ${isLight?'bg-amber-100':'bg-amber-200'}`}>
                        <span className="text-amber-900/50 leading-none">{cellNum}</span>
                        {isSnakeHead && <span className="text-[10px]">🐍</span>}
                        {isLadderBase && <span className="text-[10px]">🪜</span>}
                        {pawnsHere.map((p,i)=>(
                          <span key={i} className="text-[12px] leading-none">{p}</span>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Status */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                {positions.slice(0,numPlayers).map((pos,i)=>(
                  <div key={i} className={`text-center ${i===currentPlayer?'opacity-100':'opacity-50'}`}>
                    <div className="text-2xl">{PAWN[i]}</div>
                    <div className="text-xs text-gray-400">Cell {pos||'Start'}</div>
                  </div>
                ))}
              </div>
              {lastMove && <p className="text-xs text-center text-yellow-300 mt-1">{lastMove}</p>}
            </div>

            {winner !== null ? (
              <div className="text-center">
                <div className="text-5xl mb-2">{PAWN[winner]}</div>
                <h2 className="text-2xl font-black text-yellow-400 mb-4">{winner===0?'YOU WIN!':'AI WINS!'} 🎉</h2>
                <button onClick={()=>setStarted(false)} className="w-full py-3 rounded-xl bg-orange-500 text-black font-black text-xl">
                  Play Again
                </button>
              </div>
            ) : currentPlayer===0 ? (
              <button onClick={rollDice} disabled={rolling}
                className="w-full py-4 rounded-2xl bg-gradient-to-b from-orange-500 to-orange-700 text-black font-black text-2xl flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition">
                {diceVal ? <DiceIcon value={diceVal}/> : null}
                {rolling ? 'Rolling…' : 'ROLL DICE 🎲'}
              </button>
            ) : (
              <div className="text-center py-4 text-gray-400 font-bold animate-pulse">AI is rolling…</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
