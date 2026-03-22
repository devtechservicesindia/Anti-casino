import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Coins, Gift, Clock, Copy, ChevronLeft, ChevronRight, UserPlus, Loader2 } from 'lucide-react';

// --- API Helpers ---
const fetchBalance = async () => (await axios.get('/wallet/balance')).data;
const fetchPackages = async () => (await axios.get('/wallet/packages')).data.packages;
const fetchBonusStatus = async () => (await axios.get('/wallet/bonus-status')).data;
const fetchTransactions = async (page) => (await axios.get(`/wallet/transactions?page=${page}&limit=5`)).data;

// --- Razorpay Script Loader ---
const loadRazorpay = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// --- Time Formatter ---
const formatTTL = (seconds) => {
  if (seconds <= 0) return 'Available Now!';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m remaining`;
};

// --- Main Page Component ---
export default function CoinStore() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [purchaseModal, setPurchaseModal] = useState({ isOpen: false, pkg: null });

  // --- Queries ---
  const { data: balanceData, isLoading: luxLoading } = useQuery({ queryKey: ['balance'], queryFn: fetchBalance });
  const { data: bonusStatus, isLoading: bonusLoading } = useQuery({ 
    queryKey: ['bonusStatus'], 
    queryFn: fetchBonusStatus,
    refetchInterval: 60000 // Refetch TTLs every minute
  });
  const { data: packages, isLoading: pkgsLoading } = useQuery({ queryKey: ['packages'], queryFn: fetchPackages });
  const { data: transactionsData, isLoading: txnsLoading } = useQuery({ 
    queryKey: ['transactions', page], 
    queryFn: () => fetchTransactions(page),
    keepPreviousData: true
  });

  // --- Mutations ---
  const claimDaily = useMutation({
    mutationFn: () => axios.post('/wallet/daily-bonus'),
    onSuccess: (res) => {
      toast.success(`Claimed ${res.data.tokensAdded} Daily Tokens! (Streak: Day ${res.data.streakDay})`);
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['bonusStatus'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to claim daily bonus')
  });

  const claimHourly = useMutation({
    mutationFn: () => axios.post('/wallet/hourly-bonus'),
    onSuccess: (res) => {
      toast.success(`Claimed ${res.data.tokensAdded} Hourly Tokens!`);
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['bonusStatus'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to claim hourly bonus')
  });

  const createOrder = useMutation({
    mutationFn: (packageId) => axios.post('/wallet/create-order', { packageId })
  });

  // --- Payment Handler ---
  const handlePurchase = async (pkg) => {
    const res = await loadRazorpay();
    if (!res) {
      toast.error('Razorpay SDK failed to load. Are you online?');
      return;
    }

    const orderToast = toast.loading('Initiating secure payment...');
    try {
      const order = await createOrder.mutateAsync(pkg.id);
      toast.dismiss(orderToast);
      setPurchaseModal({ isOpen: false, pkg: null });

      const options = {
        key: order.data.keyId, // NEVER secret
        amount: order.data.amount, // in paise
        currency: order.data.currency,
        name: 'RoyalBet Casino',
        description: `Purchase: ${pkg.name}`,
        image: 'https://i.imgur.com/3g7nmJC.png', // placeholder logo
        order_id: order.data.orderId,
        handler: async function (response) {
          const verifyToast = toast.loading('Verifying secure payment...');
          try {
            const verifyRes = await axios.post('/wallet/verify-payment', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            toast.success(`Success! Added ${verifyRes.data.tokensAdded} tokens.`);
            queryClient.invalidateQueries({ queryKey: ['balance'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
          } catch (err) {
            toast.error(err.response?.data?.error || 'Payment verification failed');
          } finally {
            toast.dismiss(verifyToast);
          }
        },
        prefill: {
          name: 'RoyalBet Player', // Optional: pull from AuthContext
        },
        theme: {
          color: '#0D0020'
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response) {
        toast.error(`Payment Failed: ${response.error.description}`);
      });
      rzp1.open();
    } catch (err) {
      toast.dismiss(orderToast);
      toast.error(err.response?.data?.error || 'Could not create order');
    }
  };

  const copyReferral = () => {
    navigator.clipboard.writeText('ROYAL20');
    toast.success('Referral code copied!');
  };

  return (
    <div className="min-h-screen bg-casino-bg pb-20 pt-10 px-4 md:px-8 font-sans text-gray-200">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* 1. BALANCE CARD */}
        <section className="bg-gradient-to-br from-gray-900 to-black border border-brand-accent/30 rounded-3xl p-8 text-center shadow-[0_0_40px_rgba(255,215,0,0.1)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 group-hover:opacity-40 transition-opacity duration-1000 blur-[1px]"></div>
          <div className="relative z-10">
            <h2 className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-4">Total Balance</h2>
            <div className="flex items-center justify-center gap-4">
              <Coins className="w-12 h-12 text-brand-accent animate-pulse" />
              <span className="font-display text-6xl md:text-8xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-brand-accent to-yellow-700 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                {luxLoading ? '...' : (balanceData?.balance?.toLocaleString() || '0')}
              </span>
            </div>
            {balanceData && (
              <p className="mt-4 text-xs text-gray-500 font-medium">
                Last updated: {new Date(balanceData.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        </section>

        {/* 2. FREE BONUSES ROW */}
        <section>
          <h3 className="font-display text-3xl text-white mb-6 flex items-center gap-2"><Gift className="text-brand-accent"/> Free Rewards</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Daily Bonus */}
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-6 text-center shadow-lg hover:border-brand-accent/50 transition-colors">
              <div className="bg-brand-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-accent/20">
                <Gift className="text-brand-accent w-8 h-8" />
              </div>
              <h4 className="font-bold text-lg mb-2 text-white">Daily Bonus</h4>
              <p className="text-gray-400 text-sm mb-6 h-10">Check in every day to build your streak and earn up to 500 tokens!</p>
              
              {bonusLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-accent"/> : 
                bonusStatus?.dailyClaimed ? (
                  <button disabled className="w-full bg-gray-700 text-gray-400 font-bold py-3 rounded-xl cursor-not-allowed">
                     {formatTTL(bonusStatus.dailyTtl)}
                  </button>
                ) : (
                  <button 
                    onClick={() => claimDaily.mutate()}
                    disabled={claimDaily.isPending}
                    className="w-full bg-gradient-to-r from-brand-accent to-yellow-600 text-casino-bg font-bold py-3 rounded-xl hover:shadow-[0_0_15px_rgba(255,215,0,0.4)] transition-all flex justify-center items-center"
                  >
                    {claimDaily.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Claim Daily Reward'}
                  </button>
                )
              }
            </div>

            {/* Hourly Bonus */}
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-6 text-center shadow-lg hover:border-brand-accent/50 transition-colors">
              <div className="bg-blue-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                <Clock className="text-blue-400 w-8 h-8" />
              </div>
              <h4 className="font-bold text-lg mb-2 text-white">Hourly Drop</h4>
              <p className="text-gray-400 text-sm mb-6 h-10">Grab 50 free tokens every hour. Don't miss out!</p>
              
              {bonusLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-400"/> : 
                bonusStatus?.hourlyClaimed ? (
                  <button disabled className="w-full bg-gray-700 text-gray-400 font-bold py-3 rounded-xl cursor-not-allowed">
                     {formatTTL(bonusStatus.hourlyTtl)}
                  </button>
                ) : (
                  <button 
                    onClick={() => claimHourly.mutate()}
                    disabled={claimHourly.isPending}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold py-3 rounded-xl hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all flex justify-center items-center"
                  >
                    {claimHourly.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Claim Hourly Reward'}
                  </button>
                )
              }
            </div>

            {/* Refer a Friend */}
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-6 text-center shadow-lg hover:border-brand-accent/50 transition-colors">
              <div className="bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                <UserPlus className="text-green-400 w-8 h-8" />
              </div>
              <h4 className="font-bold text-lg mb-2 text-white">Refer & Earn</h4>
              <p className="text-gray-400 text-sm mb-6 h-10">Invite friends and get 1,000 tokens when they buy their first package.</p>
              
              <button 
                onClick={copyReferral}
                className="w-full bg-gray-700 border-2 border-gray-600 text-white font-bold py-3 rounded-xl hover:bg-gray-600 transition-all flex justify-center items-center gap-2"
              >
                ROYAL20 <Copy className="w-4 h-4 text-gray-400" />
              </button>
            </div>

          </div>
        </section>

        {/* 3. TOKEN PACKAGES GRID */}
        <section>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-2">
            <h3 className="font-display text-3xl text-white flex items-center gap-2">
              <Coins className="text-brand-accent"/> Buy Tokens
            </h3>
            <p className="text-gray-400 text-sm">Secure payments via Razorpay</p>
          </div>

          {pkgsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-brand-accent"/></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
              {packages?.map((pkg, idx) => {
                const isPopular = pkg.displayOrder === 2; // naive example marker
                return (
                  <div key={pkg.id} 
                    className={`relative bg-gradient-to-b from-gray-800 to-black rounded-3xl p-1 md:p-1 cursor-pointer transition-transform duration-300 hover:-translate-y-2
                    ${isPopular ? 'shadow-[0_0_30px_rgba(255,215,0,0.2)]' : 'hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]'}`}
                    onClick={() => setPurchaseModal({ isOpen: true, pkg })}
                  >
                    {/* Glowing Border Wrapper */}
                    <div className={`h-full w-full rounded-[23px] bg-gray-900 border ${isPopular ? 'border-brand-accent' : 'border-gray-700'} p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden`}>
                      
                      {isPopular && (
                        <div className="absolute top-4 right-[-30px] bg-red-600 text-white text-[10px] font-bold uppercase py-1 px-10 rotate-45 shadow-lg">
                          Popular
                        </div>
                      )}

                      <Coins className={`w-16 h-16 md:w-20 md:h-20 mb-4 ${isPopular ? 'text-brand-accent drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]' : 'text-gray-300'}`} />
                      
                      <h4 className="text-lg md:text-xl font-bold text-gray-200 mb-1">{pkg.name}</h4>
                      <div className="flex items-baseline gap-1 my-2">
                        <span className="font-display text-4xl text-white">{(pkg.tokenAmount + pkg.bonusTokens).toLocaleString()}</span>
                      </div>
                      
                      {pkg.bonusTokens > 0 ? (
                        <span className="text-xs font-bold text-green-400 bg-green-400/10 px-3 py-1 rounded-full mb-6 border border-green-400/20">
                          Includes {pkg.bonusTokens.toLocaleString()} Bonus
                        </span>
                      ) : (
                        <div className="mb-6 h-[26px]"></div> // spacer
                      )}

                      <button className={`w-full font-bold py-3 rounded-xl transition-colors
                        ${isPopular ? 'bg-brand-accent text-casino-bg hover:bg-yellow-500' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                        ₹{pkg.priceInr}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 5. TRANSACTION HISTORY */}
        <section className="bg-gray-900 border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl">
          <h3 className="font-display text-2xl text-white mb-6">Transaction History</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-sm uppercase tracking-wider">
                  <th className="pb-4 font-semibold">Date</th>
                  <th className="pb-4 font-semibold">Type</th>
                  <th className="pb-4 font-semibold">Description</th>
                  <th className="pb-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txnsLoading ? (
                  <tr><td colSpan="4" className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500"/></td></tr>
                ) : transactionsData?.transactions?.length === 0 ? (
                  <tr><td colSpan="4" className="py-8 text-center text-gray-500">No transactions found.</td></tr>
                ) : (
                  transactionsData?.transactions?.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 text-gray-300 whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded border
                          ${tx.type === 'PURCHASE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                            tx.type === 'BONUS' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                            'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-4 text-gray-400">{tx.note}</td>
                      <td className={`py-4 text-right font-bold font-mono
                        ${tx.type === 'SPEND' ? 'text-red-400' : 'text-green-400'}`}>
                        {tx.type === 'SPEND' ? '-' : '+'}{Number(tx.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {transactionsData?.totalPages > 1 && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-800">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-30 hover:bg-gray-700 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-gray-500 text-sm">Page {page} of {transactionsData.totalPages}</span>
              <button 
                onClick={() => setPage(p => Math.min(transactionsData.totalPages, p + 1))}
                disabled={page === transactionsData.totalPages}
                className="p-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-30 hover:bg-gray-700 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </section>

      </div>

      {/* 4. PURCHASE MODAL */}
      {purchaseModal.isOpen && purchaseModal.pkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-brand-accent/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="font-display text-3xl text-white mb-2 text-center">Checkout</h2>
            <p className="text-gray-400 text-center text-sm mb-6">Complete your secure payment via Razorpay</p>
            
            <div className="bg-black/50 rounded-xl p-4 mb-6 border border-gray-800">
              <div className="flex justify-between text-gray-300 mb-2">
                <span>Package</span>
                <span className="font-bold text-white">{purchaseModal.pkg.name}</span>
              </div>
              <div className="flex justify-between text-gray-300 mb-2">
                <span>Total Tokens</span>
                <span className="font-bold text-brand-accent">{(purchaseModal.pkg.tokenAmount + purchaseModal.pkg.bonusTokens).toLocaleString()} 🪙</span>
              </div>
              <div className="border-t border-gray-700 my-3"></div>
              <div className="flex justify-between text-white text-xl font-bold">
                <span>Total Due</span>
                <span>₹{purchaseModal.pkg.priceInr}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handlePurchase(purchaseModal.pkg)}
                disabled={createOrder.isPending}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex justify-center items-center shadow-[0_4px_14px_0_rgba(37,99,235,0.39)]"
              >
                {createOrder.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Pay with Razorpay'}
              </button>
              <button 
                onClick={() => setPurchaseModal({ isOpen: false, pkg: null })}
                disabled={createOrder.isPending}
                className="w-full bg-gray-800 text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            
            <p className="text-[10px] text-gray-600 text-center mt-6">
              100% Secure Payment. 256-bit encryption. <br/>
              Tokens are credited instantly upon successful payment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
