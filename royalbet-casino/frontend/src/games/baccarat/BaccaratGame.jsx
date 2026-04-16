import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCoins } from '../../hooks/useCoins';

function cardVal(rank) {
  if (['10', 'J', 'Q', 'K'].includes(rank)) return 0;
  if (rank === 'A') return 1;
  return parseInt(rank);
}
function handTotal(cards) {
  return cards.reduce((s, c) => s + cardVal(c.rank), 0) % 10;
}

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];

function mkDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
  d.sort(() => Math.random() - 0.5);
  return d;
}

function suitColor(s) { return s === '♥' || s === '♦' ? 'text-red-400' : 'text-gray-100'; }

function Card({ card, hidden }) {
  return (
    <div className={`w-14 h-20 rounded-xl border-2 flex flex-col items-center justify-center font-black shadow-lg transition-all
      ${hidden ? 'border-gray-700 bg-gray-900 border-dashed' : 'border-gray-500 bg-gray-900'}`}>
      {hidden ? <span className="text-gray-700 text-2xl">🂠</span> : (
        <>
          <span className={`text-xs leading-none ${suitColor(card.suit)}`}>{card.rank}</span>
          <span className={`text-xl ${suitColor(card.suit)}`}>{card.suit}</span>
        </>
      )}
    </div>
  );
}

const BETs = [10, 25, 50, 100, 250];
const sides = [
  { id: 'player', label: 'PLAYER', odds: '1:1',    color: 'from-blue-700 to-blue-900' },
  { id: 'banker', label: 'BANKER', odds: '0.95:1', color: 'from-red-700 to-red-900' },
  { id: 'tie',    label: 'TIE',    odds: '8:1',    color: 'from-green-700 to-green-900' },
];

export default function BaccaratGame() {
  const { balance, spend, earn } = useCoins();
  const [bet, setBet] = useState(25);
  const [betSide, setBetSide] = useState('player');
  const [phase, setPhase] = useState('idle');
  const [playerCards, setPlayerCards] = useState([]);
  const [bankerCards, setBankerCards] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  async function deal() {
    if (balance < bet) { toast.error('Not enough coins!'); return; }
    const ok = await spend(bet, 'BACCARAT');
    if (!ok) return;

    setPhase('playing');
    setResult(null);
    setPlayerCards([]);
    setBankerCards([]);

    const deck = mkDeck();
    const pCards = [deck[0], deck[2]];
    const bCards = [deck[1], deck[3]];
    let idx = 4;

    const p = handTotal(pCards);
    const b = handTotal(bCards);

    if (p >= 8 || b >= 8) {
      setTimeout(() => resolve(pCards, bCards), 600);
      return;
    }
    if (p <= 5) pCards.push(deck[idx++]);
    if (b <= 5) bCards.push(deck[idx]);
    setTimeout(() => resolve(pCards, bCards), 600);
  }

  async function resolve(pCards, bCards) {
    setPlayerCards(pCards);
    setBankerCards(bCards);
    const p = handTotal(pCards);
    const b = handTotal(bCards);
    const winner = p > b ? 'player' : b > p ? 'banker' : 'tie';

    let payout = 0;
    if (betSide === winner) {
      if (winner === 'tie')    payout = bet * 8;
      else if (winner === 'banker') payout = bet * 1.95;
      else payout = bet * 2;
    }
    if (payout > 0) await earn(payout, 'BACCARAT');
    const res = { winner, p, b, payout };
    setResult(res);
    setHistory(h => [{ winner, payout: payout > 0 }, ...h].slice(0, 10));
    setPhase('idle');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0010] to-[#1a0028] text-white flex flex-col items-center px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <Link to="/lobby" className="flex items-center gap-2 text-gray-400 hover:text-white">
          <ArrowLeft size={18}/> Lobby
        </Link>
        <h1 className="text-3xl font-black text-purple-400 tracking-widest">BACCARAT 🎴</h1>
        <div className="font-mono text-yellow-400 font-bold text-sm bg-black/30 px-3 py-1 rounded-full">
          🪙 {balance.toLocaleString()}
        </div>
      </div>

      <div className="w-full max-w-lg">
        {/* History */}
        {history.length > 0 && (
          <div className="flex gap-1.5 mb-4 justify-center flex-wrap">
            {history.map((h, i) => (
              <span key={i} className={`text-xs font-bold px-2 py-1 rounded border ${
                h.winner === 'player' ? 'bg-blue-900 text-blue-300 border-blue-700'
                : h.winner === 'banker' ? 'bg-red-900 text-red-300 border-red-700'
                : 'bg-green-900 text-green-300 border-green-700'
              } ${h.payout ? 'ring-1 ring-yellow-400/50' : ''}`}>
                {h.winner === 'player' ? 'P' : h.winner === 'banker' ? 'B' : 'T'}
              </span>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-gradient-to-b from-[#1a4a1a] to-[#0d2d0d] border border-green-700/40 rounded-3xl p-6 mb-6 shadow-xl">
          {/* Banker */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-400 font-bold text-sm uppercase tracking-widest">Banker</span>
              {result && <span className="font-mono text-xl text-red-300 font-bold">{result.b}</span>}
            </div>
            <div className="flex gap-2">
              {bankerCards.length ? bankerCards.map((c, i) => <Card key={i} card={c}/>) : [0,1].map(i => <Card key={i} hidden/>)}
            </div>
          </div>
          <div className="border-t border-green-700/30 my-4"/>
          {/* Player */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-400 font-bold text-sm uppercase tracking-widest">Player</span>
              {result && <span className="font-mono text-xl text-blue-300 font-bold">{result.p}</span>}
            </div>
            <div className="flex gap-2">
              {playerCards.length ? playerCards.map((c, i) => <Card key={i} card={c}/>) : [0,1].map(i => <Card key={i} hidden/>)}
            </div>
          </div>
        </div>

        {/* Result banner */}
        {result && (
          <div className={`text-center py-3 rounded-xl mb-4 font-bold text-lg border ${
            result.payout > 0 ? 'bg-yellow-400/10 border-yellow-400/50 text-yellow-300' : 'bg-gray-900/60 border-gray-700 text-gray-400'
          }`}>
            {result.winner.toUpperCase()} WINS! {result.payout > 0 ? `+${result.payout.toLocaleString()} 🪙` : 'Better luck!'}
          </div>
        )}

        {/* Bet side */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {sides.map(s => (
            <button key={s.id} onClick={() => setBetSide(s.id)} disabled={phase === 'playing'}
              className={`py-3 rounded-xl font-bold text-center transition border-2 ${
                betSide === s.id ? `bg-gradient-to-b ${s.color} border-white/20 scale-105` : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              <div className="text-sm">{s.label}</div>
              <div className="text-xs text-gray-300 mt-0.5">{s.odds}</div>
            </button>
          ))}
        </div>

        {/* Bet amount */}
        <div className="flex gap-2 mb-4">
          {BETs.map(a => (
            <button key={a} onClick={() => setBet(a)} disabled={phase === 'playing'}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${bet === a ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {a}
            </button>
          ))}
        </div>

        <button onClick={deal} disabled={phase === 'playing' || balance < bet}
          className={`w-full py-4 rounded-2xl font-black text-2xl transition active:scale-95 ${
            phase === 'playing' ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : balance < bet ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-b from-purple-500 to-purple-700 text-white shadow-[0_4px_0_#581c87] hover:brightness-110'
          }`}>
          {phase === 'playing' ? '⏳ Dealing…' : 'DEAL 🎴'}
        </button>
      </div>
    </div>
  );
}
