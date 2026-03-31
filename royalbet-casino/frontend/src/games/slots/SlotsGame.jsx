import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Application, Container, Text, Graphics, BlurFilter } from 'pixi.js';
import { useAuth } from '../../store/AuthContext';
import { Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';

// --- Assets & Constants ---
const SYMBOLSMap = {
  0: '💎', 1: '⭐', 2: '7️⃣', 3: '👑',
  4: '🍒', 5: '🔔', 6: '🍋', 7: '🍊', 8: '✖️' // 8 is generic
};

const BET_AMOUNTS = [10, 25, 50, 100, 500];
const SYMBOL_SIZE = 80;
const REEL_WIDTH = 100;
const ROW_HEIGHT = 100;

// Fake audio player until files exist
class AudioPlayer {
  constructor() { this.muted = true; }
  play(name) { if (!this.muted) console.log(`🎵 Playing sound: ${name}.mp3`); }
}
const audio = new AudioPlayer();

export default function SlotsGame() {
  const { user, login } = useAuth(); // Assuming login or global state update applies balance
  const queryClient = useQueryClient();

  // --- State ---
  const [balance, setBalance] = useState(0); // We'll sync with query
  const [bet, setBet] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [message, setMessage] = useState('Press SPIN to play! 🎰');
  const [muted, setMuted] = useState(true);
  
  // Provably Fair
  const [pfData, setPfData] = useState(null);
  const [pfOpen, setPfOpen] = useState(false);

  // Big Win Modal
  const [bigWin, setBigWin] = useState(null); // null or { amount, type: 'BIG' | 'JACKPOT' }

  // Canvas Ref
  const pixiContainerRef = useRef(null);
  const pixiAppRef = useRef(null);
  const reelsRef = useRef([]); // holds PixiJS objects to mutate
  const winLinesRef = useRef([]);

  // --- Queries ---
  const { data: jackpotData } = useQuery({
    queryKey: ['slots-jackpot'],
    queryFn: async () => (await axios.get('/games/slots/jackpot')).data,
    refetchInterval: 2000
  });

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => (await axios.get('/wallet/balance')).data,
  });

  useEffect(() => {
    if (balanceData) setBalance(balanceData.balance);
  }, [balanceData]);

  // Audio mute sync
  useEffect(() => { audio.muted = muted; }, [muted]);

  // --- PixiJS Initialization ---
  useEffect(() => {
    if (!pixiContainerRef.current || pixiAppRef.current) return;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        width: 320,
        height: 320,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      pixiContainerRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;

      // Create Reels
      const reelContainer = new Container();
      reelContainer.x = 10;
      reelContainer.y = 10;
      app.stage.addChild(reelContainer);

      const newReels = [];

      for (let i = 0; i < 3; i++) {
        const rc = new Container();
        rc.x = i * REEL_WIDTH;
        reelContainer.addChild(rc);

        const reel = {
          container: rc,
          symbols: [],
          position: 0,
          previousPosition: 0,
          blur: new BlurFilter(),
          isSpinning: false
        };

        reel.blur.blurY = 0;
        reel.blur.blurX = 0;
        rc.filters = [reel.blur];

        // Fill reel with initial random symbols (plus padding for scroll illusion)
        for (let j = 0; j < 5; j++) {
          const symStr = SYMBOLSMap[Math.floor(Math.random() * 8)];
          const style = { fontSize: 50, fontFamily: 'sans-serif', fill: '#ffffff' };
          const symbol = new Text({ text: symStr, style });
          symbol.y = j * ROW_HEIGHT;
          symbol.x = Math.round((REEL_WIDTH - symbol.width) / 2);
          rc.addChild(symbol);
          reel.symbols.push(symbol);
        }
        newReels.push(reel);
      }
      reelsRef.current = newReels;

      // Create Win Lines container (rendered on top)
      const linesContainer = new Container();
      linesContainer.x = 10;
      linesContainer.y = 10;
      app.stage.addChild(linesContainer);
      winLinesRef.current = linesContainer;

      // Ticker for animation
      app.ticker.add(() => {
        for (let i = 0; i < newReels.length; i++) {
          const r = newReels[i];
          r.blur.blurY = (r.position - r.previousPosition) * 8;
          r.previousPosition = r.position;

          for (let j = 0; j < r.symbols.length; j++) {
            const s = r.symbols[j];
            const prevY = s.y;
            // Scroll downwards
            s.y = ((r.position + j) % 5) * ROW_HEIGHT - ROW_HEIGHT;
            
            // If symbol wrapped around, change it to random (unless it's stopping)
            if (s.y < 0 && prevY > ROW_HEIGHT * 3 && r.isSpinning) {
               s.text = SYMBOLSMap[Math.floor(Math.random() * 8)];
               s.x = Math.round((REEL_WIDTH - s.width) / 2);
            }
          }
        }
      });
    };

    initPixi();

    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, true);
        pixiAppRef.current = null;
      }
    };
  }, []);

  // --- API Mutation ---
  const spinMutation = useMutation({
    mutationFn: async (amount) => {
      const res = await axios.post('/games/slots/spin', { betAmount: amount });
      return res.data;
    },
    onSuccess: (data) => {
      handleSpinResponse(data);
    },
    onError: (err) => {
      setMessage(err.response?.data?.error || 'Spin failed!');
      setIsSpinning(false);
      setAutoSpin(false);
    }
  });

  // --- Spin Action ---
  const handleSpinClick = useCallback(() => {
    if (isSpinning || balance < bet) return;
    
    setIsSpinning(true);
    setMessage('Spinning...');
    winLinesRef.current.removeChildren(); // clear old win lines
    
    // Start blur & fast scroll
    reelsRef.current.forEach(r => { 
      r.isSpinning = true; 
    });
    audio.play('spin');

    // Fire API call
    spinMutation.mutate(bet);
  }, [bet, balance, isSpinning]);

  // Auto spin effect
  useEffect(() => {
    if (autoSpin && !isSpinning && balance >= bet) {
      const t = setTimeout(() => handleSpinClick(), 1000);
      return () => clearTimeout(t);
    }
    if (autoSpin && balance < bet) {
      setAutoSpin(false); // Can't afford
    }
  }, [autoSpin, isSpinning, handleSpinClick, balance, bet]);

  // --- Handle API Response & Reel Stop ---
  const handleSpinResponse = (data) => {
    const { grid, winAmount, winningLines, newBalance, serverSeed, clientSeed, nonce } = data;
    
    // Update balance locally during spin for fluid UI
    if (newBalance !== undefined) setBalance(newBalance);
    queryClient.invalidateQueries(['balance']);

    // Schedule reel stops
    reelsRef.current.forEach((reel, i) => {
      setTimeout(() => {
        reel.isSpinning = false;
        audio.play('reel-stop');
        
        // Lock the middle 3 symbols to the API grid result
        // grid[row][col] -> we need grid[0][i], grid[1][i], grid[2][i]
        reel.position = Math.floor(reel.position); // Snap to integer row
        
        // Find the 3 symbols currently in view (y = 0, 100, 200)
        // Sort symbols by Y to find top/mid/bot
        const sorted = [...reel.symbols].sort((a,b) => a.y - b.y);
        // The one at index 1 is Y=0, index 2 is Y=100, index 3 is Y=200
        // (Index 0 is at -100, out of top bound)
        for(let row=0; row<3; row++) {
           const sym = sorted[row + 1];
           if (sym) {
             const syId = grid[row][i];
             sym.text = SYMBOLSMap[syId] || '❓';
             sym.x = Math.round((REEL_WIDTH - sym.width) / 2);
           }
        }
        
        // If last reel stops, finalize game
        if (i === 2) {
          finalizeSpin(winAmount, winningLines, newBalance, { serverSeed, clientSeed, nonce });
        }
      }, 500 + (i * 300)); // Minimum 500ms spin + 300ms staggering
    });
  };

  const finalizeSpin = (winAmount, winningLines, newBalance, pf) => {
    setIsSpinning(false);
    setPfData(pf);
    
    if (winAmount > 0) {
      setMessage(`+${winAmount.toLocaleString()} tokens! 🎉`);
      audio.play('win');
      
      // Draw win lines via Pixi
      const gfx = new Graphics();
      winningLines.forEach(wl => {
        let drawY = -1;
        if (wl.payline === 'top') drawY = 0;
        if (wl.payline === 'centre') drawY = 100;
        if (wl.payline === 'bottom') drawY = 200;
        
        if (drawY > -1) {
          gfx.roundRect(0, drawY + 5, REEL_WIDTH * 3, ROW_HEIGHT - 10, 10);
          gfx.stroke({ width: 4, color: 0xFFD700, alpha: 0.8 });
        }
      });
      winLinesRef.current.addChild(gfx);

      // Check Big Win
      if (winAmount >= bet * 20) {
        audio.play('bigwin');
        setBigWin({ amount: winAmount, type: 'JACKPOT' });
      } else if (winAmount >= bet * 5) {
        audio.play('bigwin');
        setBigWin({ amount: winAmount, type: 'BIG' });
      }

    } else {
      setMessage('Try again! 🎰');
    }
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-casino-bg text-gray-200 p-4 md:p-8 flex flex-col items-center">
      
      {/* 1. MACHINE FRAME */}
      <div className="w-full max-w-2xl bg-gradient-to-b from-purple-900 to-black rounded-3xl border-4 border-brand-accent p-6 shadow-[0_0_40px_rgba(255,215,0,0.15)] relative">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl md:text-5xl text-brand-accent drop-shadow-[0_0_10px_rgba(255,215,0,0.8)] tracking-wider">
            ROYAL JEWELS 👑
          </h1>
          <div className="mt-2 inline-block bg-black/50 border border-brand-accent/30 rounded-full px-6 py-2">
            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Progressive Jackpot</span>
            <div className="font-mono text-2xl text-green-400 font-bold drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]">
              🪙 {jackpotData?.jackpot ? jackpotData.jackpot.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '1,000,000.00'}
            </div>
          </div>
        </div>

        {/* Audio Toggle */}
        <button onClick={() => setMuted(!muted)} className="absolute top-6 right-6 text-gray-400 hover:text-white transition cursor-pointer">
          {muted ? <VolumeX size={24}/> : <Volume2 size={24}/>}
        </button>

        {/* 2. REEL DISPLAY */}
        <div className="flex justify-center mb-4">
          <div className="bg-gray-900 border-8 border-gray-800 rounded-xl shadow-inner relative overflow-hidden" 
               style={{ width: 340, height: 340 }}>
            {/* Canvas Container */}
            <div ref={pixiContainerRef} className="absolute inset-0 flex items-center justify-center pt-[10px]" />
            
            {/* Reel shadows for depth */}
            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
          </div>
        </div>

        {/* 3. WIN DISPLAY BAR */}
        <div className={`text-center py-3 mb-6 rounded-lg font-bold text-xl
          ${message.includes('+') ? 'bg-yellow-900/30 text-brand-accent border border-brand-accent/50' 
            : 'bg-black/40 text-gray-300 border border-white/5'}`}>
          {message}
        </div>

        {/* 4. CONTROLS PANEL */}
        <div className="bg-black/60 rounded-2xl p-4 md:p-6 border border-white/10">
          
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400 text-sm font-bold">Balance: <span className="text-white text-lg font-mono ml-2">🪙 {balance.toLocaleString()}</span></span>
            <div className="flex gap-2">
              <span className="text-gray-400 text-sm font-bold">Bet:</span>
              <div className="flex gap-1 overflow-x-auto custom-scrollbar">
                {BET_AMOUNTS.map(amt => (
                  <button 
                    key={amt}
                    disabled={isSpinning || balance < amt}
                    onClick={() => setBet(amt)}
                    className={`px-3 py-1 rounded text-sm font-bold transition
                      ${bet === amt ? 'bg-brand-accent text-black drop-shadow-[0_0_5px_rgba(255,215,0,0.8)]' 
                        : balance < amt ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                        : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center gap-4">
            <button 
              onClick={() => setAutoSpin(!autoSpin)}
              disabled={isSpinning && !autoSpin}
              className={`flex-1 max-w-[100px] py-3 rounded-lg font-bold text-xs uppercase transition
                ${autoSpin ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {autoSpin ? 'Stop Auto' : 'Auto Spin'}
            </button>
            
            <button 
              onClick={handleSpinClick}
              disabled={isSpinning || balance < bet}
              className={`flex-[2] py-4 rounded-xl font-display text-3xl transition-all transform active:scale-95
                ${isSpinning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : balance < bet ? 'bg-red-900 text-red-400 cursor-not-allowed' 
                  : 'bg-gradient-to-b from-brand-accent to-yellow-600 text-black shadow-[0_5px_0_#b45309,0_10px_20px_rgba(255,215,0,0.4)] hover:brightness-110'}`}
            >
              {isSpinning ? 'SPINNING...' : 'SPIN 🎰'}
            </button>
            
            <button 
              onClick={() => {
                const max = [...BET_AMOUNTS].reverse().find(a => balance >= a) || 10;
                setBet(max);
              }}
              disabled={isSpinning}
              className="flex-1 max-w-[100px] py-3 rounded-lg bg-gray-800 text-gray-400 font-bold text-xs uppercase hover:bg-gray-700 transition"
            >
              Max Bet
            </button>
          </div>
        </div>

        {/* 6. PROVABLY FAIR SECTION */}
        {pfData && (
          <div className="mt-6 border border-gray-800 rounded-xl overflow-hidden">
            <button 
              onClick={() => setPfOpen(!pfOpen)}
              className="w-full flex justify-between items-center p-3 bg-gray-900 hover:bg-gray-800 text-sm font-bold text-gray-400 transition"
            >
              <span>⚖️ Provably Fair Details</span>
              {pfOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
            {pfOpen && (
              <div className="p-4 bg-black/50 text-xs font-mono text-gray-500 break-all space-y-2">
                <p><span className="text-gray-400">Server Seed:</span> {pfData.serverSeed}</p>
                <p><span className="text-gray-400">Client Seed:</span> {pfData.clientSeed}</p>
                <p><span className="text-gray-400">Nonce:</span> {pfData.nonce}</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 5. BIG WIN POPUP */}
      {bigWin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
             style={{ animation: 'fadeIn 0.3s ease-out' }}>
          
          {/* Confetti simulation using pure CSS */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({length: 30}).map((_, i) => (
              <div key={i} className="absolute text-2xl animate-fall" 
                   style={{ 
                     left: `${Math.random() * 100}%`, 
                     animationDelay: `${Math.random() * 2}s`,
                     animationDuration: `${2 + Math.random() * 3}s` 
                   }}>
                🪙
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-b from-yellow-900 to-black border-4 border-brand-accent rounded-3xl p-8 max-w-sm w-full text-center relative shadow-[0_0_100px_rgba(255,215,0,0.4)] transform scale-110">
            <div className="text-6xl mb-4 animate-bounce">
              {bigWin.type === 'JACKPOT' ? '👑' : '💎'}
            </div>
            <h2 className="font-display text-4xl text-white mb-2 tracking-widest drop-shadow-lg">
              {bigWin.type === 'JACKPOT' ? 'MEGA JACKPOT!' : 'BIG WIN!'}
            </h2>
            <p className="font-mono text-5xl text-brand-accent font-bold mb-8 drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]">
              +{bigWin.amount.toLocaleString()} 🪙
            </p>
            <button 
              onClick={() => setBigWin(null)}
              className="w-full bg-brand-accent text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition text-lg"
            >
              COLLECT!
            </button>
          </div>
        </div>
      )}

      {/* Global styles for generic animations missing in tailwind config */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fall { 
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; } 
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } 
        }
        .animate-fall { animation: fall linear infinite; }
      `}</style>

    </div>
  );
}
