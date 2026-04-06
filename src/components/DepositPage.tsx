import React, { useState, useEffect } from 'react';
import { ChevronLeft, Upload, Info, CheckCircle2, Loader2, History, Smartphone, CreditCard, Landmark } from 'lucide-react';
import { doc, onSnapshot, collection, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';

export default function DepositPage({ onBack, onViewHistory, balance, user, playSound }: { onBack: () => void, onViewHistory: () => void, balance: number, user: any, playSound: (type: any) => void }) {
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<'bank' | 'easypaisa' | 'jazzcash'>('easypaisa');
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [adminPaymentMethods, setAdminPaymentMethods] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'paymentMethods'), (snapshot) => {
      if (snapshot.exists()) {
        setAdminPaymentMethods(snapshot.data());
      }
    });
    return () => unsubscribe();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProcessingImage(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setScreenshot(canvas.toDataURL('image/jpeg', 0.7));
          setProcessingImage(false);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNextStep = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 300) {
      alert("Minimum deposit amount is Rs 300");
      return;
    }
    if ((method === 'easypaisa' || method === 'jazzcash') && numAmount > 10000) {
      alert(`Maximum deposit for ${method === 'easypaisa' ? 'Easypaisa' : 'JazzCash'} is Rs 10,000. For larger amounts, please use Bank Transfer.`);
      return;
    }
    setStep(2);
  };

  const handleDeposit = async () => {
    if (!screenshot) {
      alert("Please upload a payment screenshot.");
      return;
    }

    setLoading(true);
    try {
      const numAmount = parseFloat(amount);
      const depositRef = doc(collection(db, 'deposits'));
      await setDoc(depositRef, {
        userId: user.uid,
        userEmail: user.email,
        amount: numAmount,
        method,
        screenshotBase64: screenshot,
        status: 'pending',
        timestamp: Date.now()
      });

      playSound('notify');
      alert(`Deposit request of Rs ${numAmount} submitted successfully! It is now pending admin approval.`);
      onBack();
    } catch (error: any) {
      console.error("Deposit failed:", error);
      alert("Deposit failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const paymentMethods = [
    { 
      id: 'easypaisa', 
      name: 'Easypaisa', 
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Easypaisa_logo.png/640px-Easypaisa_logo.png',
      icon: Smartphone,
      color: 'bg-green-50 border-green-200 text-green-600'
    },
    { 
      id: 'jazzcash', 
      name: 'JazzCash', 
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/JazzCash_logo.png/640px-JazzCash_logo.png',
      icon: CreditCard,
      color: 'bg-yellow-50 border-yellow-200 text-yellow-600'
    },
    { 
      id: 'bank', 
      name: 'Bank Transfer', 
      icon: Landmark,
      color: 'bg-blue-50 border-blue-200 text-blue-600'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col pb-10">
      {/* Header */}
      <div className="bg-[#00c853] p-6 text-white flex flex-col items-center relative rounded-b-[2.5rem] shadow-lg">
        <button 
          onClick={() => step === 2 ? setStep(1) : onBack()} 
          className="absolute left-4 top-6 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <button 
          onClick={onViewHistory} 
          className="absolute right-4 top-6 p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-1"
        >
          <History size={20} />
          <span className="text-[10px] font-black uppercase tracking-tighter">History</span>
        </button>
        <h1 className="text-xl font-black uppercase tracking-widest mb-6">Deposit Funds</h1>
        
        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-4 shadow-inner border border-white/30">
          <Upload size={40} className="text-white drop-shadow-md" />
        </div>
        
        <div className="text-4xl font-black mb-1 drop-shadow-sm">Rs {balance.toFixed(2)}</div>
        <div className="text-[10px] opacity-80 font-bold uppercase tracking-[0.2em]">Current Balance</div>
      </div>

      <div className="px-4 -mt-6 relative z-10 space-y-6">
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-gray-100">
          {step === 1 ? (
            <>
              <div className="mb-6">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Enter Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">Rs</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Minimum 300"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#00c853] focus:bg-white transition-all outline-none font-black text-xl text-gray-800 placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Select Payment Method</label>
                <div className="grid grid-cols-1 gap-3">
                  {paymentMethods.map((pm) => (
                    <button 
                      key={pm.id}
                      onClick={() => setMethod(pm.id as any)}
                      className={cn(
                        "p-4 rounded-2xl border-2 flex items-center gap-4 transition-all active:scale-[0.98]",
                        method === pm.id ? "border-[#00c853] bg-green-50/50 shadow-sm" : "bg-white border-gray-100 grayscale opacity-60"
                      )}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-sm overflow-hidden bg-white")}>
                        {pm.logo ? (
                          <img src={pm.logo} alt={pm.name} className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <pm.icon size={24} className="text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-black text-gray-800">{pm.name}</div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                          {pm.id === 'bank' ? 'No Maximum Limit' : 'Max Limit: Rs 10,000'}
                        </div>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                        method === pm.id ? "border-[#00c853] bg-[#00c853]" : "border-gray-200"
                      )}>
                        {method === pm.id && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                disabled={!amount}
                onClick={handleNextStep}
                className="w-full bg-[#00c853] text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-green-100 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none"
              >
                Next Step
              </button>
            </>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Transfer Details</label>
                <div className="bg-gray-50 p-5 rounded-2xl border-2 border-gray-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Method</span>
                    <span className="text-xs font-black text-gray-800 uppercase">{method}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Account Name</span>
                    <span className="text-xs font-black text-gray-800">{adminPaymentMethods?.[method]?.accountName || 'Not Set'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Account Number</span>
                    <span className="text-xs font-black text-gray-800 tracking-wider">{adminPaymentMethods?.[method]?.accountNumber || 'Not Set'}</span>
                  </div>
                  {method === 'bank' && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Bank Name</span>
                      <span className="text-xs font-black text-gray-800">{adminPaymentMethods?.bank?.bankName || 'Not Set'}</span>
                    </div>
                  )}
                  <div className="pt-3 mt-3 border-t-2 border-gray-100 flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Amount to Transfer</span>
                    <span className="text-xl font-black text-[#00c853]">Rs {amount}</span>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Upload Screenshot</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="hidden"
                    id="screenshot-upload"
                  />
                  <label 
                    htmlFor="screenshot-upload"
                    className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {screenshot ? (
                      <div className="w-full h-40 rounded-xl overflow-hidden shadow-sm">
                        <img src={screenshot} alt="Payment Screenshot" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <>
                        <Upload size={32} className="text-gray-300 mb-2" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Click to upload screenshot</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <button 
                disabled={loading || processingImage || !screenshot}
                onClick={handleDeposit}
                className="w-full bg-[#00c853] text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-green-100 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {loading || processingImage ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Deposit'
                )}
              </button>
            </>
          )}
        </div>

        <div className="bg-blue-50 border-2 border-blue-100 rounded-[2rem] p-6 flex gap-4">
          <Info className="text-blue-500 shrink-0" size={24} />
          <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
            Please ensure you transfer the exact amount entered. Deposits are usually processed within 5-30 minutes. For Bank Transfers, please contact support if not credited within 1 hour.
          </p>
        </div>
      </div>
    </div>
  );
}
