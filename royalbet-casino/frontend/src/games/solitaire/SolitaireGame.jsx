import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCoins } from '../../hooks/useCoins';

// ── Card helpers ──────────────────────────────────────────────────────────────
const SUITS   = ['♠', '♣', '♥', '♦'];
const RANKS   = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RED     = new Set(['♥', '♦']);
const isRed   = (s) => RED.has(s);
const rankIdx = (r) => RANKS.indexOf(r);

function makeDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ suit: s, rank: r, faceUp: false });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

const BETS = [5, 10, 25, 50];

// ── Component ─────────────────────────────────────────────────────────────────
export default function SolitaireGame() {
  const { balance, spend, earn } = useCoins();
  const [bet, setBet] = useState(10);
  const [started, setStarted] = useState(false);
  const [stock, setStock] = useState([]);
  const [waste, setWaste] = useState([]);
  const [foundations, setFoundations] = useState([[], [], [], []]); // 4 foundations
  const [tableau, setTableau] = useState([[], [], [], [], [], [], []]); // 7 columns
  const [selected, setSelected] = useState(null); // { source, cards }
  const [won, setWon] = useState(false);
  const [moves, setMoves] = useState(0);

  const startGame = async () => {
    if (balance < bet) { toast.error('Not enough coins!'); return; }
    const ok = await spend(bet, 'SOLITAIRE');
    if (!ok) return;

    const deck = makeDeck();
    const tab = [[], [], [], [], [], [], []];
    let idx = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        tab[col].push({ ...deck[idx++], faceUp: row === col });
      }
    }
    const stockCards = deck.slice(idx).map(c => ({ ...c, faceUp: false }));

    setStock(stockCards);
    setWaste([]);
    setFoundations([[], [], [], []]);
    setTableau(tab);
    setSelected(null);
    setWon(false);
    setMoves(0);
    setStarted(true);
  };

  // Check win
  useEffect(() => {
    if (!started) return;
    const total = foundations.reduce((s, f) => s + f.length, 0);
    if (total === 52) {
      setWon(true);
      const prize = bet * 4;
      earn(prize, 'SOLITAIRE');
      toast.success(`🏆 You won Solitaire! +${prize} 🪙`);
    }
  }, [foundations, started, bet, earn]);

  // Draw from stock
  const drawStock = useCallback(() => {
    if (stock.length === 0) {
      // Reset: flip waste back to stock
      setStock([...waste].reverse().map(c => ({ ...c, faceUp: false })));
      setWaste([]);
      return;
    }
    const card = { ...stock[stock.length - 1], faceUp: true };
    setStock(s => s.slice(0, -1));
    setWaste(w => [...w, card]);
    setMoves(m => m + 1);
  }, [stock, waste]);

  // Try to move a card to a foundation
  function canAddToFoundation(card, foundation) {
    if (foundation.length === 0) return card.rank === 'A';
    const top = foundation[foundation.length - 1];
    return top.suit === card.suit && rankIdx(card.rank) === rankIdx(top.rank) + 1;
  }

  // Try to move card(s) onto a tableau column
  function canAddToTableau(card, column) {
    if (column.length === 0) return card.rank === 'K';
    const top = column[column.length - 1];
    if (!top.faceUp) return false;
    return isRed(card.suit) !== isRed(top.suit) && rankIdx(card.rank) === rankIdx(top.rank) - 1;
  }

  function getSource(src) {
    if (src.type === 'waste') return [waste[waste.length - 1]];
    if (src.type === 'foundation') return [foundations[src.idx][foundations[src.idx].length - 1]];
    if (src.type === 'tableau') {
      const col = tableau[src.col];
      return col.slice(src.row);
    }
    return [];
  }

  function applyMove(src, destination) {
    const cards = getSource(src);
    if (!cards.length) return;

    // Validate destination
    if (destination.type === 'foundation') {
      if (cards.length !== 1) return;
      if (!canAddToFoundation(cards[0], foundations[destination.idx])) return;
    } else if (destination.type === 'tableau') {
      if (!canAddToTableau(cards[0], tableau[destination.col])) return;
    }

    // Copy state
    const newWaste      = [...waste];
    const newFoundations = foundations.map(f => [...f]);
    const newTableau    = tableau.map(c => [...c]);

    // Remove from source
    if (src.type === 'waste')       { newWaste.splice(-1, 1); }
    if (src.type === 'foundation')  { newFoundations[src.idx].splice(-1, 1); }
    if (src.type === 'tableau')     {
      newTableau[src.col].splice(src.row);
      // Flip newly exposed card
      if (newTableau[src.col].length > 0) {
        const last = newTableau[src.col][newTableau[src.col].length - 1];
        if (!last.faceUp) newTableau[src.col][newTableau[src.col].length - 1] = { ...last, faceUp: true };
      }
    }

    // Add to destination
    if (destination.type === 'foundation') newFoundations[destination.idx].push(...cards);
    if (destination.type === 'tableau')    newTableau[destination.col].push(...cards);

    setWaste(newWaste);
    setFoundations(newFoundations);
    setTableau(newTableau);
    setSelected(null);
    setMoves(m => m + 1);
  }

  function handleClick(src) {
    if (won) return;
    if (!selected) {
      const cards = getSource(src);
      if (!cards.length || !cards[0].faceUp) return;
      setSelected({ source: src, cards });
    } else {
      if (
        selected.source.type === src.type &&
        selected.source.col  === src.col  &&
        selected.source.idx  === src.idx  &&
        selected.source.row  === src.row
      ) {
        setSelected(null);
        return;
      }
      applyMove(selected.source, src);
    }
  }

  // Auto-move to foundation (double click sense)
  function autoMove(src) {
    const cards = getSource(src);
    if (!cards.length || !cards[0].faceUp || cards.length > 1) return;
    const card = cards[0];
    for (let i = 0; i < 4; i++) {
      if (canAddToFoundation(card, foundations[i])) {
        applyMove(src, { type: 'foundation', idx: i });
        return;
      }
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function CardView({ card, onClick, onDoubleClick, selected: isSel, small }) {
    const color = card.faceUp ? (isRed(card.suit) ? 'text-red-400' : 'text-white') : '';
    const h = small ? 'h-14' : 'h-20';
    const w = small ? 'w-10' : 'w-14';
    return (
      <div
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={`${w} ${h} rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer select-none transition-all
          ${isSel ? 'border-yellow-400 shadow-[0_0_10px_rgba(255,215,0,0.6)]' : 'border-gray-500'}
          ${card.faceUp ? 'bg-gray-100' : 'bg-gradient-to-br from-blue-800 to-blue-900 border-dashed border-blue-600'}
        `}
      >
        {card.faceUp && (
          <>
            <span className={`text-[10px] font-black leading-none ${color}`}>{card.rank}</span>
            <span className={`text-base ${color}`}>{card.suit}</span>
          </>
        )}
        {!card.faceUp && <span className="text-blue-400 text-lg">🂠</span>}
      </div>
    );
  }

  const topWaste = waste[waste.length - 1];
  const isSelWaste = selected?.source?.type === 'waste';

  return (
    <div className="min-h-screen bg-[#004d00] text-white flex flex-col px-2 py-4 select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 px-2">
        <Link to="/lobby" className="flex items-center gap-2 text-gray-300 hover:text-white transition">
          <ArrowLeft size={18}/> Lobby
        </Link>
        <h1 className="text-2xl font-black tracking-wider">SOLITAIRE ♠</h1>
        <div className="font-mono bg-black/30 px-3 py-1 rounded text-yellow-400 text-sm">🪙 {balance.toLocaleString()}</div>
      </div>

      {!started ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-black/50 p-6 rounded-2xl text-center max-w-sm w-full border border-green-800">
            <div className="text-5xl mb-4">♠♥♦♣</div>
            <h2 className="text-3xl font-black mb-2">Klondike Solitaire</h2>
            <p className="text-green-300 text-sm mb-6">Win to earn <strong>4×</strong> your bet!</p>
            <div className="flex gap-2 justify-center mb-6">
              {BETS.map(a => (
                <button key={a} onClick={() => setBet(a)}
                  className={`px-4 py-2 rounded-lg font-bold transition ${bet === a ? 'bg-green-600 text-white' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`}>
                  {a}
                </button>
              ))}
            </div>
            <button onClick={startGame} disabled={balance < bet}
              className="w-full py-3 bg-gradient-to-b from-green-500 to-green-700 font-black text-xl rounded-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40">
              DEAL CARDS
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2">
          {/* Top row: Stock + Waste + Foundations */}
          <div className="flex items-start gap-2 px-2 flex-wrap">
            {/* Stock pile */}
            <div
              onClick={drawStock}
              className="w-14 h-20 rounded-lg border-2 border-dashed border-green-600 flex items-center justify-center cursor-pointer hover:border-green-400"
            >
              {stock.length > 0 ? (
                <span className="text-blue-400 text-2xl">🂠</span>
              ) : (
                <span className="text-green-600 text-2xl">↺</span>
              )}
            </div>

            {/* Waste */}
            <div className="w-14 h-20 relative">
              {topWaste ? (
                <CardView
                  card={topWaste}
                  onClick={() => handleClick({ type: 'waste' })}
                  onDoubleClick={() => autoMove({ type: 'waste' })}
                  selected={isSelWaste}
                />
              ) : (
                <div className="w-14 h-20 rounded-lg border-2 border-dashed border-green-800"/>
              )}
            </div>

            <div className="flex-1"/>

            {/* Foundations */}
            {foundations.map((f, i) => {
              const top = f[f.length - 1];
              const isSel = selected?.source?.type === 'foundation' && selected?.source?.idx === i;
              return (
                <div key={i}
                  onClick={() => {
                    if (!selected) {
                      handleClick({ type: 'foundation', idx: i });
                    } else {
                      applyMove(selected.source, { type: 'foundation', idx: i });
                    }
                  }}
                  className={`w-14 h-20 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition
                    ${isSel ? 'border-yellow-400' : 'border-dashed border-green-700'}`}
                >
                  {top ? (
                    <>
                      <span className={`text-[10px] font-black leading-none ${isRed(top.suit)?'text-red-400':'text-white'}`}>{top.rank}</span>
                      <span className={`text-base ${isRed(top.suit)?'text-red-400':'text-white'}`}>{top.suit}</span>
                    </>
                  ) : (
                    <span className="text-green-800 text-xl">{SUITS[i]}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Status bar */}
          <div className="flex justify-between px-2 text-xs text-green-300 font-mono">
            <span>Moves: {moves}</span>
            <span>Foundation: {foundations.reduce((s,f)=>s+f.length,0)}/52</span>
            <span>Bet: {bet} 🪙</span>
          </div>

          {/* Tableau */}
          <div className="flex gap-1.5 px-2 flex-1 overflow-x-auto">
            {tableau.map((col, colIdx) => {
              return (
                <div
                  key={colIdx}
                  className="flex-1 min-w-[52px] relative flex flex-col items-center"
                  onClick={() => {
                    if (selected && col.length === 0) {
                      applyMove(selected.source, { type: 'tableau', col: colIdx });
                    } else if (!selected && col.length === 0) {
                      // empty column, no action
                    }
                  }}
                >
                  {/* Empty column placeholder */}
                  {col.length === 0 && (
                    <div className="w-14 h-20 rounded-lg border-2 border-dashed border-green-800 flex items-center justify-center text-green-800 text-lg">K</div>
                  )}

                  {col.map((card, rowIdx) => {
                    const isSel = selected?.source?.type === 'tableau' &&
                      selected?.source?.col === colIdx &&
                      rowIdx >= selected?.source?.row;
                    const offset = rowIdx === 0 ? 0 : 22;
                    return (
                      <div
                        key={rowIdx}
                        style={{ marginTop: rowIdx === 0 ? 0 : -58 + (card.faceUp ? 4 : 0), position: 'relative', zIndex: rowIdx }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!card.faceUp) return;
                          if (!selected) {
                            handleClick({ type: 'tableau', col: colIdx, row: rowIdx });
                          } else {
                            applyMove(selected.source, { type: 'tableau', col: colIdx });
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (rowIdx === col.length - 1) autoMove({ type: 'tableau', col: colIdx, row: rowIdx });
                        }}
                      >
                        <CardView card={card} selected={isSel} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Win overlay */}
          {won && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
              <div className="bg-gray-900 border border-yellow-400/50 rounded-3xl p-8 text-center shadow-2xl">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-4xl font-black text-yellow-400 mb-2">YOU WIN!</h2>
                <p className="text-gray-300 mb-6">+{bet * 4} 🪙 coins awarded!</p>
                <div className="flex gap-3">
                  <button onClick={() => { setStarted(false); setWon(false); }}
                    className="flex-1 py-3 bg-green-600 font-black rounded-xl text-xl hover:bg-green-500 transition">
                    Play Again
                  </button>
                  <Link to="/lobby"
                    className="flex-1 py-3 bg-gray-700 font-black rounded-xl text-xl hover:bg-gray-600 transition text-center">
                    Lobby
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Quit */}
          <div className="flex gap-2 p-2">
            <button onClick={() => setStarted(false)}
              className="flex-1 py-2 bg-black/40 text-gray-400 font-bold rounded-xl text-sm hover:bg-black/60 transition">
              Quit Game
            </button>
            <button
              onClick={() => {
                // Auto complete to foundations if valid
                let changed = true;
                let newTab = tableau.map(c => [...c]);
                let newFounds = foundations.map(f => [...f]);
                let newWaste = [...waste];
                let totalMoves = 0;
                while (changed && totalMoves < 200) {
                  changed = false;
                  totalMoves++;
                  // Try waste top
                  if (newWaste.length > 0) {
                    const card = newWaste[newWaste.length - 1];
                    for (let i = 0; i < 4; i++) {
                      if ((newFounds[i].length === 0 && card.rank === 'A') ||
                        (newFounds[i].length > 0 && newFounds[i][newFounds[i].length-1].suit === card.suit && rankIdx(card.rank) === rankIdx(newFounds[i][newFounds[i].length-1].rank) + 1)) {
                        newFounds[i].push({...card});
                        newWaste.splice(-1, 1);
                        changed = true; break;
                      }
                    }
                  }
                  // Try tableau tops
                  for (let c = 0; c < 7; c++) {
                    if (newTab[c].length === 0) continue;
                    const card = newTab[c][newTab[c].length - 1];
                    if (!card.faceUp) continue;
                    for (let i = 0; i < 4; i++) {
                      if ((newFounds[i].length === 0 && card.rank === 'A') ||
                        (newFounds[i].length > 0 && newFounds[i][newFounds[i].length-1].suit === card.suit && rankIdx(card.rank) === rankIdx(newFounds[i][newFounds[i].length-1].rank) + 1)) {
                        newFounds[i].push({...card});
                        newTab[c].splice(-1, 1);
                        if (newTab[c].length > 0) {
                          const last = newTab[c][newTab[c].length - 1];
                          if (!last.faceUp) newTab[c][newTab[c].length - 1] = {...last, faceUp: true};
                        }
                        changed = true; break;
                      }
                    }
                    if (changed) break;
                  }
                }
                setFoundations(newFounds);
                setTableau(newTab);
                setWaste(newWaste);
              }}
              className="flex-1 py-2 bg-green-900/50 text-green-400 font-bold rounded-xl text-sm hover:bg-green-900 transition">
              Auto Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
