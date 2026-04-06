import React, { useState } from 'react';
import { ChevronLeft, Wallet, Landmark, Smartphone, CreditCard, AlertCircle, CheckCircle2, Loader2, History, ArrowRight, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { doc, updateDoc, increment, collection, addDoc } from 'firebase/firestore';

export default function WithdrawalPage({ onBack, onViewHistory, balance, user, playSound }: { onBack: () => void, onViewHistory: () => void, balance: number, user: any, playSound: (type: 'bet' | 'win' | 'loss' | 'notify' | 'click') => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [accountDetails, setAccountDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const methods = [
    { id: 'bank', label: 'Bank Transfer', icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'easypaisa', label: 'Easypaisa', icon: Smartphone, color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'jazzcash', label: 'Jazzcash', icon: CreditCard, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const quickAmounts = [200, 500, 1000, 2000, 5000, 10000];

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (parseFloat(amount) < 200) {
      setError('Minimum withdrawal amount is Rs 200');
      return;
    }
    if (parseFloat(amount) > balance) {
      setError('Insufficient balance');
      return;
    }
    if (!accountDetails) {
      setError('Please enter account details');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Deduct balance first
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: increment(-parseFloat(amount))
      });

      // Create withdrawal request
      const withdrawalRef = await addDoc(collection(db, 'withdrawals'), {
        userId: user.uid,
        userEmail: user.email,
        amount: parseFloat(amount),
        method,
        accountDetails,
        status: 'pending',
        timestamp: Date.now()
      });

      // Create transaction record
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'withdrawal',
        amount: parseFloat(amount),
        status: 'pending',
        timestamp: Date.now(),
        method
      });

      setSuccess('Withdrawal request submitted successfully! It will be processed within 24 hours.');
      setAmount('');
      setAccountDetails('');
      playSound('notify');
    } catch (e) {
      setError('Connection error. Please check your internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-[#f8fafc] flex flex-col pb-10"
    >
      {/* Header */}
      <div className="bg-gradient-to-b from-[#00c853] to-[#00b24a] p-6 text-white flex flex-col items-center relative rounded-b-[3rem] shadow-2xl overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-black/5 rounded-full blur-3xl"></div>

        <div className="w-full flex justify-between items-center mb-8 relative z-10">
          <button 
            onClick={onBack} 
            className="p-2 bg-white/20 backdrop-blur-md rounded-xl transition-all active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-black uppercase tracking-widest">Withdraw</h1>
          <button 
            onClick={onViewHistory} 
            className="p-2 bg-white/20 backdrop-blur-md rounded-xl transition-all active:scale-90 flex items-center gap-2"
          >
            <History size={20} />
          </button>
        </div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center mb-4 shadow-inner border border-white/30">
            <Wallet size={40} className="text-white drop-shadow-md" />
          </div>
          <div className="text-4xl font-black mb-1 drop-shadow-sm">Rs {balance.toFixed(2)}</div>
          <div className="text-[10px] opacity-80 font-bold uppercase tracking-[0.2em]">Available Balance</div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-6">
        {/* Main Form Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-gray-50">
          {/* Amount Input */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Withdrawal Amount</label>
              <button 
                onClick={() => setAmount(balance.toString())}
                className="text-[10px] text-[#00c853] font-black uppercase tracking-wider hover:underline"
              >
                Withdraw All
              </button>
            </div>
            
            <div className="relative mb-4">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-300 text-2xl">Rs</span>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="w-full pl-16 pr-6 py-6 rounded-3xl bg-gray-50 border-2 border-transparent focus:border-[#00c853] focus:bg-white transition-all outline-none font-black text-3xl text-gray-800 placeholder:text-gray-200"
                placeholder="0.00"
              />
            </div>

            {/* Quick Amounts */}
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setAmount(amt.toString());
                    playSound('click');
                  }}
                  className={cn(
                    "py-2 rounded-xl text-[10px] font-black transition-all active:scale-95 border",
                    amount === amt.toString() 
                      ? "bg-green-600 text-white border-green-600 shadow-lg shadow-green-200" 
                      : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                  )}
                >
                  Rs {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Method Selection */}
          <div className="mb-8">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Select Method</label>
            <div className="grid grid-cols-3 gap-3">
              {methods.map((m) => {
                const Icon = m.icon;
                const isActive = method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMethod(m.id);
                      playSound('click');
                    }}
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all active:scale-95",
                      isActive 
                        ? "border-[#00c853] bg-green-50/50 shadow-lg shadow-green-100" 
                        : "border-gray-50 bg-white hover:border-gray-100"
                    )}
                  >
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", m.bg)}>
                      <Icon size={24} className={m.color} />
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-tighter text-center leading-tight",
                      isActive ? "text-[#00c853]" : "text-gray-400"
                    )}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Details */}
          <div className="mb-8">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Account Details</label>
            <div className="relative">
              <textarea 
                value={accountDetails} 
                onChange={(e) => setAccountDetails(e.target.value)} 
                className="w-full p-6 rounded-3xl bg-gray-50 border-2 border-transparent focus:border-[#00c853] focus:bg-white transition-all outline-none font-bold text-gray-700 placeholder:text-gray-300 resize-none shadow-inner"
                placeholder={
                  method === 'bank' ? "Bank Name, Account Holder Name, IBAN/Account Number" :
                  method === 'easypaisa' ? "Easypaisa Account Number & Name" :
                  "Jazzcash Account Number & Name"
                }
                rows={3}
              />
              <div className="absolute right-4 bottom-4 text-gray-200">
                <CreditCard size={24} />
              </div>
            </div>
          </div>

          {/* Messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle size={18} className="text-red-500" />
                </div>
                <p className="text-xs font-bold text-red-600">{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
                <p className="text-xs font-bold text-green-700">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <button 
            onClick={handleWithdraw} 
            disabled={loading || !!success}
            className={cn(
              "w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3",
              loading || !!success
                ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-[#00c853] to-[#00e676] text-white hover:shadow-green-200"
            )}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processing...
              </>
            ) : success ? (
              'Submitted'
            ) : (
              <>
                Request Withdrawal
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center">
              <Info size={20} className="text-orange-500" />
            </div>
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Withdrawal Policy</h3>
          </div>
          
          <div className="space-y-4">
            {[
              { text: "Withdrawals are processed within 24 hours.", icon: "⚡" },
              { text: "Minimum withdrawal amount is Rs 200.", icon: "💰" },
              { text: "Ensure your account details are 100% correct.", icon: "✅" },
              { text: "Bank transfers may take up to 48 hours.", icon: "🏦" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="text-lg grayscale group-hover:grayscale-0 transition-all">{item.icon}</div>
                <p className="text-[10px] font-bold text-gray-400 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
