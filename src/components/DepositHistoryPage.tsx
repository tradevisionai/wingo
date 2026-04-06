import React, { useState, useEffect } from 'react';
import { ChevronLeft, History, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { query, collection, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';

export default function DepositHistoryPage({ onBack, user }: { onBack: () => void, user: any }) {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'deposits'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const depositsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => b.timestamp - a.timestamp);
      setDeposits(depositsData);
      setLoading(false);
    }, (error) => {
      console.error("Failed to fetch deposits:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col pb-10">
      {/* Header */}
      <div className="bg-[#00c853] p-6 text-white flex flex-col items-center relative rounded-b-[2.5rem] shadow-lg">
        <button 
          onClick={onBack} 
          className="absolute left-4 top-6 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black uppercase tracking-widest mb-6">Deposit History</h1>
        
        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-4 shadow-inner border border-white/30">
          <History size={40} className="text-white drop-shadow-md" />
        </div>
        
        <div className="text-sm font-bold opacity-80 uppercase tracking-widest">Track your deposits</div>
      </div>

      <div className="px-4 -mt-6 relative z-10 space-y-4">
        {loading ? (
          <div className="bg-white rounded-[2rem] p-12 shadow-xl border border-gray-100 flex flex-col items-center justify-center gap-4">
            <Loader2 size={40} className="text-[#00c853] animate-spin" />
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading History...</p>
          </div>
        ) : deposits.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-12 shadow-xl border border-gray-100 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
              <AlertCircle size={32} />
            </div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No history found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deposits.map((item) => (
              <div key={item.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    item.status === 'pending' ? "bg-orange-50 text-orange-500" :
                    item.status === 'approved' ? "bg-green-50 text-green-500" :
                    "bg-red-50 text-red-500"
                  )}>
                    {item.status === 'pending' ? <Clock size={24} /> :
                     item.status === 'approved' ? <CheckCircle2 size={24} /> :
                     <XCircle size={24} />}
                  </div>
                  <div>
                    <div className="text-lg font-black text-gray-800">Rs {item.amount.toFixed(2)}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    item.status === 'pending' ? "bg-orange-100 text-orange-600" :
                    item.status === 'approved' ? "bg-green-100 text-green-600" :
                    "bg-red-100 text-red-600"
                  )}>
                    {item.status}
                  </span>
                  <div className="text-[9px] text-gray-300 font-bold mt-1 uppercase">{item.method}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
