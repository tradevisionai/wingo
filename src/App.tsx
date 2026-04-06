import React, { useState, useEffect, useRef, Component, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import WithdrawalPage from './components/WithdrawalPage';
import WithdrawalHistoryPage from './components/WithdrawalHistoryPage';
import DepositPage from './components/DepositPage';
import DepositHistoryPage from './components/DepositHistoryPage';
import WalletPage from './components/WalletPage';
import ReferralPage from './components/ReferralPage';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Bell, Timer, Trophy, History, ChevronLeft, Info, RefreshCw, Play, User, LogIn, UserPlus, ChevronRight, Star, Shield, Zap, ExternalLink, UserMinus, Eye, EyeOff, CreditCard, Receipt, Download, Upload, Copy, Users, Volume2, VolumeX, Trash2, Ban, CheckCircle, Plus, Minus } from 'lucide-react';
import { cacheData, getCachedData } from './lib/cache';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup } from 'firebase/auth';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, orderBy, limit, getDocFromServer, increment, deleteDoc, getDocs, addDoc } from 'firebase/firestore';
import { OperationType, type FirestoreErrorInfo, type GameResult, type GameMode } from './types';


export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      let displayMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse((this as any).state.error.message);
        if (parsedError.error) {
          displayMessage = `Database Error: ${parsedError.error}`;
        }
      } catch (e) {
        displayMessage = (this as any).state.error.message || displayMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
            <p className="text-gray-600 mb-6">{displayMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [view, setView] = useState<'landing' | 'game' | 'login' | 'register' | 'admin' | 'wallet' | 'referral' | 'stats' | 'deposit' | 'withdraw' | 'withdrawalHistory'>('landing');
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const viewRef = useRef(view);
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const lastShownBetId = useRef<string | number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
      console.log("Referral code detected:", ref);
    }
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Real-time user data listener
  useEffect(() => {
    if (user?.uid) {
      console.log("Setting up real-time listener for user:", user.uid);
      
      // Load from cache first
      const cachedUser = getCachedData(`user_${user.uid}`);
      if (cachedUser) {
        setUser((prev: any) => ({ ...prev, ...cachedUser }));
        setBalance(cachedUser.balance || 0);
      }

      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          console.log("Real-time user data update:", userData);
          cacheData(`user_${user.uid}`, { ...userData }); // Cache new data
          const finalRole = user.email === 'wppgrouplinks@gmail.com' ? 'admin' : (userData.role || 'user');
          setUser((prev: any) => ({ ...prev, ...userData, role: finalRole }));
          setBalance(userData.balance || 0);
        }
      }, (error) => {
        console.warn("Firestore quota exceeded, using local cache.");
      });
      return () => unsubscribe();
    }
  }, [user?.uid]);
  const [activeMode, setActiveMode] = useState<GameMode>('30s');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [period, setPeriod] = useState<number>(0);
  const [history, setHistory] = useState<GameResult[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [userBets, setUserBets] = useState<any[]>([]);
  const [tab, setTab] = useState<'game' | 'my-bets' | 'auto-bet'>('game');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [historyFilterDate, setHistoryFilterDate] = useState('');
  const [betsFilterDate, setBetsFilterDate] = useState('');
  const [betsFilterType, setBetsFilterType] = useState('');
  const [betsFilterStatus, setBetsFilterStatus] = useState('');
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(1);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [isBetting, setIsBetting] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [settledBet, setSettledBet] = useState<any>(null);
  const [betSelection, setBetSelection] = useState<{ type: string, value: any } | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [betError, setBetError] = useState("");
  const [autoCloseTimer, setAutoCloseTimer] = useState<number>(5);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('soundEnabled', soundEnabled.toString());
  }, [soundEnabled]);

  const playSound = (type: 'bet' | 'win' | 'loss' | 'notify' | 'click') => {
    if (!soundEnabled) return;
    
    const sounds = {
      bet: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      loss: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
      notify: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
      click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
    };
    
    const audio = new Audio(sounds[type]);
    audio.volume = type === 'click' ? 0.2 : 0.4;
    audio.play().catch(e => console.warn("Sound playback failed", e));
  };

  // Auto Bet State
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const [autoBetConfig, setAutoBetConfig] = useState<{
    type: string;
    value: any;
    amount: number;
    multiplier: number;
    rounds: number;
    stopWin: number;
    stopLoss: number;
    currentRounds: number;
    startBalance: number;
  }>({
    type: 'color',
    value: 'green',
    amount: 10,
    multiplier: 1,
    rounds: 0,
    stopWin: 0,
    stopLoss: 0,
    currentRounds: 0,
    startBalance: 0
  });

  const multipliers = [1, 5, 10, 20, 50, 100];
  const betAmounts = [1, 10, 100, 1000];
  const gameModes: { id: GameMode; label: string }[] = [
    { id: '30s', label: 'WinGo 30sec' },
    { id: '1m', label: 'WinGo 1 Min' },
    { id: '3m', label: 'WinGo 3 Min' },
    { id: '5m', label: 'WinGo 5 Min' },
  ];

  // Connection test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Auto-close result modal
  useEffect(() => {
    let timer: any;
    if (showResultModal && autoCloseTimer > 0) {
      timer = setInterval(() => {
        setAutoCloseTimer(prev => prev - 1);
      }, 1000);
    } else if (autoCloseTimer === 0) {
      setShowResultModal(false);
    }
    return () => clearInterval(timer);
  }, [showResultModal, autoCloseTimer]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.uid);
      setIsAuthReady(true);
      if (firebaseUser) {
        try {
          const cachedUser = getCachedData(`user_${firebaseUser.uid}`);
          if (cachedUser) {
            console.log("Using cached user data:", cachedUser);
            setUser({ ...firebaseUser, ...cachedUser });
            setBalance(cachedUser.balance || 0);
          } else {
            console.log("Fetching user data from Firestore...");
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              console.log("User data found:", userData);
              cacheData(`user_${firebaseUser.uid}`, { ...userData });
              const finalRole = firebaseUser.email === 'wppgrouplinks@gmail.com' ? 'admin' : (userData.role || 'user');
              setUser({ ...firebaseUser, ...userData, role: finalRole });
              setBalance(userData.balance || 0);
            } else {
              console.log("User data not found, auto-initializing...");
              const newUser = {
                email: firebaseUser.email,
                balance: 0,
                role: firebaseUser.email === 'wppgrouplinks@gmail.com' ? 'admin' : 'user',
                isBlocked: false,
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              cacheData(`user_${firebaseUser.uid}`, { ...newUser });
              setUser({ ...firebaseUser, ...newUser });
              setBalance(0);
            }
          }
          
          if (viewRef.current === 'landing' || viewRef.current === 'login' || viewRef.current === 'register') {
            setView('game');
          }
        } catch (error) {
          console.warn("Error fetching user data. Quota might be exceeded.");
          const finalRole = firebaseUser.email === 'wppgrouplinks@gmail.com' ? 'admin' : 'user';
          setUser({ ...firebaseUser, role: finalRole });
          if (viewRef.current === 'landing' || viewRef.current === 'login' || viewRef.current === 'register') {
            setView('game');
          }
        }
      } else {
        console.log("No user logged in");
        setUser(null);
        setBalance(0);
        if (viewRef.current !== 'landing' && viewRef.current !== 'login' && viewRef.current !== 'register') {
          setView('landing');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch initial data
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          console.log("Server health check OK:", data);
          setServerStatus('online');
        } else {
          console.error("Server health check failed:", res.status);
          setServerStatus('offline');
        }
      } catch (e) {
        console.error("Server health check network error:", e);
        setServerStatus('offline');
      }
    };
    checkHealth();
    if (user) {
      fetchUserBets();
    }
    fetchGameState();
    fetchHistory();
    setHistoryPage(0);
  }, [activeMode, user]);

  // Polling for game state
  useEffect(() => {
    const interval = setInterval(() => {
      fetchGameState();
    }, timeLeft === 0 ? 200 : (timeLeft <= 5 ? 500 : 1000));
    return () => clearInterval(interval);
  }, [activeMode, timeLeft]);

  // Fetch history when period changes (new round)
  useEffect(() => {
    if (period > 0) {
      fetchHistory();
      fetchUserBets();
      
      // Retry after 1s to ensure Firestore is updated
      const timer = setTimeout(() => {
        fetchHistory();
        fetchUserBets();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [period, activeMode]);

  // Auto Bet Logic
  useEffect(() => {
    if (isAutoBetting && autoBetConfig && timeLeft > 10 && timeLeft < 25) {
      // Check if we already placed a bet for this period
      const alreadyBet = userBets.some(b => b.mode === activeMode && b.period === period);
      if (!alreadyBet) {
        // Check thresholds
        const currentProfit = balance - autoBetConfig.startBalance;
        if (autoBetConfig.rounds > 0 && autoBetConfig.currentRounds >= autoBetConfig.rounds) {
          setIsAutoBetting(false);
          return;
        }
        if (autoBetConfig.stopWin > 0 && currentProfit >= autoBetConfig.stopWin) {
          setIsAutoBetting(false);
          return;
        }
        if (autoBetConfig.stopLoss > 0 && currentProfit <= -autoBetConfig.stopLoss) {
          setIsAutoBetting(false);
          return;
        }

        // Place the bet
        const totalAmount = autoBetConfig.amount * autoBetConfig.multiplier;
        if (balance >= totalAmount) {
          handleAutoPlaceBet();
        } else {
          setIsAutoBetting(false);
        }
      }
    }
  }, [isAutoBetting, timeLeft, period]);

  const handleAutoPlaceBet = async () => {
    if (!autoBetConfig) return;
    if (!user) {
      console.error("Auto bet failed: User not logged in");
      setIsAutoBetting(false);
      return;
    }
    const totalAmount = autoBetConfig.amount * autoBetConfig.multiplier;
    
    try {
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: activeMode,
          amount: totalAmount,
          type: autoBetConfig.type,
          value: autoBetConfig.value,
          userId: user.uid
        })
      });
      if (res.ok) {
        // const data = await res.json();
        // setBalance(data.balance); // Removed to prevent race condition with onSnapshot
        setAutoBetConfig(prev => prev ? { ...prev, currentRounds: prev.currentRounds + 1 } : null);
        fetchUserBets();
        playSound('bet');
      }
    } catch (e) {
      console.error("Auto bet failed", e);
      setIsAutoBetting(false);
    }
  };

  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> => {
    try {
      const res = await fetch(url, { ...options, cache: 'no-store' });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
      }
      return res;
    } catch (e) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 1.5);
      }
      throw e;
    }
  };

  const fetchGameState = async () => {
    if (!activeMode) return;
    const url = `/api/game-state/${activeMode}`;
    try {
      // Increase retries for game state to be more resilient during server restarts
      const res = await fetchWithRetry(url, {}, 3, 1000); 
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new TypeError(`Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      setTimeLeft(prev => {
        if (prev > 0 && data.timeLeft === 0) {
          playSound('notify');
        }
        return data.timeLeft;
      });
      setPeriod(data.period);
      setServerStatus('online');
      
      // If a new result just came in or timer hit 0
      if (data.timeLeft === 0 || (data.lastResult && (!lastResult || data.lastResult.period !== lastResult.period))) {
        setTimeout(() => {
          fetchUserBets();
          fetchHistory();
        }, 500);
      }

      if (data.lastResult && (!lastResult || data.lastResult.period !== lastResult.period)) {
        setLastResult(data.lastResult);
      }
    } catch (e) {
      // Only log as error if we've been offline for a while
      if (serverStatus === 'online') {
        console.warn(`[App] Failed to fetch game state from ${url}:`, e);
      }
      setServerStatus('offline');
    }
  };

  const fetchHistory = async () => {
    const url = `/api/history/${activeMode}`;
    try {
      const res = await fetchWithRetry(url);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new TypeError(`Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.warn(`[App] Failed to fetch history from ${url}:`, e);
    }
  };

  const fetchUserBets = async () => {
    if (!user?.uid) return;
    const url = `/api/user-bets?userId=${user.uid}`;
    try {
      const res = await fetchWithRetry(url);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new TypeError(`Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      
      setUserBets(prevBets => {
        // Check if any bet was just settled
        if (data.length > 0) {
          // Find any bet that was pending in our local state but is now settled in the new data
          // OR a new bet that is settled and we haven't shown a modal for it yet
          const newlySettled = data.find(newBet => {
            const oldBet = prevBets.find(b => b.id === newBet.id);
            const isTransition = oldBet && oldBet.status === 'pending' && newBet.status !== 'pending';
            const isNewAndSettled = !oldBet && newBet.status !== 'pending' && newBet.id !== lastShownBetId.current;
            
            return (isTransition || isNewAndSettled) && (newBet.status === 'win' || newBet.status === 'loss');
          });

          if (newlySettled) {
            lastShownBetId.current = newlySettled.id;
            setSettledBet(newlySettled);
            setAutoCloseTimer(5);
            setShowResultModal(true);
            if (newlySettled.status === 'win') {
              playSound('win');
              
              // Update balance in Firestore
              const paidOutBets = JSON.parse(localStorage.getItem('paidOutBets') || '[]');
              if (!paidOutBets.includes(newlySettled.id)) {
                paidOutBets.push(newlySettled.id);
                localStorage.setItem('paidOutBets', JSON.stringify(paidOutBets.slice(-50))); // Keep last 50
                
                const userRef = doc(db, 'users', user.uid);
                updateDoc(userRef, {
                  balance: increment(newlySettled.winAmount)
                }).catch(err => console.error("Failed to update win balance:", err));
              }
            } else {
              playSound('loss');
            }
          }
        }
        return data;
      });
    } catch (e) {
      console.warn(`[App] Failed to fetch user bets from ${url}:`, e);
    }
  };

  const openBetModal = (type: string, value: any) => {
    if (timeLeft <= 5) return;
    setBetError("");
    setBetSuccess(false);
    setBetSelection({ type, value });
    setShowBetModal(true);
  };

  const handlePlaceBet = async () => {
    if (!betSelection) return;
    if (!user) {
      setBetError("Please login to place a bet!");
      return;
    }
    setBetError("");
    setBetSuccess(false);
    const totalAmount = betAmount * selectedMultiplier;
    if (totalAmount <= 0) {
      setBetError("Please enter a valid amount!");
      return;
    }
    if (balance < totalAmount) {
      setBetError("Insufficient balance!");
      return;
    }

    setIsBetting(true);
    try {
      // Deduct balance in Firestore first
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: balance - totalAmount
      });
      setBalance(prev => prev - totalAmount);

      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: activeMode,
          amount: totalAmount,
          type: betSelection.type,
          value: betSelection.value,
          userId: user.uid,
          userEmail: user.email
        })
      });
      const data = await res.json();
      console.log("Bet response:", data);
      if (res.ok) {
        fetchUserBets();
        setBetSuccess(true);
        playSound('bet');
        
        // Close modal after 1.5s to show confirmation
        setTimeout(() => {
          setShowBetModal(false);
          setBetSuccess(false);
        }, 1500);
      } else {
        // Refund balance if server fails
        await updateDoc(userRef, {
          balance: balance
        });
        setBalance(balance);
        setBetError(data.error || "Failed to place bet");
      }
    } catch (e) {
      console.error("Bet failed", e);
      setBetError("Connection error. Please try again.");
    } finally {
      setIsBetting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="text-green-500 animate-spin" size={48} />
          <span className="text-white font-bold tracking-widest uppercase text-xs">Loading WinGo Pro...</span>
        </div>
      </div>
    );
  }

  const getNumberColor = (num: number) => {
    if ([1, 3, 7, 9].includes(num)) return 'bg-green-500';
    if ([2, 4, 6, 8].includes(num)) return 'bg-red-500';
    if (num === 0) return 'bg-gradient-to-r from-red-500 to-purple-500';
    if (num === 5) return 'bg-gradient-to-r from-green-500 to-purple-500';
    return 'bg-gray-500';
  };

  if (view === 'landing') {
    return <LandingPage onStart={() => user ? setView('game') : setView('login')} onLogin={() => setView('login')} onRegister={() => setView('register')} />;
  }

  if (view === 'login') {
    return <LoginPage onBack={() => setView('landing')} onRegister={() => setView('register')} onLoginSuccess={(u) => { 
      const finalRole = u.email === 'wppgrouplinks@gmail.com' ? 'admin' : (u.role || 'user');
      setUser({ ...u, role: finalRole }); 
      setView('game'); 
    }} playSound={playSound} />;
  }

  if (view === 'register') {
    return <RegisterPage onBack={() => setView('landing')} onLogin={() => setView('login')} onRegisterSuccess={(u) => { 
      const finalRole = u.email === 'wppgrouplinks@gmail.com' ? 'admin' : (u.role || 'user');
      setUser({ ...u, role: finalRole }); 
      setView('game'); 
    }} referralCode={referralCode} playSound={playSound} />;
  }

  if (user?.isBlocked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[3rem] p-12 text-center max-w-md shadow-2xl"
        >
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <Ban className="text-red-600" size={48} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 uppercase tracking-tighter">Account Blocked</h1>
          <p className="text-gray-500 font-bold mb-8 leading-relaxed">
            Your account has been suspended by the administrator. Please contact support if you believe this is a mistake.
          </p>
          <button 
            onClick={() => signOut(auth)}
            className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
          >
            Logout
          </button>
        </motion.div>
      </div>
    );
  }

  if (view === 'admin') {
    return <AdminPanel onBack={() => setView('game')} />;
  }

  if (view === 'stats') {
    return <StatsPage onBack={() => setView('game')} history={history} />;
  }

  if (view === 'wallet') {
    return <WalletPage onBack={() => setView('game')} balance={balance} setView={setView} user={user} playSound={playSound} />;
  }

  if (view === 'deposit') {
    return <DepositPage onBack={() => setView('wallet')} onViewHistory={() => setView('depositHistory')} balance={balance} user={user} playSound={playSound} />;
  }

  if (view === 'depositHistory') {
    return <DepositHistoryPage onBack={() => setView('wallet')} user={user} />;
  }

  if (view === 'withdraw') {
    return <WithdrawalPage onBack={() => setView('wallet')} onViewHistory={() => setView('withdrawalHistory')} balance={balance} user={user} playSound={playSound} />;
  }

  if (view === 'withdrawalHistory') {
    return <WithdrawalHistoryPage onBack={() => setView('wallet')} user={user} />;
  }

  if (view === 'referral') {
    return <ReferralPage onBack={() => setView('game')} user={user} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-20">
      {/* Countdown Overlay */}
      <AnimatePresence>
        {timeLeft <= 5 && timeLeft > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl pointer-events-none overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-radial-gradient from-red-500/20 to-transparent opacity-50"></div>
            
            <div className="relative">
              {/* Circular Progress Ring */}
              <svg className="w-64 h-64 -rotate-90">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-white/10"
                />
                <motion.circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray="754"
                  initial={{ strokeDashoffset: 754 }}
                  animate={{ strokeDashoffset: 754 - (754 * timeLeft / 5) }}
                  transition={{ duration: 1, ease: "linear" }}
                  className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                  strokeLinecap="round"
                />
              </svg>

              {/* Countdown Number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div 
                  key={timeLeft}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  className="text-[10rem] font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                >
                  {timeLeft}
                </motion.div>
              </div>
            </div>

            {/* Status Text */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-8 flex flex-col items-center"
            >
              <div className="px-6 py-2 bg-red-600 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-400">
                <span className="text-xl font-black text-white uppercase tracking-[0.2em] animate-pulse">
                  Betting Locked
                </span>
              </div>
              <p className="mt-4 text-white/60 text-sm font-bold uppercase tracking-widest">
                Waiting for result...
              </p>
            </motion.div>

            {/* Decorative Particles/Lines */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [0, 0.5, 0],
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity, 
                    delay: i * 0.5 
                  }}
                  className="absolute border border-white/5 rounded-full"
                  style={{
                    width: `${(i + 1) * 150}px`,
                    height: `${(i + 1) * 150}px`,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet Selection Modal */}
      <AnimatePresence>
        {showBetModal && betSelection && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBetModal(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-[2.5rem] w-full max-w-md p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Select Bet</h3>
                <div className={cn(
                  "px-4 py-1 rounded-full text-white text-xs font-bold uppercase",
                  betSelection.type === 'color' ? (betSelection.value === 'green' ? 'bg-green-500' : betSelection.value === 'red' ? 'bg-red-500' : 'bg-purple-500') :
                  betSelection.type === 'size' ? (betSelection.value === 'Big' ? 'bg-orange-400' : 'bg-blue-400') :
                  getNumberColor(betSelection.value)
                )}>
                  {betSelection.value}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-xs text-gray-400 font-bold uppercase mb-3">Amount</div>
                  <div className="flex gap-2 mb-3">
                    {betAmounts.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => {
                          setBetAmount(amt);
                          playSound('click');
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
                          betAmount === amt ? "bg-green-600 text-white shadow-md" : "bg-gray-100 text-gray-400"
                        )}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-bold uppercase whitespace-nowrap">Custom:</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rs</span>
                      <input 
                        type="number" 
                        min="1"
                        value={betAmount || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setBetAmount(isNaN(val) ? 0 : val);
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-8 pr-3 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none transition-all"
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 font-bold uppercase mb-3">Multiplier</div>
                  <div className="flex flex-wrap gap-2">
                    {multipliers.map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setSelectedMultiplier(m);
                          playSound('click');
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                          selectedMultiplier === m ? "bg-green-600 text-white shadow-md" : "bg-gray-100 text-gray-400"
                        )}
                      >
                        X{m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
                  <div className="text-xs text-gray-500 font-medium">Total Bet Amount</div>
                  <div className="text-xl font-black text-green-600">Rs {(betAmount * selectedMultiplier).toFixed(2)}</div>
                </div>

                {betError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold animate-pulse">
                    {betError}
                  </div>
                )}

                {betSuccess && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl text-center"
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <CheckCircle size={20} />
                      <span className="font-black uppercase tracking-tight">Bet Placed!</span>
                    </div>
                    <div className="text-[10px] font-bold opacity-80">
                      Rs {(betAmount * selectedMultiplier).toFixed(2)} on {betSelection.value}
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setShowBetModal(false)}
                    className="bg-gray-100 text-gray-500 font-bold py-4 rounded-2xl active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isBetting}
                    onClick={handlePlaceBet}
                    className="bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isBetting ? "Placing..." : "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Modal */}
      <AnimatePresence>
        {showResultModal && settledBet && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex flex-col items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0, y: 100 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 100 }}
              className="relative w-full max-w-[320px]"
            >
              {/* Header Icon/Decoration */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20">
                <div className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white",
                  settledBet.status === 'win' ? "bg-gradient-to-b from-orange-300 to-orange-500" : "bg-gradient-to-b from-gray-300 to-gray-500"
                )}>
                  {settledBet.status === 'win' ? (
                    <Trophy size={48} className="text-white drop-shadow-lg" />
                  ) : (
                    <div className="text-5xl">😞</div>
                  )}
                </div>
                {/* Wings/Rays effect */}
                <div className="absolute inset-0 bg-white/20 rounded-full blur-xl -z-10 animate-pulse"></div>
              </div>

              {/* Main Card */}
              <div className={cn(
                "rounded-[2.5rem] pt-16 pb-8 px-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden",
                settledBet.status === 'win' ? "bg-gradient-to-b from-orange-400 to-orange-600" : "bg-gradient-to-b from-gray-600 to-gray-800"
              )}>
                {/* Ribbon */}
                <div className="absolute top-14 left-1/2 -translate-x-1/2 w-full px-4">
                  <div className="bg-orange-200/20 backdrop-blur-sm py-1 rounded-full border border-white/20">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-md">
                      {settledBet.status === 'win' ? "Congratulations" : "Loss"}
                    </h2>
                  </div>
                </div>

                {/* Lottery Results Row */}
                <div className="mt-12 flex items-center justify-center gap-2 mb-6">
                  <span className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Lottery results</span>
                  <div className={cn("px-3 py-0.5 rounded-full text-white text-[10px] font-bold", getNumberColor(settledBet.result.number))}>
                    {settledBet.result.colors.join(' ')}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-white text-orange-600 flex items-center justify-center text-xs font-black shadow-inner">
                    {settledBet.result.number}
                  </div>
                  <div className="px-3 py-0.5 rounded-full bg-green-500 text-white text-[10px] font-bold">
                    {settledBet.result.bigSmall}
                  </div>
                </div>

                {/* Bonus Receipt Section */}
                <div className="relative mt-4">
                  {/* The "Slot" */}
                  <div className="bg-black/20 h-4 w-full rounded-full mb-[-8px] relative z-0"></div>
                  
                  {/* The Receipt */}
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    className="bg-white rounded-2xl p-4 shadow-xl relative z-10 mx-2"
                  >
                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">
                      {settledBet.status === 'win' ? "Bonus" : "Result"}
                    </div>
                    <div className={cn(
                      "text-2xl font-black mb-2",
                      settledBet.status === 'win' ? "text-orange-500" : "text-gray-400"
                    )}>
                      {settledBet.status === 'win' ? `Rs ${settledBet.winAmount.toFixed(2)}` : "No Bonus"}
                    </div>
                    <div className="text-[9px] text-gray-400 font-medium">
                      Period: {activeMode === '30s' ? '30 seconds' : activeMode === '1m' ? '1 minute' : activeMode === '3m' ? '3 minutes' : '5 minutes'} {settledBet.period}
                    </div>
                  </motion.div>
                </div>

                {/* Auto Close Text */}
                <div className="mt-6 flex items-center justify-center gap-2 text-white/60 text-[10px] font-bold uppercase">
                  <RefreshCw size={12} className="animate-spin-slow" />
                  {autoCloseTimer} seconds auto close
                </div>
              </div>

              {/* Close Button below */}
              <button 
                onClick={() => setShowResultModal(false)}
                className="mt-6 w-12 h-12 rounded-full border-2 border-white/50 flex items-center justify-center text-white hover:bg-white/10 transition-colors mx-auto"
              >
                <div className="text-2xl font-light">✕</div>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-gradient-to-b from-green-600 to-green-500 p-4 text-white rounded-b-[2rem] shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <div className="text-xl font-bold tracking-wider italic">92PKR</div>
            <div className="flex items-center gap-1 mt-1">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                serverStatus === 'online' ? "bg-green-300 shadow-[0_0_5px_rgba(134,239,172,0.8)]" : 
                serverStatus === 'checking' ? "bg-yellow-300 animate-pulse" : "bg-red-400 animate-pulse"
              )} />
              <span className="text-[8px] font-bold uppercase tracking-tighter opacity-80">
                {serverStatus === 'online' ? 'Connected' : serverStatus === 'checking' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <div 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="cursor-pointer hover:bg-white/10 p-1 rounded-full transition-colors"
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} className="text-white/50" />}
            </div>
            <RefreshCw size={20} className="cursor-pointer hover:rotate-180 transition-transform duration-500" />
            <Info size={20} className="cursor-pointer" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-4 border border-white/20">
          <div className="flex items-center gap-2 text-green-100 mb-1">
            <Wallet size={16} />
            <span className="text-sm font-medium uppercase tracking-wider">Wallet Balance</span>
          </div>
          <div className="text-3xl font-bold mb-6">Rs {balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</div>
          
          <div className="grid grid-cols-3 gap-3">
            <button 
              onClick={() => setView('withdraw')}
              className="flex flex-col items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/10"
            >
              <ArrowUpCircle size={20} />
              <span className="text-[10px] uppercase tracking-widest">Withdraw</span>
            </button>
            <button 
              onClick={() => setView('deposit')}
              className="flex flex-col items-center justify-center gap-1 bg-white text-green-600 font-bold py-3 rounded-2xl transition-all active:scale-95 shadow-lg"
            >
              <ArrowDownCircle size={20} />
              <span className="text-[10px] uppercase tracking-widest">Deposit</span>
            </button>
            <button 
              onClick={() => setView('referral')}
              className="flex flex-col items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/10"
            >
              <Users size={20} />
              <span className="text-[10px] uppercase tracking-widest">Refer</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notification Banner */}
      <div className="bg-white mx-4 mt-[-1rem] rounded-xl p-3 shadow-sm flex items-center gap-3 overflow-hidden border border-gray-100">
        <Bell size={18} className="text-green-600 flex-shrink-0" />
        <div className="whitespace-nowrap animate-marquee text-sm text-gray-600 font-medium">
          Reminder: All members who register an account on this platform site, please bind your bank card to ensure secure withdrawals.
        </div>
        <button className="bg-green-600 text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-tighter flex-shrink-0">
          Detail
        </button>
      </div>

      {/* Game Modes */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl p-2 shadow-sm grid grid-cols-4 gap-2 border border-gray-100">
          {gameModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setActiveMode(mode.id);
                playSound('click');
              }}
              className={cn(
                "flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-300",
                activeMode === mode.id 
                  ? "bg-green-600 text-white shadow-lg scale-105" 
                  : "text-gray-400 hover:bg-gray-50"
              )}
            >
              <Timer size={24} className={cn("mb-1", activeMode === mode.id ? "text-white" : "text-gray-300")} />
              <span className="text-[10px] font-bold uppercase leading-tight text-center">
                {mode.label.split(' ')[0]}<br/>{mode.label.split(' ').slice(1).join(' ')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Timer Section */}
      <div className="px-4 mt-4">
        <div className="bg-gradient-to-r from-green-500 to-emerald-400 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <button className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 mb-2">
                <Info size={12} /> How to play
              </button>
              <div className="text-xs font-medium opacity-80 mb-1">{gameModes.find(m => m.id === activeMode)?.label}</div>
              <div className="flex gap-1">
                {history.slice(0, 5).map((res, i) => (
                  <div key={i} className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-inner border border-white/20", getNumberColor(res.number))}>
                    {res.number}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold opacity-80 mb-1 uppercase tracking-widest">Time remaining</div>
              <div className="flex gap-1 justify-end">
                {formatTime(timeLeft).split('').map((char, i) => (
                  <div key={i} className={cn(
                    "w-6 h-8 rounded flex items-center justify-center font-mono text-xl font-bold",
                    char === ':' ? "text-white" : "bg-white text-green-600 shadow-sm"
                  )}>
                    {char}
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-mono mt-2 opacity-80">{period}</div>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -left-4 -top-4 w-16 h-16 bg-black/5 rounded-full blur-xl"></div>
        </div>
      </div>

      {/* Betting Panel */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          {/* Color Buttons */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button 
              disabled={isBetting || timeLeft <= 5}
              onClick={() => {
                openBetModal('color', 'green');
                playSound('click');
              }}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              Green
            </button>
            <button 
              disabled={isBetting || timeLeft <= 5}
              onClick={() => {
                openBetModal('color', 'violet');
                playSound('click');
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              Violet
            </button>
            <button 
              disabled={isBetting || timeLeft <= 5}
              onClick={() => {
                openBetModal('color', 'red');
                playSound('click');
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              Red
            </button>
          </div>

          {/* Number Grid */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                disabled={isBetting || timeLeft <= 5}
                onClick={() => {
                  openBetModal('number', num);
                  playSound('click');
                }}
                className={cn(
                  "aspect-square rounded-full flex items-center justify-center text-xl font-bold text-white shadow-md active:scale-90 transition-all border-4 border-white disabled:opacity-50",
                  getNumberColor(num)
                )}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Big / Small */}
          <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <button 
              disabled={isBetting || timeLeft <= 5}
              onClick={() => {
                openBetModal('size', 'Big');
                playSound('click');
              }}
              className="bg-orange-400 hover:bg-orange-500 text-white font-bold py-3 transition-all active:opacity-90 disabled:opacity-50"
            >
              Big
            </button>
            <button 
              disabled={isBetting || timeLeft <= 5}
              onClick={() => {
                openBetModal('size', 'Small');
                playSound('click');
              }}
              className="bg-blue-400 hover:bg-blue-500 text-white font-bold py-3 transition-all active:opacity-90 disabled:opacity-50"
            >
              Small
            </button>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="px-4 mt-6">
        <div className="flex gap-2 mb-3">
          <button 
            onClick={() => {
              setTab('game');
              playSound('click');
            }}
            className={cn("px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all", tab === 'game' ? "bg-green-600 text-white" : "bg-white text-gray-400")}
          >
            Game history
          </button>
          <button 
            onClick={() => {
              setTab('my-bets');
              playSound('click');
            }}
            className={cn("px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all", tab === 'my-bets' ? "bg-green-600 text-white" : "bg-white text-gray-400")}
          >
            My Bets
          </button>
          <button 
            onClick={() => {
              setTab('auto-bet');
              playSound('click');
            }}
            className={cn("px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all", tab === 'auto-bet' ? "bg-green-600 text-white" : "bg-white text-gray-400")}
          >
            Auto Bet
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {tab === 'game' ? (
            <>
              <div className="p-3 bg-gray-50 border-b border-gray-100 flex gap-2">
                <input type="date" value={historyFilterDate} onChange={e => setHistoryFilterDate(e.target.value)} className="text-xs p-1 rounded border border-gray-200" />
                {historyFilterDate && <button onClick={() => setHistoryFilterDate('')} className="text-xs text-red-500 font-bold">Clear</button>}
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-green-600 text-white text-[10px] uppercase tracking-wider">
                    <th className="p-3 font-bold">Period</th>
                    <th className="p-3 font-bold text-center">Number</th>
                    <th className="p-3 font-bold text-center">Big Small</th>
                    <th className="p-3 font-bold text-center">Color</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {history.filter(item => !historyFilterDate || new Date(item.timestamp).toISOString().split('T')[0] === historyFilterDate).slice(historyPage * 5, (historyPage + 1) * 5).map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-mono text-gray-500">{item.period}</td>
                      <td className={cn("p-3 text-center font-bold text-lg", item.colors.includes('green') ? 'text-green-500' : item.colors.includes('red') ? 'text-red-500' : 'text-purple-500')}>
                        {item.number}
                      </td>
                      <td className="p-3 text-center font-medium text-gray-600">{item.bigSmall}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          {item.colors.map((c, i) => (
                            <div key={i} className={cn("w-2 h-2 rounded-full", c === 'green' ? 'bg-green-500' : c === 'red' ? 'bg-red-500' : 'bg-purple-500')}></div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-center items-center gap-4 p-3 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => {
                    setHistoryPage(prev => Math.max(0, prev - 1));
                    playSound('click');
                  }}
                  disabled={historyPage === 0}
                  className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <span className="text-xs font-bold text-gray-500">Page {historyPage + 1}</span>
                <button 
                  onClick={() => {
                    setHistoryPage(prev => (prev + 1) * 5 < history.length ? prev + 1 : prev);
                    playSound('click');
                  }}
                  disabled={(historyPage + 1) * 5 >= history.filter(item => !historyFilterDate || new Date(item.timestamp).toISOString().split('T')[0] === historyFilterDate).length}
                  className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={20} className="text-gray-600" />
                </button>
              </div>
            </>
          ) : tab === 'my-bets' ? (
            <div className="divide-y divide-gray-50">
              <div className="p-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2">
                <input type="date" value={betsFilterDate} onChange={e => setBetsFilterDate(e.target.value)} className="text-xs p-1 rounded border border-gray-200" />
                <select value={betsFilterType} onChange={e => setBetsFilterType(e.target.value)} className="text-xs p-1 rounded border border-gray-200">
                  <option value="">All Types</option>
                  <option value="color">Color</option>
                  <option value="size">Size</option>
                  <option value="number">Number</option>
                </select>
                <select value={betsFilterStatus} onChange={e => setBetsFilterStatus(e.target.value)} className="text-xs p-1 rounded border border-gray-200">
                  <option value="">All Status</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="pending">Pending</option>
                </select>
                {(betsFilterDate || betsFilterType || betsFilterStatus) && <button onClick={() => { setBetsFilterDate(''); setBetsFilterType(''); setBetsFilterStatus(''); }} className="text-xs text-red-500 font-bold">Clear</button>}
              </div>
              {userBets.filter(bet => {
                if (betsFilterDate && new Date(bet.placedAt).toISOString().split('T')[0] !== betsFilterDate) return false;
                if (betsFilterType && bet.type !== betsFilterType) return false;
                if (betsFilterStatus && bet.status !== betsFilterStatus) return false;
                return true;
              }).map((bet, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Period: {bet.period}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-700">Bet: {bet.value}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase">{bet.type}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-sm font-black uppercase tracking-tighter",
                        bet.status === 'win' ? "text-green-600" : bet.status === 'loss' ? "text-red-500" : "text-orange-400"
                      )}>
                        {bet.status === 'win' ? `+Rs ${bet.winAmount.toFixed(2)}` : bet.status === 'loss' ? `-Rs ${bet.amount.toFixed(2)}` : "Pending"}
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">{new Date(bet.placedAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>
              ))}
              {userBets.length === 0 && (
                <div className="p-10 text-center text-gray-400 italic text-xs">No bets placed yet</div>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Auto Bet Settings</h3>
                {isAutoBetting && (
                  <div className="flex items-center gap-2 text-green-600 font-bold text-xs animate-pulse">
                    <RefreshCw size={14} className="animate-spin" />
                    RUNNING ({autoBetConfig?.currentRounds}/{autoBetConfig?.rounds || '∞'})
                  </div>
                )}
              </div>

              {!isAutoBetting ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">Bet Amount</label>
                      <select 
                        className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-green-500"
                        value={autoBetConfig.amount}
                        onChange={(e) => setAutoBetConfig(prev => ({ ...prev, amount: parseInt(e.target.value) }))}
                      >
                        {betAmounts.map(amt => <option key={amt} value={amt}>{amt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">Multiplier</label>
                      <select 
                        className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-green-500"
                        value={autoBetConfig.multiplier}
                        onChange={(e) => setAutoBetConfig(prev => ({ ...prev, multiplier: parseInt(e.target.value) }))}
                      >
                        {multipliers.map(m => <option key={m} value={m}>X{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">Total Rounds (0=∞)</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={autoBetConfig.rounds || ''}
                        className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-green-500"
                        onChange={(e) => setAutoBetConfig(prev => ({ ...prev, rounds: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">Stop if Win {'>'}</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={autoBetConfig.stopWin || ''}
                        className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-green-500"
                        onChange={(e) => setAutoBetConfig(prev => ({ ...prev, stopWin: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">Stop if Loss {'>'}</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={autoBetConfig.stopLoss || ''}
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-green-500"
                      onChange={(e) => setAutoBetConfig(prev => ({ ...prev, stopLoss: parseInt(e.target.value) || 0 }))}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">Target (Bet On)</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <button 
                        onClick={() => setAutoBetConfig(prev => ({ ...prev, type: 'color', value: 'green' }))}
                        className={cn("py-2 rounded-xl text-[10px] font-bold transition-all", autoBetConfig.type === 'color' && autoBetConfig.value === 'green' ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400")}
                      >
                        Green
                      </button>
                      <button 
                        onClick={() => setAutoBetConfig(prev => ({ ...prev, type: 'color', value: 'violet' }))}
                        className={cn("py-2 rounded-xl text-[10px] font-bold transition-all", autoBetConfig.type === 'color' && autoBetConfig.value === 'violet' ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-400")}
                      >
                        Violet
                      </button>
                      <button 
                        onClick={() => setAutoBetConfig(prev => ({ ...prev, type: 'color', value: 'red' }))}
                        className={cn("py-2 rounded-xl text-[10px] font-bold transition-all", autoBetConfig.type === 'color' && autoBetConfig.value === 'red' ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400")}
                      >
                        Red
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setAutoBetConfig(prev => ({ ...prev, type: 'size', value: 'Big' }))}
                        className={cn("py-2 rounded-xl text-xs font-bold transition-all", autoBetConfig.type === 'size' && autoBetConfig.value === 'Big' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400")}
                      >
                        Big
                      </button>
                      <button 
                        onClick={() => setAutoBetConfig(prev => ({ ...prev, type: 'size', value: 'Small' }))}
                        className={cn("py-2 rounded-xl text-xs font-bold transition-all", autoBetConfig.type === 'size' && autoBetConfig.value === 'Small' ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-400")}
                      >
                        Small
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-100 p-4 rounded-xl mb-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-500 font-bold uppercase">Total Bet Amount</span>
                      <span className="text-lg font-black text-gray-900">Rs {(autoBetConfig.amount * autoBetConfig.multiplier).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-bold uppercase">Potential Win</span>
                      <span className="text-sm font-black text-green-600">
                        Rs {((autoBetConfig.amount * autoBetConfig.multiplier) * (autoBetConfig.type === 'number' ? 9 : autoBetConfig.value === 'violet' ? 4.5 : 2)).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setIsAutoBetting(true);
                      setAutoBetConfig(prev => ({
                        ...prev,
                        currentRounds: 0,
                        startBalance: balance
                      }));
                    }}
                    className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Play size={20} fill="currentColor" />
                    Start Auto Bet
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white border-2 border-green-500 rounded-2xl p-6 shadow-[0_0_20px_rgba(34,197,94,0.2)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-pulse"></div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                        <span className="text-green-600 font-black uppercase tracking-widest text-xs">Running</span>
                      </div>
                      <span className="text-gray-400 font-bold text-xs">Round {autoBetConfig?.currentRounds}/{autoBetConfig?.rounds || '∞'}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Target</div>
                        <div className="font-black text-gray-800 uppercase">{autoBetConfig?.value}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Amount</div>
                        <div className="font-black text-gray-800">Rs {(autoBetConfig!.amount * autoBetConfig!.multiplier).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="bg-gray-900 p-4 rounded-xl flex items-center justify-between">
                      <span className="text-gray-400 font-bold uppercase text-xs">Net Profit/Loss</span>
                      <span className={cn(
                        "text-xl font-black", 
                        (balance - autoBetConfig!.startBalance) >= 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {(balance - autoBetConfig!.startBalance) >= 0 ? '+' : ''}Rs {(balance - autoBetConfig!.startBalance).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsAutoBetting(false)}
                    className="w-full bg-red-500 text-white font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                    Stop Auto Bet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <GlobalAd currentView={view} />
      </div>

      {/* Bottom Nav Placeholder */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-2 flex justify-around items-center shadow-2xl z-50">
        <div 
          className={cn("flex flex-col items-center cursor-pointer", view === 'game' ? "text-green-600" : "text-gray-400")}
          onClick={() => setView('game')}
        >
          <Play size={20} />
          <span className="text-[10px] font-bold">Home</span>
        </div>
        <div 
          className={cn("flex flex-col items-center cursor-pointer", view === 'stats' ? "text-green-600" : "text-gray-400")}
          onClick={() => setView('stats')}
        >
          <Trophy size={20} />
          <span className="text-[10px] font-bold">Stats</span>
        </div>
        <div 
          className={cn("flex flex-col items-center cursor-pointer", view === 'referral' ? "text-green-600" : "text-gray-400")}
          onClick={() => setView('referral')}
        >
          <UserPlus size={20} />
          <span className="text-[10px] font-bold">Referral</span>
        </div>
        <div className="flex flex-col items-center text-gray-400">
          <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg -mt-8 border-4 border-white">
            <RefreshCw size={20} />
          </div>
          <span className="text-[10px] font-bold mt-1">Promotion</span>
        </div>
        <div 
          className={cn("flex flex-col items-center cursor-pointer", view === 'wallet' ? "text-green-600" : "text-gray-400")}
          onClick={() => setView('wallet')}
        >
          <Wallet size={20} />
          <span className="text-[10px] font-bold">Wallet</span>
        </div>
        <div className="flex flex-col items-center text-gray-400 cursor-pointer" onClick={() => signOut(auth)}>
          <Info size={20} />
          <span className="text-[10px] font-bold">Logout</span>
        </div>
        {user?.role === 'admin' && (
          <div className="flex flex-col items-center text-purple-600 cursor-pointer" onClick={() => setView('admin')}>
            <Shield size={20} />
            <span className="text-[10px] font-bold">Admin</span>
          </div>
        )}
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}

function StatsPage({ onBack, history }: { onBack: () => void, history: GameResult[] }) {
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('balance', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTopPlayers(players);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching top players:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    if (history.length === 0) return null;

    const counts: Record<number, number> = {};
    const colorCounts: Record<string, number> = { green: 0, red: 0, violet: 0 };
    const sizeCounts: Record<string, number> = { Big: 0, Small: 0 };

    history.forEach(res => {
      counts[res.number] = (counts[res.number] || 0) + 1;
      res.colors.forEach(c => {
        colorCounts[c] = (colorCounts[c] || 0) + 1;
      });
      sizeCounts[res.bigSmall] = (sizeCounts[res.bigSmall] || 0) + 1;
    });

    const mostCommonNumber = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const mostCommonColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
    const mostCommonSize = Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      mostCommonNumber,
      mostCommonColor,
      mostCommonSize,
      totalGames: history.length,
      colorCounts,
      sizeCounts
    };
  }, [history]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-green-600 p-6 text-white rounded-b-[2rem] shadow-lg mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold uppercase tracking-widest">Game Statistics</h1>
        </div>
        
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
              <div className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Games</div>
              <div className="text-2xl font-black">{stats.totalGames}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
              <div className="text-[10px] font-bold uppercase opacity-60 mb-1">Hot Number</div>
              <div className="text-2xl font-black">{stats.mostCommonNumber?.[0]}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
              <div className="text-[10px] font-bold uppercase opacity-60 mb-1">Hot Color</div>
              <div className="text-sm font-black uppercase">{stats.mostCommonColor?.[0]}</div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 space-y-8">
        {/* Win Rates / Distribution */}
        <section>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap size={14} className="text-orange-500" /> Result Distribution
          </h2>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="space-y-6">
              {/* Color Distribution */}
              <div>
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-2">
                  <span>Color Distribution</span>
                  <span>{stats?.totalGames} Rounds</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500 transition-all duration-500" 
                    style={{ width: `${(stats?.colorCounts.green || 0) / (stats?.totalGames || 1) * 100}%` }}
                  />
                  <div 
                    className="bg-red-500 transition-all duration-500" 
                    style={{ width: `${(stats?.colorCounts.red || 0) / (stats?.totalGames || 1) * 100}%` }}
                  />
                  <div 
                    className="bg-purple-500 transition-all duration-500" 
                    style={{ width: `${(stats?.colorCounts.violet || 0) / (stats?.totalGames || 1) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-bold">
                  <span className="text-green-600">Green: {Math.round((stats?.colorCounts.green || 0) / (stats?.totalGames || 1) * 100)}%</span>
                  <span className="text-red-600">Red: {Math.round((stats?.colorCounts.red || 0) / (stats?.totalGames || 1) * 100)}%</span>
                  <span className="text-purple-600">Violet: {Math.round((stats?.colorCounts.violet || 0) / (stats?.totalGames || 1) * 100)}%</span>
                </div>
              </div>

              {/* Size Distribution */}
              <div>
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-2">
                  <span>Size Distribution</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                  <div 
                    className="bg-orange-400 transition-all duration-500" 
                    style={{ width: `${(stats?.sizeCounts.Big || 0) / (stats?.totalGames || 1) * 100}%` }}
                  />
                  <div 
                    className="bg-blue-400 transition-all duration-500" 
                    style={{ width: `${(stats?.sizeCounts.Small || 0) / (stats?.totalGames || 1) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-bold">
                  <span className="text-orange-500">Big: {Math.round((stats?.sizeCounts.Big || 0) / (stats?.totalGames || 1) * 100)}%</span>
                  <span className="text-blue-500">Small: {Math.round((stats?.sizeCounts.Small || 0) / (stats?.totalGames || 1) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        <section>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-yellow-500" /> Top Players
          </h2>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400 font-bold animate-pulse">Loading leaderboard...</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topPlayers.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs",
                      index === 0 ? "bg-yellow-100 text-yellow-600" :
                      index === 1 ? "bg-gray-100 text-gray-600" :
                      index === 2 ? "bg-orange-100 text-orange-600" :
                      "bg-gray-50 text-gray-400"
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-gray-900 text-sm">{player.email.split('@')[0]}***</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Level {Math.floor((player.referralEarnings || 0) / 1000) + 1}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-600 font-black text-sm">Rs {player.balance?.toLocaleString() || 0}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Balance</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
function LandingPage({ onStart, onLogin, onRegister }: { onStart: () => void, onLogin: () => void, onRegister: () => void }) {
  const [currentBanner, setCurrentBanner] = useState(0);
  const banners = [
    {
      title: "Win Big with WinGo",
      desc: "The most trusted color prediction game in the market.",
      image: "https://picsum.photos/seed/casino1/1200/400",
      color: "from-green-600 to-emerald-900"
    },
    {
      title: "Instant Withdrawals",
      desc: "Get your winnings in seconds with our fast payout system.",
      image: "https://picsum.photos/seed/casino2/1200/400",
      color: "from-blue-600 to-indigo-900"
    },
    {
      title: "24/7 Support",
      desc: "Our team is always here to help you with any issues.",
      image: "https://picsum.photos/seed/casino3/1200/400",
      color: "from-purple-600 to-pink-900"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-md border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <span className="text-xl font-bold tracking-tighter">WINGO<span className="text-green-500">PRO</span></span>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onLogin}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 transition-all text-sm font-medium"
          >
            <LogIn size={16} /> Login
          </button>
          <button 
            onClick={onRegister}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 hover:bg-green-400 text-black transition-all text-sm font-bold shadow-lg shadow-green-500/20"
          >
            <UserPlus size={16} /> Register
          </button>
        </div>
      </nav>

      {/* Hero Banner Slider */}
      <div className="relative h-[500px] mt-16 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBanner}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className={cn(
              "absolute inset-0 flex items-center px-6 md:px-20 bg-gradient-to-r",
              banners[currentBanner].color
            )}
          >
            <div className="absolute inset-0 opacity-30 mix-blend-overlay">
              <img src={banners[currentBanner].image} alt="Banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="relative z-10 max-w-2xl">
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-5xl md:text-7xl font-black mb-4 leading-tight"
              >
                {banners[currentBanner].title}
              </motion.h1>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-lg md:text-xl text-white/80 mb-8"
              >
                {banners[currentBanner].desc}
              </motion.p>
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                onClick={onStart}
                className="group flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-all shadow-xl"
              >
                Play Now <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
        
        {/* Slider Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentBanner(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                currentBanner === i ? "w-8 bg-white" : "w-2 bg-white/30"
              )}
            />
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 -mt-10 relative z-20">
        {[
          { label: "Active Players", val: "50K+", icon: User },
          { label: "Total Payout", val: "$2.5M", icon: Wallet },
          { label: "Daily Winners", val: "12K", icon: Trophy },
          { label: "Secure", val: "100%", icon: Shield },
        ].map((s, i) => (
          <div key={i} className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-2">
              <s.icon size={20} className="text-green-500" />
            </div>
            <span className="text-2xl font-bold">{s.val}</span>
            <span className="text-xs text-white/50 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Video Section */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">How to Play?</h2>
          <p className="text-white/60">Watch this quick guide to start winning in minutes.</p>
        </div>
        <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
          <iframe 
            className="w-full h-full"
            src="https://www.youtube.com/embed/dQw4w9WgXcQ" 
            title="How to play WinGo"
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          ></iframe>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-20 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-green-500/50 transition-all group">
            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Zap className="text-green-500" size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-4">Fastest Results</h3>
            <p className="text-white/60 leading-relaxed">Experience the thrill with 30-second game modes. No more waiting for hours to see if you won.</p>
          </div>
          <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-blue-500/50 transition-all group">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Shield className="text-blue-500" size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-4">Secure Platform</h3>
            <p className="text-white/60 leading-relaxed">Your data and funds are protected with military-grade encryption and secure payment gateways.</p>
          </div>
          <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-purple-500/50 transition-all group">
            <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Star className="text-purple-500" size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-4">VIP Rewards</h3>
            <p className="text-white/60 leading-relaxed">Join our loyalty program and get exclusive bonuses, higher limits, and dedicated account managers.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-white/10 bg-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Zap className="text-green-500" size={24} />
            <span className="text-xl font-bold tracking-tighter">WINGO<span className="text-green-500">PRO</span></span>
          </div>
          <div className="flex gap-8 text-sm text-white/50">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
            <a href="#" className="hover:text-white transition-colors">Responsible Gaming</a>
          </div>
          <div className="text-sm text-white/30">
            © 2026 WinGo Pro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function LoginPage({ onBack, onRegister, onLoginSuccess, playSound }: { onBack: () => void, onRegister: () => void, onLoginSuccess: (user: any) => void, playSound: (type: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log("Google login successful:", user.uid);
      
      // Check if user exists in Firestore, if not create them
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let userData = {};
      if (!userDoc.exists()) {
        userData = {
          uid: user.uid,
          email: user.email,
          balance: 0,
          role: user.email === 'wppgrouplinks@gmail.com' ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', user.uid), userData);
        console.log("New Google user registered in Firestore");
      } else {
        userData = userDoc.data();
      }

      playSound('notify');
      onLoginSuccess({ ...user, ...userData });
    } catch (error: any) {
      console.error("Google login error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        setError("Google login is not enabled in Firebase. Please enable it in the console.");
      } else {
        setError("Google login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError("");
    console.log(`Attempting email login for:`, email);
    if (email && password) {
      setLoading(true);
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Login successful:", userCredential.user.uid);
        
        // Fetch user data first to ensure we have the role/balance
        let userData = {};
        try {
          const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
          if (userDoc.exists()) {
            userData = userDoc.data();
          }
        } catch (error) {
          console.warn("Error fetching user data after login. Quota might be exceeded.");
        }

        playSound('notify');
        onLoginSuccess({ ...userCredential.user, ...userData });
      } catch (error: any) {
        console.error("Login error:", error);
        let msg = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found') msg = "User not found. Please register first.";
        if (error.code === 'auth/wrong-password') msg = "Incorrect password.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    } else {
      setError("Please enter email and password");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-gradient-to-b from-[#00c853] to-[#00e676] p-6 text-white relative">
        <button onClick={onBack} className="absolute left-4 top-6">
          <ChevronLeft size={24} />
        </button>
        <div className="flex justify-center mb-4">
          <img src="https://92pkr.com/assets/logo.png" alt="Logo" className="h-12" onError={(e) => e.currentTarget.src = "https://picsum.photos/seed/logo/100/40"} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Log in</h1>
        <p className="text-sm opacity-90">Please log in with your email</p>
        <p className="text-xs opacity-75">If you forget your password, please contact customer service</p>
      </div>

      <div className="flex-1 bg-white rounded-t-[32px] -mt-6 p-6 shadow-xl">
        <div className="flex border-b mb-8">
          <button 
            className="flex-1 py-3 font-bold flex flex-col items-center gap-1 transition-all text-[#00c853] border-b-2 border-[#00c853]"
          >
            <div className="w-6 h-6 rounded flex items-center justify-center text-white bg-[#00c853]"><Bell size={14} /></div>
            Email Login
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold animate-pulse">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white border-2 border-gray-100 text-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-gray-600 font-bold mb-2">
              <div className="w-6 h-6 bg-[#00c853] rounded flex items-center justify-center text-white"><Bell size={14} /></div>
              Email address
            </label>
            <input 
              type="email" 
              placeholder="Please enter the email" 
              className="w-full bg-white border rounded-xl px-4 py-3 outline-none focus:border-[#00c853] transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-gray-600 font-bold mb-2">
              <div className="w-6 h-6 bg-[#00c853] rounded flex items-center justify-center text-white"><Shield size={14} /></div>
              Password
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                className="w-full bg-white border rounded-xl px-4 py-3 outline-none focus:border-[#00c853] transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-5 h-5 rounded-full border-2 border-[#00c853] bg-[#00c853] flex items-center justify-center text-white">
              <Zap size={12} />
            </div>
            Remember password
          </div>

          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#00c853] text-white py-4 rounded-full font-bold text-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <button 
            onClick={onRegister}
            className="w-full border-2 border-[#00c853] text-[#00c853] py-4 rounded-full font-bold text-xl active:scale-95 transition-all"
          >
            Register
          </button>

          <div className="flex justify-around pt-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center text-[#00c853]">
                <Shield size={24} />
              </div>
              <span className="text-xs text-gray-500 font-bold">Forgot password</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center text-[#00c853]">
                <Bell size={24} />
              </div>
              <span className="text-xs text-gray-500 font-bold">Customer Service</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterPage({ onBack, onLogin, onRegisterSuccess, referralCode, playSound }: { onBack: () => void, onLogin: () => void, onRegisterSuccess: (user: any) => void, referralCode: string | null, playSound: (type: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log("Google registration/login successful:", user.uid);
      
      // Check if user exists in Firestore, if not create them
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let userData: any = {};
      if (!userDoc.exists()) {
        userData = {
          uid: user.uid,
          email: user.email,
          balance: 0,
          role: user.email === 'wppgrouplinks@gmail.com' ? 'admin' : 'user',
          referredBy: referralCode || null,
          referralEarnings: 0,
          referralCount: 0,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', user.uid), userData);
        console.log("New Google user registered in Firestore");

        // If referred by someone, increment their referral count
        if (referralCode) {
          const referrerRef = doc(db, 'users', referralCode);
          const referrerSnap = await getDoc(referrerRef);
          if (referrerSnap.exists()) {
            const referrerData = referrerSnap.data();
            await setDoc(referrerRef, {
              ...referrerData,
              referralCount: (referrerData.referralCount || 0) + 1
            });
            console.log("Referrer count updated");
          }
        }
      } else {
        userData = userDoc.data();
      }

      playSound('notify');
      onRegisterSuccess({ ...user, ...userData });
    } catch (error: any) {
      console.error("Google login error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        setError("Google login is not enabled in Firebase. Please enable it in the console.");
      } else {
        setError("Google login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    console.log("Attempting registration for email:", email);
    if (!email.includes('@')) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (email && password) {
      setLoading(true);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Auth registration successful:", userCredential.user.uid);
        
        const userData = {
          uid: userCredential.user.uid,
          email,
          balance: 0,
          role: email === 'wppgrouplinks@gmail.com' ? 'admin' : 'user',
          referredBy: referralCode || null,
          referralEarnings: 0,
          referralCount: 0,
          createdAt: new Date().toISOString()
        };
        
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), userData);
          console.log("User document created in Firestore");
          
          // If referred by someone, increment their referral count
          if (referralCode) {
            const referrerRef = doc(db, 'users', referralCode);
            const referrerSnap = await getDoc(referrerRef);
            if (referrerSnap.exists()) {
              const referrerData = referrerSnap.data();
              await setDoc(referrerRef, {
                ...referrerData,
                referralCount: (referrerData.referralCount || 0) + 1
              });
              console.log("Referrer count updated");
            }
          }
        } catch (error) {
          console.error("Error creating user document:", error);
        }

        // Explicitly call success handler to trigger view change
        playSound('notify');
        onRegisterSuccess({ ...userCredential.user, ...userData });
      } catch (error: any) {
        console.error("Registration error:", error);
        let msg = "Registration failed.";
        let isKnownError = false;
        if (error.code === 'auth/email-already-in-use') {
          msg = "This email is already registered. Please login instead.";
          isKnownError = true;
        } else if (error.code === 'auth/weak-password') {
          msg = "Password is too weak. Please use at least 6 characters.";
          isKnownError = true;
        } else if (error.code === 'auth/operation-not-allowed') {
          msg = "Registration is currently disabled. Please contact support.";
          isKnownError = true;
        } else if (error.code === 'auth/invalid-email') {
          msg = "The email address is invalid.";
          isKnownError = true;
        }
        
        setError(isKnownError ? msg : `${msg} ${error.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      setError("Please fill all fields correctly");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-gradient-to-b from-[#00c853] to-[#00e676] p-6 text-white relative">
        <button onClick={onBack} className="absolute left-4 top-6">
          <ChevronLeft size={24} />
        </button>
        <div className="flex justify-center mb-4">
          <img src="https://92pkr.com/assets/logo.png" alt="Logo" className="h-12" onError={(e) => e.currentTarget.src = "https://picsum.photos/seed/logo/100/40"} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Register</h1>
        <p className="text-sm opacity-90">Please register by email</p>
      </div>

      <div className="flex-1 bg-white rounded-t-[32px] -mt-6 p-6 shadow-xl">
        <div className="flex border-b mb-8">
          <button className="flex-1 py-3 text-[#00c853] border-b-2 border-[#00c853] font-bold flex flex-col items-center gap-1">
            <div className="w-6 h-6 bg-[#00c853] rounded flex items-center justify-center text-white"><Bell size={14} /></div>
            Register your email
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold animate-pulse">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white border-2 border-gray-100 text-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-gray-600 font-bold mb-2">
              <div className="w-6 h-6 bg-[#00c853] rounded flex items-center justify-center text-white"><Bell size={14} /></div>
              Email address
            </label>
            <input 
              type="email" 
              placeholder="Please enter the email" 
              className="w-full bg-white border rounded-xl px-4 py-3 outline-none focus:border-[#00c853] transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-gray-600 font-bold mb-2">
              <div className="w-6 h-6 bg-[#00c853] rounded flex items-center justify-center text-white"><Shield size={14} /></div>
              Set password
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Set password" 
                className="w-full bg-white border rounded-xl px-4 py-3 outline-none focus:border-[#00c853] transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-gray-600 font-bold mb-2">
              <div className="w-6 h-6 bg-[#00c853] rounded flex items-center justify-center text-white"><Shield size={14} /></div>
              Confirm password
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Confirm password" 
                className="w-full bg-white border rounded-xl px-4 py-3 outline-none focus:border-[#00c853] transition-all"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-gray-600 font-bold mb-2">
              <div className="w-6 h-6 bg-[#00c853] rounded flex items-center justify-center text-white"><Star size={14} /></div>
              Invite code
            </label>
            <input 
              type="text" 
              placeholder="Optional" 
              className="w-full bg-white border rounded-xl px-4 py-3 outline-none focus:border-[#00c853] transition-all"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-5 h-5 rounded-full border-2 border-[#00c853] bg-[#00c853] flex items-center justify-center text-white">
              <Zap size={12} />
            </div>
            I have read and agree <span className="text-red-500">【Privacy Agreement】</span>
          </div>

          <button 
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-[#00c853] text-white py-4 rounded-full font-bold text-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register"}
          </button>

          <button 
            onClick={onLogin}
            className="w-full border-2 border-[#00c853] text-gray-500 py-4 rounded-full font-bold text-lg active:scale-95 transition-all"
          >
            I have an account <span className="text-[#00c853] ml-2">Login</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function GlobalAd({ currentView }: { currentView: string }) {
  const [adData, setAdData] = useState<{ adHtml: string | null, showOnHome: boolean, showOnWallet: boolean }>({
    adHtml: null,
    showOnHome: true,
    showOnWallet: false
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAdData({
          adHtml: data.adHtml || null,
          showOnHome: data.showOnHome ?? true,
          showOnWallet: data.showOnWallet ?? false
        });
      }
    }, (error) => {
      console.error("Error fetching global settings:", error);
    });
    return () => unsubscribe();
  }, []);

  if (!adData.adHtml) return null;

  const shouldShow = (currentView === 'game' && adData.showOnHome) || 
                     (currentView === 'wallet' && adData.showOnWallet);

  if (!shouldShow) return null;

  return (
    <div 
      className="w-full p-4 bg-white border-t border-gray-100 mt-4 overflow-hidden"
      dangerouslySetInnerHTML={{ __html: adData.adHtml }}
    />
  );
}

function AdminPanel({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [adHtml, setAdHtml] = useState("");
  const [showOnHome, setShowOnHome] = useState(true);
  const [showOnWallet, setShowOnWallet] = useState(false);
  const [isSavingAd, setIsSavingAd] = useState(false);
  const [betSummaries, setBetSummaries] = useState<Record<string, { 
    totalAmount: number,
    size: { Big: number, Small: number },
    color: { red: number, green: number, violet: number },
    number: Record<string, number>,
    rawBets: any[]
  }>>({});
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [isProcessingWithdrawal, setIsProcessingWithdrawal] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<{
    totalUsers: number;
    totalDepositAmount: number;
    totalWithdrawalAmount: number;
    totalReferralBonus: number;
    totalUserBalance: number;
    netRevenue: number;
  } | null>(null);

  const gameModes: { id: GameMode; label: string }[] = [
    { id: '30s', label: 'WinGo 30sec' },
    { id: '1m', label: 'WinGo 1 Min' },
    { id: '3m', label: 'WinGo 3 Min' },
    { id: '5m', label: 'WinGo 5 Min' },
  ];

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const res = await fetch(`/api/admin/bets`);
        if (res.ok) {
          const data = await res.json();
          setBetSummaries(data);
        }
      } catch (e) {
        console.error(`Failed to fetch bet summaries`, e);
      }
    };
    const fetchWithdrawals = async () => {
      try {
        const q = query(collection(db, 'withdrawals'), where('status', '==', 'pending'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPendingWithdrawals(data as any);
      } catch (e) {
        console.error(`Failed to fetch withdrawals`, e);
      }
    };
    const fetchStats = async () => {
      try {
        // Fetch stats directly from Firestore to avoid server-side permission issues
        const usersSnap = await getDocs(collection(db, 'users'));
        let totalReferralBonus = 0;
        let totalUserBalance = 0;
        usersSnap.forEach(doc => {
          const data = doc.data();
          totalReferralBonus += (data.referralEarnings || 0);
          totalUserBalance += (data.balance || 0);
        });

        const depositsSnap = await getDocs(query(collection(db, 'deposits'), where('status', '==', 'approved')));
        let totalDepositAmount = 0;
        depositsSnap.forEach(doc => {
          totalDepositAmount += (doc.data().amount || 0);
        });

        const withdrawalsSnap = await getDocs(query(collection(db, 'withdrawals'), where('status', '==', 'approved')));
        let totalWithdrawalAmount = 0;
        withdrawalsSnap.forEach(doc => {
          totalWithdrawalAmount += (doc.data().amount || 0);
        });

        setAdminStats({
          totalUsers: usersSnap.size,
          totalReferralBonus,
          totalUserBalance,
          totalDepositAmount,
          totalWithdrawalAmount
        });
      } catch (e) {
        console.error(`Failed to fetch stats`, e);
      }
    };
    fetchSummaries();
    fetchWithdrawals();
    fetchStats();
    const interval = setInterval(() => {
      fetchSummaries();
      fetchWithdrawals();
      fetchStats();
    }, 30000); // Changed from 2000 to 30000 (30 seconds)
    return () => clearInterval(interval);
  }, []);

  const handleForceResult = async (mode: string, result: number) => {
    try {
      const res = await fetch('/api/admin/set-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, result })
      });
      if (res.ok) {
        alert(`Forced result set to ${result} for ${mode}`);
      } else {
        alert("Failed to set result");
      }
    } catch (e) {
      console.error("Failed to set result", e);
      alert("Error setting result");
    }
  };

  const handleProcessWithdrawal = async (id: string, action: 'approve' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this withdrawal?`)) return;
    
    setIsProcessingWithdrawal(id);
    try {
      const withdrawalRef = doc(db, 'withdrawals', id);
      const withdrawalSnap = await getDoc(withdrawalRef);
      
      if (!withdrawalSnap.exists()) {
        throw new Error("Withdrawal not found");
      }
      
      const withdrawalData = withdrawalSnap.data();
      
      if (action === 'reject') {
        // Refund balance
        const userRef = doc(db, 'users', withdrawalData.userId);
        await updateDoc(userRef, {
          balance: increment(withdrawalData.amount)
        });
      }
      
      await updateDoc(withdrawalRef, {
        status: action === 'approve' ? 'approved' : 'rejected',
        processedAt: Date.now()
      });
      
      alert(`Withdrawal ${action}d successfully`);
      setPendingWithdrawals(prev => prev.filter(w => w.id !== id));
    } catch (e: any) {
      console.error(`Failed to ${action} withdrawal`, e);
      alert(`Error processing withdrawal: ${e.message}`);
    } finally {
      setIsProcessingWithdrawal(null);
    }
  };

  // Payment Methods State
  const [jazzCashDetails, setJazzCashDetails] = useState({ accountName: '', accountNumber: '' });
  const [easypaisaDetails, setEasypaisaDetails] = useState({ accountName: '', accountNumber: '' });
  const [bankDetails, setBankDetails] = useState({ accountName: '', accountNumber: '', bankName: '' });
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);

  // Add User State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newBalance, setNewBalance] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  // Balance Adjustment State
  const [viewingWithdrawal, setViewingWithdrawal] = useState<any>(null);
  const [adjustingUser, setAdjustingUser] = useState<{ id: string, type: 'add' | 'cut' } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);

  useEffect(() => {
    // Load from cache first
    const cachedUsers = getCachedData('admin_users');
    if (cachedUsers) {
      setUsers(cachedUsers);
    }

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      cacheData('admin_users', usersData); // Cache new data
    }, (error) => {
      console.warn("Firestore quota exceeded, using cached users.");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Load from cache first
    const cachedGlobal = getCachedData('admin_settings_global');
    if (cachedGlobal) {
      setAdHtml(cachedGlobal.adHtml || "");
      setShowOnHome(cachedGlobal.showOnHome ?? true);
      setShowOnWallet(cachedGlobal.showOnWallet ?? false);
    }

    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        cacheData('admin_settings_global', data); // Cache new data
        setAdHtml(data.adHtml || "");
        setShowOnHome(data.showOnHome ?? true);
        setShowOnWallet(data.showOnWallet ?? false);
      }
    }, (error) => {
      console.warn("Firestore quota exceeded, using cached global settings.");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Load from cache first
    const cachedPayment = getCachedData('admin_settings_payment');
    if (cachedPayment) {
      setJazzCashDetails(cachedPayment.jazzcash || { accountName: '', accountNumber: '' });
      setEasypaisaDetails(cachedPayment.easypaisa || { accountName: '', accountNumber: '' });
      setBankDetails(cachedPayment.bank || { accountName: '', accountNumber: '', bankName: '' });
    }

    const unsubscribe = onSnapshot(doc(db, 'settings', 'paymentMethods'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        cacheData('admin_settings_payment', data); // Cache new data
        setJazzCashDetails(data.jazzcash || { accountName: '', accountNumber: '' });
        setEasypaisaDetails(data.easypaisa || { accountName: '', accountNumber: '' });
        setBankDetails(data.bank || { accountName: '', accountNumber: '', bankName: '' });
      }
    }, (error) => {
      console.warn("Firestore quota exceeded in AdminPanel (settings/paymentMethods), using cached data.");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Load from cache first
    const cachedDeposits = getCachedData('admin_deposits');
    if (cachedDeposits) {
      setPendingDeposits(cachedDeposits);
    }

    const q = query(collection(db, 'deposits'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const depositsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => b.timestamp - a.timestamp);
      setPendingDeposits(depositsData);
      cacheData('admin_deposits', depositsData); // Cache new data
    }, (error) => {
      console.warn("Firestore quota exceeded in AdminPanel (deposits), using cached data.");
    });
    return () => unsubscribe();
  }, []);

  const handleSavePayment = async () => {
    setIsSavingPayment(true);
    try {
      await setDoc(doc(db, 'settings', 'paymentMethods'), {
        jazzcash: jazzCashDetails,
        easypaisa: easypaisaDetails,
        bank: bankDetails,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert("Payment methods updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/paymentMethods');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleApproveDeposit = async (deposit: any) => {
    try {
      await setDoc(doc(db, 'deposits', deposit.id), { status: 'approved', processedAt: Date.now() }, { merge: true });
      
      const userRef = doc(db, 'users', deposit.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        await setDoc(userRef, { 
          balance: (userData.balance || 0) + deposit.amount,
          totalDeposited: (userData.totalDeposited || 0) + deposit.amount
        }, { merge: true });

        // Referral Commission Logic
        if (userData.referredBy) {
          const referrerRef = doc(db, 'users', userData.referredBy);
          const referrerSnap = await getDoc(referrerRef);
          if (referrerSnap.exists()) {
            const referrerData = referrerSnap.data();
            const commission = deposit.amount * 0.10;
            
            await setDoc(referrerRef, {
              balance: (referrerData.balance || 0) + commission,
              referralEarnings: (referrerData.referralEarnings || 0) + commission
            }, { merge: true });

            // Record referral transaction
            const referralTxRef = doc(collection(db, 'transactions'));
            await setDoc(referralTxRef, {
              userId: userData.referredBy,
              type: 'referral_bonus',
              amount: commission,
              fromUser: userData.email,
              status: 'completed',
              timestamp: Date.now()
            });
            console.log(`Referral commission of Rs ${commission} sent to ${userData.referredBy}`);
          }
        }
      }

      const txRef = doc(collection(db, 'transactions'));
      await setDoc(txRef, {
        userId: deposit.userId,
        type: 'deposit',
        amount: deposit.amount,
        method: deposit.method,
        status: 'completed',
        timestamp: Date.now()
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deposits/${deposit.id}`);
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    try {
      await setDoc(doc(db, 'deposits', depositId), { status: 'rejected', processedAt: Date.now() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deposits/${depositId}`);
    }
  };

  const handleSaveAd = async () => {
    setIsSavingAd(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        adHtml,
        showOnHome,
        showOnWallet,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert("Ad settings updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    } finally {
      setIsSavingAd(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail) return;
    setIsCreating(true);
    try {
      // Note: This only creates the Firestore document. 
      // The user still needs to register with this email to create Auth credentials.
      const tempId = `temp_${Date.now()}`;
      await setDoc(doc(db, 'users', tempId), {
        email: newEmail,
        balance: Number(newBalance),
        role: 'user',
        isBlocked: false,
        createdAt: new Date().toISOString()
      });
      alert("User document created! User must still register with this email to login.");
      setShowAddModal(false);
      setNewEmail("");
      setNewBalance(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    try {
      await setDoc(doc(db, 'users', userId), {
        isBlocked: !currentStatus
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleAdjustBalance = async (userId: string, currentBalance: number, amount: number) => {
    try {
      await setDoc(doc(db, 'users', userId), {
        balance: currentBalance + amount
      }, { merge: true });
      setAdjustingUser(null);
      setAdjustAmount(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      alert("User deleted from database.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-24">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter">ADMIN DASHBOARD</h1>
        {/* Stats Visualization */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 mb-8 w-full">
          <h2 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tighter">Stats Overview</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Users', value: adminStats?.totalUsers || 0 },
                { name: 'Deposits', value: adminStats?.totalDepositAmount || 0 },
                { name: 'Withdrawals', value: adminStats?.totalWithdrawalAmount || 0 },
                { name: 'Balance', value: adminStats?.totalUserBalance || 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <button 
          onClick={async () => {
            try {
              // Seed Users
              await setDoc(doc(db, 'users', 'testuser1'), { email: 'test1@example.com', balance: 500, role: 'user', referralEarnings: 50, createdAt: new Date().toISOString() });
              await setDoc(doc(db, 'users', 'testuser2'), { email: 'test2@example.com', balance: 1500, role: 'user', referralEarnings: 100, createdAt: new Date().toISOString() });
              
              // Seed Deposits
              await addDoc(collection(db, 'deposits'), { userId: 'testuser1', userEmail: 'test1@example.com', amount: 1000, method: 'bank', status: 'approved', timestamp: Date.now() });
              
              // Seed Withdrawals
              await addDoc(collection(db, 'withdrawals'), { userId: 'testuser2', userEmail: 'test2@example.com', amount: 500, method: 'bank', accountDetails: '123456789', status: 'approved', timestamp: Date.now() });
              
              alert("Test data seeded successfully! Refresh the page to see stats.");
            } catch (e) {
              console.error(e);
              alert("Failed to seed test data.");
            }
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-600 ml-2"
        >
          Seed Test Data
        </button>
        <button onClick={onBack} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-all">
          <ChevronLeft size={24} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tighter">System Settings</h2>
          <button 
            onClick={() => { localStorage.clear(); alert("Cache cleared successfully!"); window.location.reload(); }}
            className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-all"
          >
            Clear All Cache
          </button>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Users className="text-blue-500" size={16} />
            </div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Users</div>
          </div>
          <div className="text-3xl font-black text-gray-900">{adminStats?.totalUsers || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-xl">
              <Wallet className="text-green-500" size={16} />
            </div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total User Balance</div>
          </div>
          <div className="text-3xl font-black text-green-600">Rs {adminStats?.totalUserBalance?.toLocaleString() || '0'}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-xl">
              <ArrowDownCircle className="text-green-500" size={16} />
            </div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Deposits</div>
          </div>
          <div className="text-3xl font-black text-green-600">Rs {adminStats?.totalDepositAmount?.toLocaleString() || '0'}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 rounded-xl">
              <ArrowUpCircle className="text-red-500" size={16} />
            </div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Withdrawals</div>
          </div>
          <div className="text-3xl font-black text-red-600">Rs {adminStats?.totalWithdrawalAmount?.toLocaleString() || '0'}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-xl">
              <Trophy className="text-purple-500" size={16} />
            </div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Referral Bonuses</div>
          </div>
          <div className="text-3xl font-black text-purple-600">Rs {adminStats?.totalReferralBonus?.toLocaleString() || '0'}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 rounded-xl">
              <Zap className="text-orange-500" size={16} />
            </div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Active Games</div>
          </div>
          <div className="text-3xl font-black text-orange-600">4</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Receipt className="text-indigo-500" size={16} />
            </div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Net Revenue</div>
          </div>
          <div className={cn(
            "text-3xl font-black",
            (adminStats?.netRevenue || 0) >= 0 ? "text-green-600" : "text-red-600"
          )}>
            Rs {adminStats?.netRevenue?.toLocaleString() || '0'}
          </div>
        </div>
      </div>

      {/* Pending Deposits Section */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 p-8 mb-8">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2 uppercase tracking-tight">
          <Upload className="text-blue-500" size={24} /> Pending Deposits
        </h2>
        {pendingDeposits.length === 0 ? (
          <p className="text-xs text-gray-400 font-bold">No pending deposits.</p>
        ) : (
          <div className="space-y-4">
            {pendingDeposits.map(deposit => (
              <div key={deposit.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <div className="font-black text-gray-800">{deposit.userEmail}</div>
                  <div className="text-xs text-gray-500 font-bold">Amount: <span className="text-green-600">Rs {deposit.amount}</span></div>
                  <div className="text-xs text-gray-500 font-bold">Method: {deposit.method}</div>
                  <div className="text-xs text-gray-500 font-bold">Date: {deposit.timestamp ? new Date(deposit.timestamp).toLocaleString() : 'N/A'}</div>
                </div>
                {deposit.screenshotBase64 && (
                  <div className="shrink-0">
                    <a href={deposit.screenshotBase64} target="_blank" rel="noreferrer" className="text-xs text-blue-500 font-bold underline">View Screenshot</a>
                  </div>
                )}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleApproveDeposit(deposit)} className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-sm hover:bg-green-600 transition-colors">Approve</button>
                  <button onClick={() => handleRejectDeposit(deposit.id)} className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-sm hover:bg-red-600 transition-colors">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Methods Setup Section */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 p-8 mb-8">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2 uppercase tracking-tight">
          <CreditCard className="text-purple-500" size={24} /> Payment Methods Setup
        </h2>
        
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <h3 className="font-black mb-2 text-sm">JazzCash</h3>
            <input type="text" placeholder="Account Name" value={jazzCashDetails.accountName} onChange={e => setJazzCashDetails({...jazzCashDetails, accountName: e.target.value})} className="w-full mb-2 p-2 text-xs rounded border border-gray-200" />
            <input type="text" placeholder="Account Number" value={jazzCashDetails.accountNumber} onChange={e => setJazzCashDetails({...jazzCashDetails, accountNumber: e.target.value})} className="w-full p-2 text-xs rounded border border-gray-200" />
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <h3 className="font-black mb-2 text-sm">Easypaisa</h3>
            <input type="text" placeholder="Account Name" value={easypaisaDetails.accountName} onChange={e => setEasypaisaDetails({...easypaisaDetails, accountName: e.target.value})} className="w-full mb-2 p-2 text-xs rounded border border-gray-200" />
            <input type="text" placeholder="Account Number" value={easypaisaDetails.accountNumber} onChange={e => setEasypaisaDetails({...easypaisaDetails, accountNumber: e.target.value})} className="w-full p-2 text-xs rounded border border-gray-200" />
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <h3 className="font-black mb-2 text-sm">Bank Transfer</h3>
            <input type="text" placeholder="Bank Name" value={bankDetails.bankName} onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})} className="w-full mb-2 p-2 text-xs rounded border border-gray-200" />
            <input type="text" placeholder="Account Name" value={bankDetails.accountName} onChange={e => setBankDetails({...bankDetails, accountName: e.target.value})} className="w-full mb-2 p-2 text-xs rounded border border-gray-200" />
            <input type="text" placeholder="Account Number" value={bankDetails.accountNumber} onChange={e => setBankDetails({...bankDetails, accountNumber: e.target.value})} className="w-full p-2 text-xs rounded border border-gray-200" />
          </div>
        </div>

        <button
          onClick={handleSavePayment}
          disabled={isSavingPayment}
          className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 active:scale-95"
        >
          {isSavingPayment ? "Saving..." : "Save Payment Methods"}
        </button>
      </div>

      {/* Pending Withdrawals Section */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 p-8 mb-8">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2 uppercase tracking-tight">
          <CreditCard className="text-blue-500" size={24} /> Pending Withdrawals
        </h2>
        {pendingWithdrawals.length === 0 ? (
          <p className="text-gray-500 font-bold text-sm text-center py-8 bg-gray-50 rounded-2xl border border-gray-100">No pending withdrawal requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4 rounded-tl-xl">User</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 rounded-tr-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-700">{w.userEmail}</td>
                    <td className="p-4 font-black text-green-600">Rs {w.amount}</td>
                    <td className="p-4 font-bold uppercase text-xs text-gray-500">{w.method}</td>
                    <td className="p-4 text-xs text-gray-600 max-w-[200px] truncate" title={w.accountDetails}>{w.accountDetails}</td>
                    <td className="p-4 text-xs text-gray-400 font-bold">{new Date(w.timestamp).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setViewingWithdrawal(w)}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleProcessWithdrawal(w.id, 'approve')}
                          disabled={isProcessingWithdrawal === w.id}
                          className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button 
                          onClick={() => handleProcessWithdrawal(w.id, 'reject')}
                          disabled={isProcessingWithdrawal === w.id}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                          title="Reject & Refund"
                        >
                          <Ban size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Game Control Section */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 p-8 mb-8">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2 uppercase tracking-tight">
          <Trophy className="text-yellow-500" size={24} /> Game Control
        </h2>
        <div className="grid lg:grid-cols-2 gap-6">
          {gameModes.map(mode => {
            const summary = betSummaries[mode.id];
            
            const calculateAdminProfit = (resultNum: number) => {
              if (!summary) return 0;
              let totalPayout = 0;
              totalPayout += (summary.number[resultNum.toString()] || 0) * 9;
              const bigSmall = resultNum >= 5 ? 'Big' : 'Small';
              totalPayout += (summary.size[bigSmall] || 0) * 2;
              let colors = [];
              if ([1, 3, 7, 9].includes(resultNum)) colors.push("green");
              else if ([2, 4, 6, 8].includes(resultNum)) colors.push("red");
              else if (resultNum === 0) colors.push("red", "violet");
              else if (resultNum === 5) colors.push("green", "violet");

              if (colors.includes('violet')) {
                totalPayout += (summary.color['violet'] || 0) * 4.5;
                if (colors.includes('red')) totalPayout += (summary.color['red'] || 0) * 1.5;
                if (colors.includes('green')) totalPayout += (summary.color['green'] || 0) * 1.5;
              } else {
                if (colors.includes('red')) totalPayout += (summary.color['red'] || 0) * 2;
                if (colors.includes('green')) totalPayout += (summary.color['green'] || 0) * 2;
              }
              return summary.totalAmount - totalPayout;
            };

            return (
              <div key={mode.id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-sm">{mode.label}</h3>
                  <div className="text-xs font-bold text-gray-500">Total Bets: Rs {summary?.totalAmount || 0}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-xl border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase">Big Bets</div>
                    <div className="font-black text-lg">Rs {summary?.size?.Big || 0}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase">Small Bets</div>
                    <div className="font-black text-lg">Rs {summary?.size?.Small || 0}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase mb-2">Force Result (Admin Profit)</div>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                      const profit = calculateAdminProfit(num);
                      return (
                        <button 
                          key={num}
                          onClick={() => handleForceResult(mode.id, num)} 
                          className="flex flex-col items-center justify-center p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-all active:scale-95"
                        >
                          <span className={cn(
                            "text-lg font-black",
                            [1,3,7,9].includes(num) ? "text-green-500" : [2,4,6,8].includes(num) ? "text-red-500" : "text-purple-500"
                          )}>{num}</span>
                          <span className={cn(
                            "text-[9px] font-bold",
                            profit >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {profit >= 0 ? '+' : ''}{profit}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Bets List */}
                <div className="mt-6">
                  <div className="text-[10px] font-black text-gray-400 uppercase mb-2">Active User Bets</div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                      {summary?.rawBets && summary.rawBets.length > 0 ? (
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="p-2 font-bold text-gray-500">User</th>
                              <th className="p-2 font-bold text-gray-500">Bet On</th>
                              <th className="p-2 font-bold text-gray-500 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {summary.rawBets.map((bet, i) => (
                              <tr key={i} className="hover:bg-gray-50 transition-colors">
                                <td className="p-2 truncate max-w-[100px]" title={bet.userEmail}>{bet.userEmail}</td>
                                <td className="p-2">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                    bet.type === 'color' && bet.value === 'red' ? "bg-red-100 text-red-600" :
                                    bet.type === 'color' && bet.value === 'green' ? "bg-green-100 text-green-600" :
                                    bet.type === 'color' && bet.value === 'violet' ? "bg-purple-100 text-purple-600" :
                                    bet.type === 'size' && bet.value === 'Big' ? "bg-yellow-100 text-yellow-600" :
                                    bet.type === 'size' && bet.value === 'Small' ? "bg-blue-100 text-blue-600" :
                                    "bg-gray-100 text-gray-600"
                                  )}>
                                    {bet.value}
                                  </span>
                                </td>
                                <td className="p-2 text-right font-black">Rs {bet.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-4 text-center text-gray-400 text-xs font-bold">No active bets</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ad Setup Section */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 p-8 mb-8">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2 uppercase tracking-tight">
          <Zap className="text-orange-500" size={24} /> Ad Setup
        </h2>
        <p className="text-xs text-gray-400 font-bold mb-4">Paste your HTML ad code below. This will be displayed at the bottom of the app.</p>
        <textarea
          value={adHtml}
          onChange={(e) => setAdHtml(e.target.value)}
          className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-2xl font-mono text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
          placeholder="<div style='background: #ff0; padding: 10px;'>Your Ad Here</div>"
        />

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-xs font-black text-gray-700 uppercase tracking-wider">Show on Home Screen</span>
            <button 
              onClick={() => setShowOnHome(!showOnHome)}
              className={cn(
                "w-12 h-6 rounded-full relative transition-all duration-300",
                showOnHome ? "bg-green-500" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm",
                showOnHome ? "left-7" : "left-1"
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-xs font-black text-gray-700 uppercase tracking-wider">Show on Wallet Screen</span>
            <button 
              onClick={() => setShowOnWallet(!showOnWallet)}
              className={cn(
                "w-12 h-6 rounded-full relative transition-all duration-300",
                showOnWallet ? "bg-green-500" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm",
                showOnWallet ? "left-7" : "left-1"
              )} />
            </button>
          </div>
        </div>

        <button
          onClick={handleSaveAd}
          disabled={isSavingAd}
          className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-500/20 active:scale-95"
        >
          {isSavingAd ? "Saving..." : "Save Ad Settings"}
        </button>
      </div>

      {/* User Management */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-black uppercase tracking-tight">User Management</h2>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-green-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all active:scale-95"
          >
            <UserPlus size={16} /> Add User
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">
                <th className="p-6 font-black">User Details</th>
                <th className="p-6 font-black">Balance</th>
                <th className="p-6 font-black">Status</th>
                <th className="p-6 font-black">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {users.filter(u => !u.deleted).map((u, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-colors">
                  <td className="p-6">
                    <div className="flex flex-col">
                      <span className="font-black text-gray-900">{u.email}</span>
                      <span className="text-[10px] text-gray-400 font-bold">ID: {u.id}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-green-600">Rs {u.balance?.toLocaleString() || 0}</span>
                      <button 
                        onClick={() => setAdjustingUser({ id: u.id, type: 'add' })}
                        className="p-1.5 bg-green-50 rounded-lg text-green-600 hover:bg-green-100 transition-colors"
                        title="Add Balance"
                      >
                        <Plus size={14} />
                      </button>
                      <button 
                        onClick={() => setAdjustingUser({ id: u.id, type: 'cut' })}
                        className="p-1.5 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                        title="Cut Balance"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      u.isBlocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                    )}>
                      {u.isBlocked ? "Blocked" : "Active"}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleToggleBlock(u.id, u.isBlocked)}
                        title={u.isBlocked ? "Unblock User" : "Block User"}
                        className={cn(
                          "p-2 rounded-xl transition-all active:scale-90",
                          u.isBlocked ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                        )}
                      >
                        {u.isBlocked ? <CheckCircle size={18} /> : <Ban size={18} />}
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        title="Delete User"
                        className="p-2 bg-red-50 rounded-xl text-red-500 hover:bg-red-100 transition-all active:scale-90"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">Add New User</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Email Address</label>
                  <input 
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 font-bold"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Initial Balance (Rs)</label>
                  <input 
                    type="number"
                    value={newBalance}
                    onChange={(e) => setNewBalance(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 font-bold"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-400 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateUser}
                    disabled={isCreating}
                    className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                  >
                    {isCreating ? "Creating..." : "Create User"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdrawal Details Modal */}
      <AnimatePresence>
        {viewingWithdrawal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">Withdrawal Details</h2>
              <div className="space-y-4 text-sm">
                <p><strong>Account:</strong> {viewingWithdrawal.accountDetails}</p>
                <p><strong>Amount:</strong> Rs {viewingWithdrawal.amount}</p>
                <p><strong>Method:</strong> {viewingWithdrawal.method}</p>
                {viewingWithdrawal.screenshotBase64 && (
                  <div>
                    <p className="font-bold mb-2">Screenshot:</p>
                    <img src={viewingWithdrawal.screenshotBase64} alt="Withdrawal Screenshot" className="w-full rounded-xl" />
                  </div>
                )}
              </div>
              <button 
                onClick={() => setViewingWithdrawal(null)}
                className="w-full mt-8 bg-gray-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balance Adjustment Modal */}
      <AnimatePresence>
        {adjustingUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-black mb-2 uppercase tracking-tight">
                {adjustingUser.type === 'add' ? 'Add Balance' : 'Cut Balance'}
              </h2>
              <p className="text-xs text-gray-400 font-bold mb-6">
                {adjustingUser.type === 'add' ? 'Enter amount to add.' : 'Enter amount to subtract.'}
              </p>
              
              <div className="space-y-4">
                <input 
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-100 p-6 rounded-3xl focus:outline-none focus:ring-2 focus:ring-green-500 font-black text-3xl text-center"
                  placeholder="0"
                />
                
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setAdjustingUser(null)}
                    className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-400 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      const user = users.find(u => u.id === adjustingUser.id);
                      if (user) {
                        const finalAmount = adjustingUser.type === 'add' ? adjustAmount : -adjustAmount;
                        handleAdjustBalance(user.id, user.balance || 0, finalAmount);
                      }
                    }}
                    className={cn(
                      "flex-1 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all",
                      adjustingUser.type === 'add' ? "bg-green-600 shadow-green-500/20" : "bg-red-600 shadow-red-500/20"
                    )}
                  >
                    Update Balance
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
