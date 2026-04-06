import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('./firebase-applet-config.json');

dotenv.config();

let db: admin.firestore.Firestore;
const expressApp = express();



process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  console.log("[SERVER] Initializing server...");
  try {
    const firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId
    });
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("[SERVER] Firebase initialized successfully.");
    console.log("[SERVER] Project ID:", firebaseConfig.projectId);
    console.log("[SERVER] Database ID:", firebaseConfig.firestoreDatabaseId);

    const serverApp = express();
    const PORT = 3000;

    serverApp.use(cors());
    serverApp.use(express.json());

    // Request logging
    serverApp.use((req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        console.log(`[API] ${req.method} ${req.originalUrl}`);
      }
      next();
    });

    // Mock Database
  const history: any = {};
  const activeBets: any[] = [];
  const userBetHistory: any[] = [];
  
  const gameModes = {
    "30s": 30,
    "1m": 60,
    "3m": 180,
    "5m": 300
  };

  const gameStates: any = {
    "30s": { period: 202603310001, startTime: Date.now(), duration: 30, lastResult: null, forcedResult: null },
    "1m": { period: 202603310002, startTime: Date.now(), duration: 60, lastResult: null, forcedResult: null },
    "3m": { period: 202603310003, startTime: Date.now(), duration: 180, lastResult: null, forcedResult: null },
    "5m": { period: 202603310004, startTime: Date.now(), duration: 300, lastResult: null, forcedResult: null }
  };

  // Game Loop
  setInterval(async () => {
    try {
      for (const mode of Object.keys(gameStates)) {
        const elapsed = Math.floor((Date.now() - gameStates[mode].startTime) / 1000);
        if (elapsed >= gameStates[mode].duration) {
          const betsToSettle = activeBets.filter(b => b.mode === mode && b.period === gameStates[mode].period);
          const totalBetsAmount = betsToSettle.reduce((sum, b) => sum + b.amount, 0);
          
          let num: number;
          if (gameStates[mode].forcedResult !== null) {
            num = gameStates[mode].forcedResult;
            gameStates[mode].forcedResult = null; // Reset after use
          } else {
            let bestNumber = 0;
            let minPayout = Infinity;
            const possibleNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
            
            // Shuffle to avoid bias if payouts are equal
            possibleNumbers.sort(() => Math.random() - 0.5);

            possibleNumbers.forEach(n => {
              const bigSmall = n >= 5 ? "Big" : "Small";
              let colors: string[] = [];
              if ([1, 3, 7, 9].includes(n)) colors.push("green");
              else if ([2, 4, 6, 8].includes(n)) colors.push("red");
              else if (n === 0) colors.push("red", "violet");
              else if (n === 5) colors.push("green", "violet");

              let currentPayout = 0;
              betsToSettle.forEach(bet => {
                if (bet.type === 'number') {
                  if (bet.value === n) currentPayout += bet.amount * 9;
                } else if (bet.type === 'color') {
                  if (colors.includes(bet.value)) {
                    if (bet.value === 'violet') currentPayout += bet.amount * 4.5;
                    else if (n === 0 || n === 5) currentPayout += bet.amount * 1.5;
                    else currentPayout += bet.amount * 2;
                  }
                } else if (bet.type === 'size') {
                  if (bet.value === bigSmall) currentPayout += bet.amount * 2;
                }
              });

              if (currentPayout < minPayout) {
                minPayout = currentPayout;
                bestNumber = n;
              }
            });
            num = bestNumber;
          }
          
          console.log(`[GAME] Mode: ${mode}, Period: ${gameStates[mode].period}, Total Bets: ${totalBetsAmount}, Result: ${num}`);
          const bigSmall = num >= 5 ? "Big" : "Small";
          let colors = [];
          if ([1, 3, 7, 9].includes(num)) colors.push("green");
          else if ([2, 4, 6, 8].includes(num)) colors.push("red");
          else if (num === 0) colors.push("red", "violet");
          else if (num === 5) colors.push("green", "violet");

          const result = {
            period: gameStates[mode].period,
            number: num,
            bigSmall,
            colors,
            timestamp: Date.now()
          };

          // Settle Bets
          for (const bet of betsToSettle) {
            let winAmount = 0;
            let won = false;

            if (bet.type === 'number') {
              if (bet.value === result.number) {
                winAmount = bet.amount * 9;
                won = true;
              }
            } else if (bet.type === 'color') {
              if (result.colors.includes(bet.value)) {
                won = true;
                if (bet.value === 'violet') {
                  winAmount = bet.amount * 4.5;
                } else {
                  // If result is 0 or 5, payout is 1.5x for Red/Green
                  if (result.number === 0 || result.number === 5) {
                    winAmount = bet.amount * 1.5;
                  } else {
                    winAmount = bet.amount * 2;
                  }
                }
              }
            } else if (bet.type === 'size') {
              if (bet.value === result.bigSmall) {
                winAmount = bet.amount * 2;
                won = true;
              }
            }

            if (won) {
              console.log(`[SERVER] User ${bet.userId} won ${winAmount} on ${mode} period ${bet.period}`);
              // Balance update is now handled by the client to avoid server-side permission issues
            }

            userBetHistory.unshift({
              ...bet,
              result,
              winAmount: won ? winAmount : 0,
              status: won ? 'win' : 'loss',
              settledAt: Date.now()
            });
          }

          // Remove settled bets
          const remainingBets = activeBets.filter(b => !(b.mode === mode && b.period === result.period));
          activeBets.length = 0;
          activeBets.push(...remainingBets);

          // Add to history (keep last 50)
          if (!history[mode]) history[mode] = [];
          history[mode].unshift(result);
          if (history[mode].length > 50) history[mode].pop();

          // Reset Timer
          gameStates[mode].startTime = Date.now();
          gameStates[mode].period++;
          gameStates[mode].lastResult = result;
        }
      }
    } catch (err) {
      console.error('[GAME] Error in game loop:', err);
    }
  }, 1000);

    // API Router
    const apiRouter = express.Router();

    apiRouter.use((req, res, next) => {
      console.log(`[API ROUTER] ${req.method} ${req.originalUrl}`);
      next();
    });

    apiRouter.get("/health", (req, res) => {
      res.json({ 
        status: "ok", 
        timestamp: Date.now(),
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId
      });
    });

    apiRouter.get("/ping", (req, res) => {
      res.send("pong");
    });

    // Admin endpoints
    let cachedStats: any = null;
    let lastStatsFetch = 0;
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // Removed unused Firestore endpoints to avoid server-side permission issues

    apiRouter.get("/admin/bets", (req, res) => {
      const summaries: any = {};
      for (const mode of Object.keys(gameStates)) {
        const state = gameStates[mode];
        const bets = activeBets.filter(b => b.mode === mode && b.period === state.period);
        
        const summary = {
          totalAmount: 0,
          size: { Big: 0, Small: 0 },
          color: { red: 0, green: 0, violet: 0 },
          number: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
          rawBets: bets
        };

        for (const bet of bets) {
          summary.totalAmount += bet.amount;
          if (bet.type === 'size') {
            summary.size[bet.value as 'Big' | 'Small'] += bet.amount;
          } else if (bet.type === 'color') {
            summary.color[bet.value as 'red' | 'green' | 'violet'] += bet.amount;
          } else if (bet.type === 'number') {
            summary.number[bet.value as keyof typeof summary.number] += bet.amount;
          }
        }
        summaries[mode] = summary;
      }
      res.json(summaries);
    });

    apiRouter.get("/admin/bets/:mode", (req, res) => {
      const { mode } = req.params;
      const state = gameStates[mode];
      if (!state) return res.status(404).json({ error: "Invalid mode" });
      
      const bets = activeBets.filter(b => b.mode === mode && b.period === state.period);
      const summary = bets.reduce((acc, bet) => {
        if (bet.type === 'size') {
          acc[bet.value] = (acc[bet.value] || 0) + bet.amount;
        }
        return acc;
      }, { Big: 0, Small: 0 });
      
      res.json(summary);
    });

    apiRouter.post("/admin/set-result", (req, res) => {
      const { mode, result } = req.body;
      if (!gameStates[mode]) return res.status(404).json({ error: "Invalid mode" });
      
      // result should be 0-9
      const num = parseInt(result);
      if (isNaN(num) || num < 0 || num > 9) return res.status(400).json({ error: "Invalid result" });
      
      gameStates[mode].forcedResult = num;
      res.json({ message: `Forced result set to ${num} for ${mode}` });
    });

    apiRouter.get("/user-bets", (req, res) => {
      const { userId } = req.query;
      if (!userId) {
        return res.json([]);
      }
      
      // Get settled bets
      const settled = userBetHistory.filter(b => b.userId === userId);
      
      // Get pending bets
      const pending = activeBets.filter(b => b.userId === userId).map(b => ({
        ...b,
        status: 'pending'
      }));
      
      res.json([...pending, ...settled].slice(0, 20));
    });

    apiRouter.get("/game-state/:mode", (req, res) => {
      const { mode } = req.params;
      const state = gameStates[mode];
      if (!state) {
        return res.status(404).json({ error: `Game mode ${mode} not found` });
      }
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      const timeLeft = Math.max(0, state.duration - elapsed);
      res.json({ ...state, timeLeft });
    });

    apiRouter.get("/history/:mode", (req, res) => {
      const { mode } = req.params;
      res.json(history[mode] || []);
    });

    // Removed unused Firestore endpoints to avoid server-side permission issues

    apiRouter.post("/bet", async (req, res) => {
      const { mode, amount, type, value, userId, userEmail } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }

      const state = gameStates[mode];
      if (!state) {
        return res.status(404).json({ error: "Invalid game mode" });
      }

      try {
        const bet = {
          id: Date.now() + Math.random(),
          userId,
          userEmail: userEmail || 'Unknown',
          mode,
          amount,
          type,
          value,
          period: state.period,
          placedAt: Date.now()
        };

        activeBets.push(bet);
        
        res.json({ message: "Bet placed successfully" });
      } catch (error: any) {
        console.error("[SERVER] Error placing bet:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Mount API router
    serverApp.use("/api", apiRouter);

    // 404 handler for API routes
    apiRouter.all('*', (req, res) => {
      console.warn(`[API] 404 Not Found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ 
        error: "API route not found", 
        method: req.method, 
        path: req.originalUrl 
      });
    });

    // Global error handler
    serverApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error("[SERVER] Unhandled Error:", err);
      res.status(500).json({ error: "Internal Server Error", message: err.message });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      serverApp.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      serverApp.use(express.static(distPath));
      serverApp.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    serverApp.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}

startServer();
