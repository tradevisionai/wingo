import React from 'react';
import { 
  ChevronLeft, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History, 
  Shield, 
  Zap,
  ChevronRight,
  CreditCard,
  Smartphone,
  Landmark
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface WalletPageProps {
  onBack: () => void;
  balance: number;
  setView: (view: string) => void;
  user: any;
  playSound: (type: 'bet' | 'win' | 'loss' | 'notify' | 'click') => void;
}

export default function WalletPage({ onBack, balance, setView, user, playSound }: WalletPageProps) {
  const actions = [
    { 
      id: 'deposit', 
      label: 'Deposit', 
      icon: ArrowUpCircle, 
      color: 'text-green-600', 
      bg: 'bg-green-50',
      desc: 'Add funds to your wallet'
    },
    { 
      id: 'withdraw', 
      label: 'Withdraw', 
      icon: ArrowDownCircle, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      desc: 'Cash out your winnings'
    },
    { 
      id: 'depositHistory', 
      label: 'Deposit History', 
      icon: History, 
      color: 'text-orange-600', 
      bg: 'bg-orange-50',
      desc: 'View your past deposits'
    },
    { 
      id: 'withdrawalHistory', 
      label: 'Withdrawal History', 
      icon: History, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50',
      desc: 'View your past withdrawals'
    }
  ];

  const handleAction = (id: string) => {
    playSound('click');
    setView(id);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-[#f8fafc] flex flex-col pb-24"
    >
      {/* Header */}
      <div className="bg-gradient-to-b from-[#00c853] to-[#00b24a] p-8 text-white rounded-b-[3rem] shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-black/5 rounded-full blur-3xl"></div>

        <div className="flex items-center gap-4 mb-8 relative z-10">
          <button 
            onClick={onBack} 
            className="p-2 bg-white/20 backdrop-blur-md rounded-xl transition-all active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-black uppercase tracking-widest">My Wallet</h1>
        </div>

        <div className="relative z-10 flex flex-col items-center py-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <Wallet size={32} className="text-white" />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Total Balance</div>
          <div className="text-5xl font-black tracking-tighter flex items-baseline gap-2">
            <span className="text-2xl opacity-80">Rs</span>
            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 -mt-8 relative z-20 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => handleAction('deposit')}
            className="bg-white p-6 rounded-[2rem] shadow-xl shadow-green-500/5 flex flex-col items-center gap-3 border border-gray-50 active:scale-95 transition-all group"
          >
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
              <ArrowUpCircle size={28} />
            </div>
            <span className="text-sm font-black text-gray-800 uppercase tracking-widest">Deposit</span>
          </button>
          <button 
            onClick={() => handleAction('withdraw')}
            className="bg-white p-6 rounded-[2rem] shadow-xl shadow-blue-500/5 flex flex-col items-center gap-3 border border-gray-50 active:scale-95 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <ArrowDownCircle size={28} />
            </div>
            <span className="text-sm font-black text-gray-800 uppercase tracking-widest">Withdraw</span>
          </button>
        </div>

        {/* List Actions */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Transaction History</h2>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            {actions.slice(2).map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-left",
                  index !== 0 && "border-t border-gray-50"
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", action.bg, action.color)}>
                  <action.icon size={24} />
                </div>
                <div className="flex-1">
                  <div className="font-black text-gray-800 text-sm uppercase tracking-tight">{action.label}</div>
                  <div className="text-[10px] text-gray-400 font-bold">{action.desc}</div>
                </div>
                <ChevronRight size={20} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10">
            <Shield size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={20} className="text-green-500" />
              <span className="text-xs font-black uppercase tracking-widest">Secure Payments</span>
            </div>
            <h3 className="text-xl font-black mb-2">100% Safe & Instant</h3>
            <p className="text-xs text-white/50 font-bold leading-relaxed mb-6">
              Your transactions are protected with military-grade encryption. Withdrawals are processed within 24 hours.
            </p>
            <div className="flex gap-4 opacity-40">
              <Landmark size={24} />
              <Smartphone size={24} />
              <CreditCard size={24} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
