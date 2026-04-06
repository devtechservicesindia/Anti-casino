import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
function rankVal(r) {
  if (r==='A') return 14;
  if (r==='K') return 13;
  if (r==='Q') return 12;
  if (r==='J') return 11;
  return parseInt(r);
}
function suitColor(s) { return s==='♥'||s==='♦'?'text-red-400':'text-white'; }

function mkDeck() {
  const d=[];
  for(const s of SUITS) for(const r of RANKS) d.push({rank:r,suit:s});
  d.sort(()=>Math.random()-0.5);
  return d;
}

function evaluate3(hand) {
  const vals = hand.map(c=>rankVal(c.rank)).sort((a,b)=>b-a);
  const suits = hand.map(c=>c.suit);
  const flush = new Set(suits).size===1;
  const straight = vals[0]-vals[2]===2 && new Set(vals).size===3;
  const pairs = {};
  vals.forEach(v=>pairs[v]=(pairs[v]||0)+1);
  const counts = Object.values(pairs).sort((a,b)=>b-a);

  if (flush && straight) return { name:'Straight Flush', rank:5 };
  if (counts[0]===3)    return { name:'Three of a Kind', rank:4 };
  if (flush)            return { name:'Flush', rank:3 };
  if (straight)         return { name:'Straight', rank:2 };
  if (counts[0]===2)    return { name:'Pair', rank:1 };
  return { name:'High Card', rank:0, high: vals[0] };
}

// Dealer qualifies with Q-high or better
function dealerQualifies(ev) { return ev.rank >= 1 || (ev.rank===0 && ev.high>=12); }

// Ante/Play payouts
const ANTE_PAYOUTS = { 'Straight Flush':5, 'Three of a Kind':4, 'Straight':1 };
const PAIR_BONUS   = { 'Straight Flush':40,'Three of a Kind':30,'Straight':6,'Flush':3,'Pair':1 };

function Card({card}) {
  return (
    <div className="w-14 h-20 rounded-xl border-2 border-gray-500 bg-gray-900 flex flex-col items-center justify-center font-black shadow-lg">
      <span className={`text-xs leading-none ${suitColor(card.suit)}`}>{card.rank}</span>
      <span className={`text-xl ${suitColor(card.suit)}`}>{card.suit}</span>
    </div>
  );
}
function HiddenCard() {
  return <div className="w-14 h-20 rounded-xl border-2 border-gray-700 bg-gray-900 flex items-center justify-center border-dashed"><span className="text-gray-700 text-2xl">🂠</span></div>;
}

const BETs=[10,25,50,100,250];

export default function ThreeCardPokerGame() {
  const navigate = useNavigate();
  const [balance,setBalance]=useState(0);
  const [bet,setBet]=useState(25);
  const [pairBonus,setPairBonus]=useState(false);
  const [phase,setPhase]=useState('idle'); // idle|deal|result
  const [playerHand,setPlayerHand]=useState([]);
  const [dealerHand,setDealerHand]=useState([]);
  const [showDealer,setShowDealer]=useState(false);
  const [result,setResult]=useState(null);

  useQuery({
    queryKey:['balance'],
    queryFn:()=>axios.get('/wallet/balance').then(r=>r.data),
    refetchInterval:10000,
    onSuccess:d=>setBalance(d.balance??0),
  });

  function deal() {
    const cost = bet + (pairBonus?Math.ceil(bet/2):0);
    if(balance<cost){toast.error('Not enough coins!');return;}
    setBalance(b=>b-cost);
    const deck=mkDeck();
    setPlayerHand(deck.slice(0,3));
    setDealerHand(deck.slice(3,6));
    setShowDealer(false);
    setResult(null);
    setPhase('deal');
  }

  function fold() {
    setShowDealer(true);
    setResult({ outcome:'Fold', payout:0, extra: pairBonus?evalPairBonus():'None' });
    setPhase('result');
  }

  function play() {
    setShowDealer(true);
    const pEv = evaluate3(playerHand);
    const dEv = evaluate3(dealerHand);
    const qualifies = dealerQualifies(dEv);

    let payout = 0;
    let outcome = '';

    if(!qualifies) {
      // Ante wins 1:1, play pushes
      payout += bet; // ante win
      outcome = "Dealer doesn't qualify — Ante pays!";
    } else {
      // Compare
      if(pEv.rank > dEv.rank || (pEv.rank===dEv.rank && Math.max(...playerHand.map(c=>rankVal(c.rank))) > Math.max(...dealerHand.map(c=>rankVal(c.rank))))) {
        payout += bet * 2 + (ANTE_PAYOUTS[pEv.name]||0)*bet;
        outcome = `Player wins! ${pEv.name}`;
      } else if(pEv.rank===dEv.rank) {
        payout += bet; // push on tie
        outcome = 'Push — tie!';
      } else {
        payout = 0;
        outcome = `Dealer wins with ${dEv.name}`;
      }
    }

    // Pair bonus
    if(pairBonus) {
      const pb = PAIR_BONUS[pEv.name]||0;
      const pbCost = Math.ceil(bet/2);
      if(pb>0) { payout += pbCost*pb; outcome += ` · Pair+ ${pb}×`; }
    }

    setBalance(b=>b+payout);
    setResult({ outcome, payout });
    setPhase('result');
  }

  function evalPairBonus(){
    const pEv=evaluate3(playerHand);
    return PAIR_BONUS[pEv.name]?`${pEv.name} ${PAIR_BONUS[pEv.name]}×`:'No bonus';
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001a00] to-[#002600] text-white flex flex-col items-center px-4 py-8">
      <button onClick={()=>navigate('/lobby')} className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={18}/> Lobby
      </button>
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black text-emerald-400 tracking-widest">3-CARD POKER ♠</h1>
          <p className="text-gray-400 text-sm mt-1">Classic USA casino table game</p>
          <p className="text-yellow-400 font-mono font-bold mt-1">🪙 {balance.toLocaleString()}</p>
        </div>

        {/* Table */}
        <div className="bg-gradient-to-b from-[#1a4a1a] to-[#0d2d0d] border border-green-700/40 rounded-3xl p-6 mb-6">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Dealer</p>
          <div className="flex gap-2 mb-6">
            {dealerHand.length ? dealerHand.map((c,i)=>(
              showDealer ? <Card key={i} card={c}/> : <HiddenCard key={i}/>
            )) : [0,1,2].map(i=><HiddenCard key={i}/>)}
          </div>

          <div className="border-t border-green-700/30 mb-4"/>

          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">You</p>
          <div className="flex gap-2">
            {playerHand.length ? playerHand.map((c,i)=><Card key={i} card={c}/>) : [0,1,2].map(i=><HiddenCard key={i}/>)}
          </div>
          {playerHand.length > 0 && (
            <p className="text-sm text-yellow-400 mt-2 font-bold">{evaluate3(playerHand).name}</p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className={`text-center py-3 rounded-xl mb-4 font-bold text-base border ${result.payout>0?'bg-yellow-400/10 border-yellow-400/50 text-yellow-300':'bg-gray-900/60 border-gray-700 text-gray-400'}`}>
            {result.outcome}{result.payout>0?` → +${result.payout.toLocaleString()} 🪙`:''}
          </div>
        )}

        {/* Pair+ toggle */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-900 rounded-xl border border-gray-700">
          <button onClick={()=>setPairBonus(p=>!p)} disabled={phase==='deal'}
            className={`w-10 h-6 rounded-full transition-colors ${pairBonus?'bg-green-500':'bg-gray-700'}`}>
            <div className={`w-4 h-4 rounded-full bg-white ml-1 transition-transform ${pairBonus?'translate-x-4':''}`}/>
          </button>
          <span className="text-sm text-gray-300">Pair+ Side Bet <span className="text-gray-500">(+{Math.ceil(bet/2)} coins)</span></span>
        </div>

        {/* Bet */}
        <div className="flex gap-2 mb-4">
          {BETs.map(a=>(
            <button key={a} onClick={()=>setBet(a)} disabled={phase==='deal'}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${bet===a?'bg-emerald-500 text-black':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {a}
            </button>
          ))}
        </div>

        {phase==='idle' && (
          <button onClick={deal} disabled={balance<bet}
            className="w-full py-4 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 text-black font-black text-2xl shadow-[0_4px_0_#14532d] hover:brightness-110 active:scale-95 transition">
            ANTE & DEAL ♠
          </button>
        )}

        {phase==='deal' && (
          <div className="flex gap-3">
            <button onClick={fold}
              className="flex-1 py-4 rounded-2xl bg-red-900 text-red-300 font-black text-xl hover:bg-red-800 active:scale-95 transition">
              FOLD ❌
            </button>
            <button onClick={play}
              className="flex-[2] py-4 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 text-black font-black text-xl shadow-[0_4px_0_#14532d] hover:brightness-110 active:scale-95 transition">
              PLAY →
            </button>
          </div>
        )}

        {phase==='result' && (
          <button onClick={()=>setPhase('idle')}
            className="w-full py-4 rounded-2xl bg-gray-800 text-gray-300 font-black text-xl hover:bg-gray-700 active:scale-95 transition">
            🔄 New Round
          </button>
        )}
      </div>
    </div>
  );
}
