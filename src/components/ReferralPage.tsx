import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Users, 
  User, 
  Copy, 
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError } from '../App';
import { OperationType } from '../types';

export default function ReferralPage({ onBack, user }: { onBack: () => void, user: any }) {
  const referralLink = `${window.location.origin}?ref=${user.uid}`;
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentCommissions, setRecentCommissions] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('referredBy', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReferredUsers(users);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('type', '==', 'referral_bonus'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentCommissions(commissions);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });
    return () => unsubscribe();
  }, [user.uid]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    alert("Referral link copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col pb-20">
      {/* Header */}
      <div className="bg-[#00c853] p-6 text-white flex flex-col items-center relative">
        <button onClick={onBack} className="absolute left-4 top-6">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold mb-6">Referral Program</h1>
        
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
          <Users size={32} className="text-white" />
        </div>
        
        <div className="text-3xl font-black mb-1">10% Commission</div>
        <div className="text-xs opacity-80 mb-2 font-bold uppercase tracking-widest">Earn on every investment</div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-4 relative z-10 grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center">
          <div className="text-2xl font-black text-green-600">{referredUsers.length}</div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Total Referrals</div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center">
          <div className="text-2xl font-black text-orange-600">Rs {(user.referralEarnings || 0).toFixed(2)}</div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Total Earnings</div>
        </div>
      </div>

      {/* Referral Link Card */}
      <div className="p-4 mt-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Your Referral Link</h2>
          <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
            <div className="text-[10px] font-mono text-gray-500 truncate flex-1">{referralLink}</div>
            <button onClick={copyToClipboard} className="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors">
              <Copy size={18} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
            Share this link with your friends. When they register and buy an investment plan, you will receive a 10% commission of their investment amount directly in your wallet.
          </p>
        </div>
      </div>

      {/* Recent Commissions */}
      {recentCommissions.length > 0 && (
        <div className="p-4">
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 px-2">Recent Commissions</h2>
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-50 shadow-sm">
            <div className="divide-y divide-gray-50">
              {recentCommissions.map((comm, i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                      <TrendingUp size={18} className="text-green-600" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-gray-800">Rs {comm.amount}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">From {comm.fromUser?.split('@')[0]}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400">{new Date(comm.timestamp).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Referred Users List */}
      <div className="p-4">
        <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 px-2">Your Referrals ({referredUsers.length})</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="animate-spin text-green-600" size={24} />
          </div>
        ) : referredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={20} className="text-gray-300" />
            </div>
            <p className="text-xs text-gray-400 font-bold">No referrals yet. Start sharing!</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-50 shadow-sm">
            <div className="divide-y divide-gray-50">
              {referredUsers.map((refUser) => (
                <div key={refUser.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                      <User size={18} className="text-gray-400" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-gray-800">{refUser.email.split('@')[0]}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">Joined {new Date(refUser.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Balance</div>
                    <div className="text-xs font-black text-green-600">Rs {refUser.balance?.toFixed(2) || '0.00'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
