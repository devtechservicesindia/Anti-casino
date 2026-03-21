import { Link } from 'react-router-dom';

const floatingSymbols = ['🎰', '🎲', '🃏', '🍒', '💎', '👑', '💰', '🎱', '🔔'];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-casino-bg overflow-hidden flex flex-col justify-center items-center">
      
      {/* Background Floating Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {floatingSymbols.map((symbol, index) => (
          <div
            key={index}
            className={`absolute text-4xl sm:text-6xl opacity-20 ${
              index % 2 === 0 ? 'animate-float' : 'animate-float-delayed'
            }`}
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${5 + Math.random() * 5}s`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          >
            {symbol}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        
        {/* Logo/Brand */}
        <div className="mb-8">
          <h1 className="font-display text-7xl sm:text-9xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-brand-accent to-yellow-600 drop-shadow-2xl mb-4 animate-pulse">
            RoyalBet
          </h1>
          <div className="h-1 w-32 bg-brand-accent mx-auto rounded-full mb-6"></div>
          <p className="font-sans text-2xl sm:text-4xl text-gray-200 font-light tracking-wide drop-shadow-md">
            Win Big with <span className="text-brand-accent font-bold">Royal Tokens</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-12">
          <Link
            to="/register"
            className="group relative px-8 py-4 bg-gradient-to-r from-brand-accent to-yellow-600 text-casino-bg font-bold text-2xl rounded-full overflow-hidden shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,215,0,0.6)]"
          >
            <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:animate-shimmer transition-all"></div>
            <span className="relative z-10 font-display tracking-widest">
              Play Now 🎰
            </span>
          </Link>

          <Link
            to="/login"
            className="px-8 py-4 bg-transparent border-2 border-brand-accent text-brand-accent font-bold text-2xl rounded-full transition-all hover:bg-brand-accent/10 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)]"
          >
            <span className="font-display tracking-widest">Login</span>
          </Link>
        </div>

      </div>

      {/* Footer minimal info */}
      <div className="absolute bottom-6 w-full text-center text-gray-500 text-sm z-10">
        <p>Must be 18+ to play. Please play responsibly.</p>
        <p className="mt-1">© {new Date().getFullYear()} RoyalBet Casino. All rights reserved.</p>
      </div>

    </div>
  );
}
