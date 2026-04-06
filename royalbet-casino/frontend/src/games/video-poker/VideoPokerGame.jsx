import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Card helpers ──────────────────────────────────────────────────────────────
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const PAYOUTS = {
  'Royal Flush':       800,
  'Straight Flush':    50,
  'Four of a Kind':    25,
  'Full House':        9,
  'Flush':             6,
  'Straight':          4,
  'Three of a Kind':   3,
  'Two Pair':          2,
  'Jacks or Better':   1,
};

function mkDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
  d.sort(() => Math.random() - 0.5);
  return d;
}

function rankVal(r) { return RANKS.indexOf(r); }

function evaluate(hand) {
  const ranks = hand.map(c => c.rank);
  const suits = hand.map(c => c.suit);
  const vals  = ranks.map(rankVal).sort((a,b)=>a-b);
  const isFlush  = new Set(suits).size === 1;
  const isStraight = vals[4]-vals[0]===4 && new Set(vals).size===5;
  const isRoyal  = isStraight && vals[0]===8; // 10 J Q K A
  const groups   = {};
  vals.forEach(v => groups[v] = (groups[v]||0)+1);
  const counts   = Object.values(groups).sort((a,b)=>b-a);

  if (isFlush && isRoyal)     return 'Royal Flush';
  if (isFlush && isStraight)  return 'Straight Flush';
  if (counts[0]===4)          return 'Four of a Kind';
  if (counts[0]===3&&counts[1]===2) return 'Full House';
  if (isFlush)                return 'Flush';
  if (isStraight)             return 'Straight';
  if (counts[0]===3)          return 'Three of a Kind';
  if (counts[0]===2&&counts[1]===2) return 'Two Pair';
  // Jacks or better: pair of J Q K A
  if (counts[0]===2) {
    const pair = parseInt(Object.keys(groups).find(k=>groups[k]===2));
    if (pair >= 9) return 'Jacks or Better'; // J=9,Q=10,K=11,A=12
  }
  return null;
}

function suitColor(s) { return s==='♥'||s==='♦' ? 'text-red-400' : 'text-white'; }

const BET_AMOUNTS = [5,10,25,50,100];

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoPokerGame() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bet, setBet] = useState(10);
  const [phase, setPhase] = useState('idle'); // idle | deal | draw
  const [deck, setDeck] = useState([]);
  const [hand, setHand] = useState([]);
  const [held, setHeld] = useState([false,false,false,false,false]);
  const [result, setResult] = useState(null);
  const [balance, setBalance] = useState(0);

  const { data: bal } = useQuery({
    queryKey: ['balance'],
    queryFn: () => axios.get('/wallet/balance').then(r=>r.data),
    refetchInterval: 10000,
    onSuccess: d => setBalance(d.balance ?? 0),
  });
  useCallback(() => { if (bal) setBalance(bal.balance??0); }, [bal]);

  // We compute everything client-side for Video Poker (no backend needed for logic)
  function dealHand() {
    if (balance < bet) { toast.error('Not enough coins!'); return; }
    const d = mkDeck();
    const h = d.slice(0,5);
    setDeck(d.slice(5));
    setHand(h);
    setHeld([false,false,false,false,false]);
    setResult(null);
    setPhase('deal');
    // Deduct bet locally (optimistic)
    setBalance(b => b - bet);
  }

  function drawCards() {
    const newHand = hand.map((c,i) => held[i] ? c : deck.shift());
    setHand([...newHand]);
    const handName = evaluate(newHand);
    const multi = handName ? PAYOUTS[handName] ?? 0 : 0;
    const payout = bet * multi;
    setBalance(b => b + payout);
    setResult({ handName, multi, payout });
    setPhase('idle');
  }

  const toggleHeld = (i) => {
    if (phase !== 'deal') return;
    setHeld(h => { const n=[...h]; n[i]=!n[i]; return n; });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001a00] to-[#002600] text-white flex flex-col items-center px-4 py-8">
      <button onClick={() => navigate('/lobby')} className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={18}/> Lobby
      </button>

      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black text-green-400 tracking-widest">VIDEO POKER 🃏</h1>
          <p className="text-gray-400 text-sm mt-1">Jacks or Better · 5-Card Draw</p>
          <p className="text-yellow-400 font-mono font-bold mt-1">Balance: 🪙 {balance.toLocaleString()}</p>
        </div>

        {/* Payout table */}
        <div className="bg-black/50 border border-green-700/40 rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {Object.entries(PAYOUTS).map(([hand, mul]) => (
              <div key={hand} className={`flex justify-between ${result?.handName===hand?'text-yellow-400 font-bold':'text-gray-400'}`}>
                <span>{hand}</span><span>{mul}×</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="flex gap-3 justify-center mb-4">
          {(hand.length ? hand : Array(5).fill(null)).map((card, i) => (
            <div key={i} onClick={() => toggleHeld(i)}
              className={`relative cursor-pointer transition-all active:scale-95 ${held[i]?'translate-y-[-10px]':''}`}>
              <div className={`w-16 h-24 rounded-xl border-2 flex flex-col items-center justify-center text-2xl font-black shadow-lg transition-all ${
                held[i] ? 'border-yellow-400 bg-yellow-400/10' : 'border-gray-600 bg-gray-900'
              } ${!card ? 'border-dashed' : ''}`}>
                {card ? (
                  <>
                    <span className={`text-xs font-bold leading-none ${suitColor(card.suit)}`}>{card.rank}</span>
                    <span className={`text-xl ${suitColor(card.suit)}`}>{card.suit}</span>
                  </>
                ) : <span className="text-gray-700">🂠</span>}
              </div>
              {held[i] && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-yellow-400 bg-yellow-400/20 px-1.5 py-0.5 rounded">
                  HELD
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Result */}
        {result && (
          <div className={`text-center py-3 rounded-xl mb-4 font-bold text-lg ${result.payout>0?'bg-yellow-400/10 border border-yellow-400/50 text-yellow-300':'bg-gray-900 text-gray-400'}`}>
            {result.handName ? `${result.handName} → +${result.payout.toLocaleString()} 🪙` : 'No winning hand'}
          </div>
        )}

        {/* Bet selector */}
        <div className="flex gap-2 mb-4 justify-center">
          {BET_AMOUNTS.map(a => (
            <button key={a} onClick={() => setBet(a)} disabled={phase==='deal'}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition ${bet===a?'bg-green-500 text-black':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {a}
            </button>
          ))}
        </div>

        {/* Action button */}
        {phase === 'idle' && (
          <button onClick={dealHand} disabled={balance < bet}
            className="w-full py-4 rounded-2xl bg-gradient-to-b from-green-500 to-green-700 text-black font-black text-2xl shadow-[0_4px_0_#14532d] hover:brightness-110 active:scale-95 transition">
            DEAL 🃏
          </button>
        )}
        {phase === 'deal' && (
          <button onClick={drawCards}
            className="w-full py-4 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-white font-black text-2xl shadow-[0_4px_0_#1e3a8a] hover:brightness-110 active:scale-95 transition">
            DRAW →
          </button>
        )}
      </div>
    </div>
  );
}
