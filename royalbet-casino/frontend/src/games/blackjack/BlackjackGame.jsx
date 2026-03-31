import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../store/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────────────────────
const BET_PRESETS = [10, 25, 50, 100, 250, 500];
const CARD_BACK   = '🂠';

const SUIT_SYMBOLS = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
const SUIT_COLORS  = { '♠': '#e2e8f0', '♥': '#ef4444', '♦': '#ef4444', '♣': '#e2e8f0' };

// ─── Card Display ─────────────────────────────────────────────────────────────
function Card({ card, faceDown = false, index = 0, flipping = false }) {
  const isHidden = faceDown || card.rank === '?';
  return (
    <div
      className="card-container"
      style={{
        animation: `cardSlideIn 0.4s ease-out ${index * 0.15}s both`,
      }}
    >
      <div className={`card-inner ${flipping ? 'card-flip' : ''}`}>
        {isHidden ? (
          <div className="card card-back">
            <div className="card-back-pattern" />
          </div>
        ) : (
          <div className="card card-front" style={{ color: SUIT_COLORS[card.suit] || '#e2e8f0' }}>
            <div className="card-corner top-left">
              <span className="card-rank">{card.rank}</span>
              <span className="card-suit">{SUIT_SYMBOLS[card.suit] || card.suit}</span>
            </div>
            <div className="card-center-suit">{SUIT_SYMBOLS[card.suit] || card.suit}</div>
            <div className="card-corner bottom-right">
              <span className="card-rank">{card.rank}</span>
              <span className="card-suit">{SUIT_SYMBOLS[card.suit] || card.suit}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hand Display ─────────────────────────────────────────────────────────────
function HandDisplay({ hand, label, total, isActive, hideSecond = false, flippingSecond = false }) {
  return (
    <div className={`hand-area ${isActive ? 'hand-active' : ''}`}>
      <div className="hand-label">
        <span>{label}</span>
        {total !== undefined && total !== null && (
          <span className="hand-total">{total}</span>
        )}
      </div>
      <div className="hand-cards">
        {hand.map((card, i) => (
          <Card
            key={i}
            card={card}
            faceDown={hideSecond && i === 1}
            index={i}
            flipping={flippingSecond && i === 1}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BlackjackGame() {
  const { user }    = useAuth();
  const queryClient = useQueryClient();

  // State
  const [balance, setBalance]     = useState(0);
  const [betAmount, setBetAmount] = useState(50);
  const [gameState, setGameState] = useState(null);  // full server state
  const [message, setMessage]     = useState('');
  const [msgType, setMsgType]     = useState('');     // 'win' | 'loss' | 'push' | 'blackjack' | 'bust'
  const [showOverlay, setShowOverlay] = useState(false);
  const [dealerFlipping, setDealerFlipping] = useState(false);
  const [confetti, setConfetti]   = useState(false);

  // Balance query
  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => (await axios.get('/wallet/balance')).data,
  });
  useEffect(() => { if (balanceData) setBalance(balanceData.balance); }, [balanceData]);

  // Fetch existing session on mount
  useEffect(() => {
    axios.get('/games/blackjack/state')
      .then(res => {
        if (res.data && res.data.phase && res.data.phase !== 'BETTING') {
          setGameState(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Derived state
  const phase        = gameState?.phase || 'BETTING';
  const playerHands  = gameState?.playerHands || [];
  const dealerHand   = gameState?.dealerHand || [];
  const activeHand   = gameState?.activeHandIndex ?? 0;
  const outcomes     = gameState?.outcomes || [];
  const isSplit      = gameState?.isSplit || false;
  const isPlayerTurn = phase === 'PLAYER_TURN';

  // Can the player split?
  const canSplitNow = isPlayerTurn
    && !isSplit
    && playerHands[activeHand]?.length === 2
    && playerHands[activeHand]?.[0]?.rank !== '?'
    && getCardValue(playerHands[activeHand]?.[0]) === getCardValue(playerHands[activeHand]?.[1]);

  // Can the player double?
  const canDoubleNow = isPlayerTurn
    && playerHands[activeHand]?.length === 2;

  // ─── Mutations ──────────────────────────────────────────────────────────
  const startMutation = useMutation({
    mutationFn: async (bet) => (await axios.post('/games/blackjack/start', { betAmount: bet })).data,
    onSuccess: (data) => handleResponse(data),
    onError: (err) => setMessage(err.response?.data?.error || 'Failed to start'),
  });

  const actionMutation = useMutation({
    mutationFn: async (action) => (await axios.post(`/games/blackjack/${action}`)).data,
    onSuccess: (data) => handleResponse(data),
    onError: (err) => setMessage(err.response?.data?.error || 'Action failed'),
  });

  // ─── Handle API Response ────────────────────────────────────────────────
  const handleResponse = useCallback((data) => {
    // If transitioning to resolved AND dealer was hidden, trigger flip
    if (data.phase === 'RESOLVED' && gameState?.phase === 'PLAYER_TURN') {
      setDealerFlipping(true);
      setTimeout(() => setDealerFlipping(false), 600);
    }

    setGameState(data);

    if (data.phase === 'RESOLVED') {
      if (data.finalBalance !== undefined) {
        setBalance(data.finalBalance);
      }
      queryClient.invalidateQueries(['balance']);

      // Determine outcome message
      const o = data.outcomes;
      if (o && o.length > 0) {
        const primary = o[0];
        if (o.some(r => r.outcome === 'BLACKJACK')) {
          setMessage('BLACKJACK! 🂡');
          setMsgType('blackjack');
          setConfetti(true);
          setTimeout(() => setConfetti(false), 3000);
        } else if (o.every(r => r.outcome === 'BUST')) {
          setMessage('BUST! 💥');
          setMsgType('bust');
          setShowOverlay(true);
          setTimeout(() => setShowOverlay(false), 1500);
        } else if (o.every(r => r.outcome === 'LOSS')) {
          setMessage('Dealer wins');
          setMsgType('loss');
        } else if (o.every(r => r.outcome === 'PUSH')) {
          setMessage('Push — bet returned');
          setMsgType('push');
        } else if (o.some(r => r.outcome === 'WIN' || r.outcome === 'BLACKJACK')) {
          const totalWin = data.totalPayout;
          setMessage(`You win +${totalWin?.toLocaleString()} tokens! 🎉`);
          setMsgType('win');
        } else {
          // mixed outcomes
          const totalWin = data.totalPayout;
          setMessage(totalWin > 0 ? `Payout: ${totalWin.toLocaleString()} tokens` : 'Dealer wins');
          setMsgType(totalWin > 0 ? 'win' : 'loss');
        }
      }
    } else {
      setMessage('');
      setMsgType('');
    }
  }, [gameState, queryClient]);

  // ─── Actions ────────────────────────────────────────────────────────────
  const startGame = () => {
    if (betAmount > balance || betAmount < 10) return;
    setMessage('');
    setMsgType('');
    setShowOverlay(false);
    setConfetti(false);
    startMutation.mutate(betAmount);
  };

  const doAction = (action) => {
    if (actionMutation.isPending) return;
    actionMutation.mutate(action);
  };

  const newRound = () => {
    setGameState(null);
    setMessage('');
    setMsgType('');
    queryClient.invalidateQueries(['balance']);
  };

  // ─── Helper: calculate display total ────────────────────────────────────
  function calcTotal(hand) {
    if (!hand || hand.length === 0) return null;
    if (hand.some(c => c.rank === '?')) return '?';
    let total = 0, aces = 0;
    for (const c of hand) {
      total += getCardValue(c);
      if (c.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="bj-page">
      {/* Bust overlay */}
      {showOverlay && <div className="bust-overlay" />}

      {/* Confetti */}
      {confetti && (
        <div className="confetti-container">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="confetti-piece" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              backgroundColor: ['#FFD700', '#FF6B35', '#00D4FF', '#FF3366', '#44FF44'][i % 5],
            }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bj-header">
        <Link to="/lobby" className="bj-back">
          <ArrowLeft size={20} /> <span>LOBBY</span>
        </Link>
        <h1 className="bj-title">BLACKJACK</h1>
        <div className="bj-balance">
          <span className="bj-balance-icon">🪙</span>
          <span className="bj-balance-value">{balance.toLocaleString()}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bj-table">
        <div className="bj-felt">
          {/* Dealer */}
          <div className="bj-dealer-area">
            {dealerHand.length > 0 && (
              <HandDisplay
                hand={dealerHand}
                label="Dealer"
                total={calcTotal(dealerHand)}
                hideSecond={phase === 'PLAYER_TURN'}
                flippingSecond={dealerFlipping}
              />
            )}
          </div>

          {/* Center message */}
          {message && (
            <div className={`bj-message bj-message-${msgType}`}>
              {message}
            </div>
          )}

          {/* Logo watermark */}
          {!message && phase !== 'BETTING' && (
            <div className="bj-watermark">ROYALBET</div>
          )}

          {/* Player */}
          <div className="bj-player-area">
            {playerHands.length > 0 && playerHands.map((hand, hi) => (
              <HandDisplay
                key={hi}
                hand={hand}
                label={isSplit ? `Hand ${hi + 1}` : 'Player'}
                total={calcTotal(hand)}
                isActive={isPlayerTurn && hi === activeHand}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bj-controls">
        {phase === 'BETTING' || phase === 'RESOLVED' ? (
          /* ─── Betting Phase ──────────────────────────── */
          <div className="bj-bet-section">
            {phase === 'RESOLVED' && (
              <button onClick={newRound} className="bj-btn bj-btn-new">
                NEW HAND
              </button>
            )}
            {(phase === 'BETTING' || phase === 'RESOLVED') && (
              <>
                <div className="bj-bet-chips">
                  {BET_PRESETS.map(val => (
                    <button
                      key={val}
                      onClick={() => setBetAmount(val)}
                      className={`bj-chip ${betAmount === val ? 'bj-chip-active' : ''}`}
                      disabled={val > balance}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <button
                  onClick={startGame}
                  disabled={startMutation.isPending || betAmount > balance}
                  className="bj-btn bj-btn-deal"
                >
                  {startMutation.isPending ? 'DEALING...' : `DEAL — ${betAmount} 🪙`}
                </button>
              </>
            )}
          </div>
        ) : (
          /* ─── Player Turn Actions ────────────────────── */
          <div className="bj-action-bar">
            <button onClick={() => doAction('hit')} className="bj-btn bj-btn-hit" disabled={!isPlayerTurn || actionMutation.isPending}>
              HIT
            </button>
            <button onClick={() => doAction('stand')} className="bj-btn bj-btn-stand" disabled={!isPlayerTurn || actionMutation.isPending}>
              STAND
            </button>
            {canDoubleNow && (
              <button onClick={() => doAction('double')} className="bj-btn bj-btn-double" disabled={actionMutation.isPending}>
                DOUBLE
              </button>
            )}
            {canSplitNow && (
              <button onClick={() => doAction('split')} className="bj-btn bj-btn-split" disabled={actionMutation.isPending}>
                SPLIT
              </button>
            )}
          </div>
        )}
      </div>

      {/* Styles */}
      <style>{`
        /* ─── Page ──────────────────────────────── */
        .bj-page {
          min-height: 100vh;
          background: #0a0a14;
          color: #e2e8f0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', 'Segoe UI', sans-serif;
        }

        /* ─── Header ───────────────────────────── */
        .bj-header {
          width: 100%;
          max-width: 900px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .bj-back {
          display: flex; align-items: center; gap: 6px;
          color: #9ca3af; font-size: 13px; font-weight: 700;
          text-decoration: none; transition: color 0.2s;
        }
        .bj-back:hover { color: #fff; }
        .bj-title {
          font-size: 28px; font-weight: 900; letter-spacing: 4px;
          color: #FFD700;
          text-shadow: 0 0 20px rgba(255,215,0,0.4);
        }
        .bj-balance {
          display: flex; align-items: center; gap: 8px;
          background: #1a1a2e; border: 1px solid #2d2d44;
          border-radius: 999px; padding: 6px 14px;
        }
        .bj-balance-icon { font-size: 16px; }
        .bj-balance-value { font-weight: 700; font-family: monospace; font-size: 15px; }

        /* ─── Table ─────────────────────────────── */
        .bj-table {
          width: 100%; max-width: 900px; flex: 1;
          display: flex; align-items: center; justify-content: center;
          min-height: 400px;
        }
        .bj-felt {
          width: 100%; min-height: 380px;
          background: radial-gradient(ellipse at center, #1b5e20 0%, #145218 40%, #0d3b12 100%);
          border-radius: 180px 180px 24px 24px;
          border: 8px solid #2d1810;
          box-shadow: inset 0 0 60px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.6);
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          position: relative;
        }
        .bj-watermark {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 48px; font-weight: 900; letter-spacing: 12px;
          color: rgba(255,255,255,0.04);
        }

        /* ─── Hands ─────────────────────────────── */
        .bj-dealer-area, .bj-player-area {
          display: flex; gap: 24px; justify-content: center; flex-wrap: wrap;
          width: 100%; z-index: 5;
        }
        .hand-area {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .hand-active {
          filter: drop-shadow(0 0 8px rgba(255,215,0,0.4));
        }
        .hand-label {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2px; color: rgba(255,255,255,0.6);
        }
        .hand-total {
          background: rgba(0,0,0,0.5); color: #FFD700;
          padding: 2px 10px; border-radius: 12px;
          font-size: 14px; font-weight: 900;
          font-family: monospace;
        }
        .hand-cards {
          display: flex; gap: -8px;
        }

        /* ─── Cards ─────────────────────────────── */
        .card-container {
          width: 72px; height: 100px;
          perspective: 800px;
          margin-left: -10px;
        }
        .card-container:first-child { margin-left: 0; }
        .card-inner {
          width: 100%; height: 100%;
          transition: transform 0.6s ease;
          transform-style: preserve-3d;
        }
        .card-flip { animation: flipCard 0.6s ease-in-out; }
        .card {
          width: 100%; height: 100%;
          border-radius: 8px;
          position: relative;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .card-front {
          background: linear-gradient(145deg, #ffffff, #f0f0f0);
          border: 1px solid #d1d5db;
        }
        .card-back {
          background: linear-gradient(145deg, #1e3a5f, #0f2847);
          border: 2px solid #2563eb;
          display: flex; align-items: center; justify-content: center;
        }
        .card-back-pattern {
          width: 50px; height: 76px;
          border: 2px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          background: repeating-linear-gradient(
            45deg, transparent, transparent 4px,
            rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px
          );
        }
        .card-corner {
          position: absolute; display: flex; flex-direction: column;
          align-items: center; line-height: 1;
        }
        .top-left { top: 4px; left: 6px; }
        .bottom-right { bottom: 4px; right: 6px; transform: rotate(180deg); }
        .card-rank { font-size: 16px; font-weight: 900; }
        .card-suit { font-size: 12px; }
        .card-center-suit {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 28px;
        }

        /* ─── Message ───────────────────────────── */
        .bj-message {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 28px; font-weight: 900; letter-spacing: 2px;
          padding: 12px 32px; border-radius: 16px;
          z-index: 20; text-align: center;
          animation: messagePopIn 0.4s ease-out;
        }
        .bj-message-blackjack {
          background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,180,0,0.1));
          color: #FFD700; border: 2px solid rgba(255,215,0,0.4);
          text-shadow: 0 0 20px rgba(255,215,0,0.6);
        }
        .bj-message-win {
          background: rgba(34,197,94,0.15); color: #22c55e;
          border: 2px solid rgba(34,197,94,0.3);
        }
        .bj-message-loss {
          background: rgba(239,68,68,0.1); color: #ef4444;
          border: 2px solid rgba(239,68,68,0.2);
        }
        .bj-message-bust {
          background: rgba(239,68,68,0.2); color: #ff3333;
          border: 2px solid rgba(239,68,68,0.4);
          text-shadow: 0 0 15px rgba(239,68,68,0.5);
        }
        .bj-message-push {
          background: rgba(156,163,175,0.15); color: #9ca3af;
          border: 2px solid rgba(156,163,175,0.2);
        }

        /* ─── Controls ──────────────────────────── */
        .bj-controls {
          width: 100%; max-width: 900px;
          margin-top: 16px;
        }
        .bj-bet-section {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .bj-bet-chips {
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
        }
        .bj-chip {
          width: 52px; height: 52px; border-radius: 50%;
          background: #374151; border: 3px solid #4b5563;
          color: #d1d5db; font-weight: 900; font-size: 13px;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .bj-chip:hover:not(:disabled) { border-color: #FFD700; color: #FFD700; }
        .bj-chip-active {
          background: #FFD700 !important; border-color: #f59e0b !important;
          color: #000 !important; transform: scale(1.15);
          box-shadow: 0 0 15px rgba(255,215,0,0.5);
        }
        .bj-chip:disabled { opacity: 0.3; cursor: not-allowed; }

        .bj-btn {
          padding: 14px 32px; border-radius: 12px;
          font-weight: 900; font-size: 16px; letter-spacing: 1px;
          cursor: pointer; transition: all 0.2s; border: none;
          text-transform: uppercase;
        }
        .bj-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .bj-btn-deal {
          background: linear-gradient(180deg, #FFD700, #e6a800);
          color: #000; min-width: 200px;
          box-shadow: 0 4px 0 #b45309, 0 8px 16px rgba(255,215,0,0.3);
        }
        .bj-btn-deal:hover:not(:disabled) { filter: brightness(1.1); }
        .bj-btn-deal:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 #b45309; }
        .bj-btn-new {
          background: #1f2937; color: #d1d5db; border: 1px solid #374151;
          margin-bottom: 8px;
        }
        .bj-btn-new:hover { background: #374151; color: #fff; }

        .bj-action-bar {
          display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
        }
        .bj-btn-hit {
          background: linear-gradient(180deg, #22c55e, #16a34a);
          color: #fff; min-width: 100px;
          box-shadow: 0 4px 0 #15803d;
        }
        .bj-btn-stand {
          background: linear-gradient(180deg, #ef4444, #dc2626);
          color: #fff; min-width: 100px;
          box-shadow: 0 4px 0 #b91c1c;
        }
        .bj-btn-double {
          background: linear-gradient(180deg, #f59e0b, #d97706);
          color: #000; min-width: 100px;
          box-shadow: 0 4px 0 #b45309;
        }
        .bj-btn-split {
          background: linear-gradient(180deg, #8b5cf6, #7c3aed);
          color: #fff; min-width: 100px;
          box-shadow: 0 4px 0 #6d28d9;
        }
        .bj-btn-hit:active:not(:disabled),
        .bj-btn-stand:active:not(:disabled),
        .bj-btn-double:active:not(:disabled),
        .bj-btn-split:active:not(:disabled) {
          transform: translateY(2px);
        }

        /* ─── Overlay / Effects ─────────────────── */
        .bust-overlay {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(239,68,68,0.3);
          animation: flashOverlay 1.5s ease-out forwards;
          pointer-events: none;
        }
        .confetti-container {
          position: fixed; inset: 0; z-index: 50;
          pointer-events: none; overflow: hidden;
        }
        .confetti-piece {
          position: absolute; top: -20px; width: 10px; height: 10px;
          animation: confettiFall linear forwards;
          border-radius: 2px;
        }

        /* ─── Animations ───────────────────────── */
        @keyframes cardSlideIn {
          from { transform: translateX(80px) rotate(10deg); opacity: 0; }
          to   { transform: translateX(0) rotate(0deg); opacity: 1; }
        }
        @keyframes flipCard {
          0%   { transform: rotateY(0deg); }
          50%  { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }
        @keyframes messagePopIn {
          from { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes flashOverlay {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        /* ─── Responsive ───────────────────────── */
        @media (max-width: 640px) {
          .bj-title { font-size: 20px; letter-spacing: 2px; }
          .bj-felt { border-radius: 80px 80px 16px 16px; padding: 20px 12px; min-height: 320px; }
          .card-container { width: 56px; height: 78px; }
          .card-rank { font-size: 13px; }
          .card-suit { font-size: 10px; }
          .card-center-suit { font-size: 22px; }
          .bj-message { font-size: 20px; padding: 10px 20px; }
          .bj-btn { padding: 12px 20px; font-size: 14px; }
          .bj-chip { width: 42px; height: 42px; font-size: 11px; }
        }
      `}</style>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function getCardValue(card) {
  if (!card || card.rank === '?') return 0;
  const vals = { 'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10 };
  return vals[card.rank] || 0;
}
