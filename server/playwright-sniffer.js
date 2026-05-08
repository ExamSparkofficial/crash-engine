import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

// =========================
// INITIALIZATION
// =========================
const prisma = new PrismaClient();
const OUTPUT_FILE = path.resolve("./aviator-live-data.ndjson");

// In-memory ML Tracking
let currentStreakType = "low";
let currentStreakLength = 0;
let historyQueue = []; // Last 5 rounds for MA_5

// Global Liquidity Tracking
let currentActivePlayers = 0;
let currentTotalBets = 0;

// =========================
// HELPERS
// =========================
function appendData(data) {
  fs.appendFileSync(OUTPUT_FILE, JSON.stringify(data) + "\n");
}

function hexToDouble(hexString) {
  try {
    const buf = Buffer.from(hexString, "hex");
    return buf.readDoubleBE(0);
  } catch (e) {
    return null;
  }
}

// =========================
// DATABASE INGESTION ENGINE
// =========================
async function processAndSaveRound(crashData) {
  try {
    const { ts, multiplier, players, betsCount } = crashData;

    // 1. Get Prev Multiplier
    const prevMultiplier = historyQueue.length > 0 ? historyQueue[historyQueue.length - 1] : null;

    // 2. Calculate MA_5
    historyQueue.push(multiplier);
    if (historyQueue.length > 5) {
      historyQueue.shift(); 
    }
    
    let ma5 = null;
    if (historyQueue.length === 5) {
      const sum = historyQueue.reduce((a, b) => a + b, 0);
      ma5 = Number((sum / 5).toFixed(2));
    }

    // 3. Calculate Streak
    const isLow = multiplier < 2.0;
    const newStreakType = isLow ? "low" : "high";

    if (newStreakType === currentStreakType) {
      currentStreakLength += 1;
    } else {
      currentStreakType = newStreakType;
      currentStreakLength = 1;
    }

    const streakUnder2x = currentStreakType === "low" ? currentStreakLength : 0;

    const mlReadyData = {
      type: "ws_round_crash",
      ts: ts,
      crash_multiplier: multiplier,
      prev_multiplier: prevMultiplier,
      streak_under_2x: streakUnder2x,
      ma_5: ma5,
      active_players: players,
      total_bets: betsCount
    };

    console.log(`\n🚀 [CRASH DETECTED]: ${multiplier}x`);
    console.log(`📊 [ML DATA] Prev: ${prevMultiplier || 'N/A'}x | MA_5: ${ma5 || 'calc...'} | Players: ${players} | Bets: ${betsCount}`);

    appendData(mlReadyData);

    // 5. Save to PostgreSQL
    const savedRound = await prisma.round.create({
      data: {
        multiplier: multiplier,
        source: "websocket_hex",
        eventType: "crash",
        streakType: currentStreakType,
        streakLength: currentStreakLength,
        createdAt: new Date(ts), 
        players: players > 0 ? players : null,
        bets: betsCount > 0 ? betsCount : null,
        volatilityScore: ma5 ? ma5 : 0 
      },
    });

  } catch (error) {
    console.error("❌ [DB ERROR] Failed to save round:", error.message);
  }
}

// =========================
// MAIN SCRAPER ENGINE (CLOUD OPTIMIZED)
// =========================
(async () => {
  console.log("🚀 Launching Headless Chrome on Cloud Server...");

  let browser;
  try {
    // CLOUD LAUNCH LOGIC (No CDP, fully headless)
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Crucial for Linux VMs
        '--disable-gpu'
      ]
    });
  } catch (err) {
    console.error("❌ Failed to launch browser:", err);
    return;
  }

  // Creating a new context and page cleanly
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🔥 Connected! Navigating to game...");
  await page.goto("https://1win.com/casino/play/v_spribe:aviator", {
    waitUntil: "domcontentloaded",
  });

  page.on("websocket", (ws) => {
    ws.on("framereceived", (payload) => {
      try {
        const buffer = Buffer.isBuffer(payload.payload)
          ? payload.payload
          : Buffer.from(payload.payload);

        const hexString = buffer.toString("hex");
        
        // EXTRACTION 1: LIVE LIQUIDITY (Players & Bets)
        const playersKey = "616374697665506c6179657273436f756e74"; 
        const betsKey = "6f70656e42657473436f756e74"; 

        if (hexString.includes(playersKey)) {
          const idx = hexString.indexOf(playersKey) + playersKey.length;
          if (hexString.substring(idx, idx + 2) === "04") {
            const intHex = hexString.substring(idx + 2, idx + 10);
            currentActivePlayers = parseInt(intHex, 16) || currentActivePlayers;
          }
        }

        if (hexString.includes(betsKey)) {
          const idx = hexString.indexOf(betsKey) + betsKey.length;
          if (hexString.substring(idx, idx + 2) === "04") {
            const intHex = hexString.substring(idx + 2, idx + 10);
            currentTotalBets = parseInt(intHex, 16) || currentTotalBets;
          }
        }

        // EXTRACTION 2: CRASH POINT
        const crashKey = "6d61784d756c7469706c696572"; 

        if (hexString.includes(crashKey)) {
          const keyIndex = hexString.indexOf(crashKey);
          const valueStart = keyIndex + crashKey.length;
          const chunk = hexString.substring(valueStart, valueStart + 20);

          if (chunk.startsWith("07")) {
            const doubleHex = chunk.substring(2, 18);
            
            if (doubleHex.length === 16) {
              const decodedValue = hexToDouble(doubleHex);

              if (decodedValue && decodedValue >= 1 && decodedValue < 10000) {
                const finalMultiplier = Number(decodedValue.toFixed(2));
                
                const crashObject = {
                  ts: Date.now(),
                  multiplier: finalMultiplier,
                  players: currentActivePlayers,
                  betsCount: currentTotalBets
                };
                
                processAndSaveRound(crashObject);

                currentActivePlayers = 0;
                currentTotalBets = 0;
              }
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });
  });

})();
