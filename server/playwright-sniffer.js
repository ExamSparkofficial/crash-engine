import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

// =========================
// INITIALIZATION
// =========================
const prisma = new PrismaClient();
const OUTPUT_FILE = path.resolve("./aviator-live-data.ndjson");
const ML_FILE = path.resolve("./ml-dataset.ndjson"); // Naya file ML training ke liye

// In-memory tracking for ML Features
let currentStreakType = "low";
let currentStreakLength = 0;
let historyQueue = []; // Last 5 rounds store karne ke liye

// =========================
// HELPERS
// =========================
function sanitizeText(str) {
  return str
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function appendData(file, data) {
  fs.appendFileSync(file, JSON.stringify(data) + "\n");
}

// Custom hex to double parser (Big-Endian IEEE 754)
function hexToDouble(hexString) {
  try {
    const buf = Buffer.from(hexString, "hex");
    return buf.readDoubleBE(0);
  } catch (e) {
    return null;
  }
}

// =========================
// DATABASE INGESTION & ML FEATURE ENGINE
// =========================
async function saveRoundToDatabase(multiplierData) {
  try {
    const { ts, multiplier } = multiplierData;

    // 1. Calculate Prev Multiplier
    const prevMultiplier = historyQueue.length > 0 ? historyQueue[historyQueue.length - 1] : null;

    // 2. Calculate MA_5 (Moving Average of last 5)
    historyQueue.push(multiplier);
    if (historyQueue.length > 5) {
      historyQueue.shift(); // Purana data nikal do, sirf last 5 rakho
    }
    
    let ma5 = null;
    if (historyQueue.length === 5) {
      const sum = historyQueue.reduce((a, b) => a + b, 0);
      ma5 = Number((sum / 5).toFixed(2));
    }

    // 3. Calculate Streak Logic
    const isLow = multiplier < 2.0;
    const newStreakType = isLow ? "low" : "high";

    if (newStreakType === currentStreakType) {
      currentStreakLength += 1;
    } else {
      currentStreakType = newStreakType;
      currentStreakLength = 1; // Streak reset
    }

    const streakUnder2x = currentStreakType === "low" ? currentStreakLength : 0;

    // 4. Update the JSON object with ML features before saving
    const mlReadyData = {
      ts: ts,
      crash_multiplier: multiplier,
      prev_multiplier: prevMultiplier,
      streak_under_2x: streakUnder2x,
      ma_5: ma5,
      // total_bets: null // Ise hum next step mein hex se nikalenge
    };

    console.log(`📊 [ML DATA] Prev: ${prevMultiplier || 'N/A'}x | Streak <2x: ${streakUnder2x} | MA_5: ${ma5 || 'calc...'} | CRASH: ${multiplier}x`);

    // Save ML data to a separate JSON lines file
    appendData(ML_FILE, mlReadyData);

    // 5. Insert into PostgreSQL via Prisma
    const savedRound = await prisma.round.create({
      data: {
        multiplier: multiplier,
        source: "websocket_hex",
        eventType: "crash",
        streakType: currentStreakType,
        streakLength: currentStreakLength,
        createdAt: new Date(ts), 
        players: null,
        bets: null,
        cashouts: null,
        volatilityScore: 0 
      },
    });

  } catch (error) {
    console.error("❌ [DB ERROR] Failed to save round:", error.message);
  }
}

// =========================
// MAIN SCRAPER ENGINE
// =========================
(async () => {
  console.log("🚀 Connecting to REAL Chrome via CDP...");

  let browser;
  try {
    browser = await chromium.connectOverCDP("http://localhost:9222");
  } catch (err) {
    console.error("❌ Failed to connect to CDP. Is Chrome running with port 9222?");
    return;
  }

  const context = browser.contexts()[0];
  let page = context.pages()[0];

  if (!page) {
    page = await context.newPage();
  }

  console.log("🔥 Connected! Navigating to game...");
  await page.goto("https://1win.com/casino/play/v_spribe:aviator", {
    waitUntil: "domcontentloaded",
  });

  // =========================
  // METHOD 1: API INTERCEPTION
  // =========================
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("spribe") || url.includes("api/history") || url.includes("crash")) {
      try {
        const body = await response.json();
        
        appendData(OUTPUT_FILE, {
          type: "api_intercept",
          ts: Date.now(),
          url: url,
          data: body,
        });
      } catch (e) {
        // Not JSON, ignore silently
      }
    }
  });

  // =========================
  // METHOD 2: WEBSOCKET HEX DECODING (UPDATED FOR CRASH POINT)
  // =========================
  page.on("websocket", (ws) => {
    ws.on("framereceived", (payload) => {
      try {
        const buffer = Buffer.isBuffer(payload.payload)
          ? payload.payload
          : Buffer.from(payload.payload);

        const hexString = buffer.toString("hex");
        
        // Hex representation of "maxMultiplier" -> 6d61784d756c7469706c696572
        const crashKey = "6d61784d756c7469706c696572";

        if (hexString.includes(crashKey)) {
          const keyIndex = hexString.indexOf(crashKey);
          
          // Move cursor past the "maxMultiplier" key
          const valueStart = keyIndex + crashKey.length;

          // Grab the next 20 hex characters (10 bytes).
          const chunk = hexString.substring(valueStart, valueStart + 20);

          // Type marker for double usually starts with '07'
          if (chunk.startsWith("07")) {
            const doubleHex = chunk.substring(2, 18);
            
            if (doubleHex.length === 16) {
              const decodedValue = hexToDouble(doubleHex);

              // Filter out invalid data
              if (decodedValue && decodedValue >= 1 && decodedValue < 10000) {
                const finalMultiplier = Number(decodedValue.toFixed(2));
                
                const obj = {
                  type: "ws_round_crash",
                  ts: Date.now(),
                  multiplier: finalMultiplier, // Keeping key as 'multiplier' for DB function compatibility
                };
                
                console.log("🚀 [ACTUAL CRASH DETECTED]:", obj.multiplier + "x");
                
                // Save to JSON
                appendData(OUTPUT_FILE, obj);
                
                // Process ML features & Save to Database
                saveRoundToDatabase(obj);
              }
            }
          }
        }
      } catch (e) {
        // Ignore WS frame parsing errors to prevent console spam
      }
    });
  });

  // =========================
  // METHOD 3: IFRAME DOM SCRAPING
  // =========================
  let lastExtractedMultiplier = null;

  setInterval(async () => {
    try {
      const frames = page.frames();
      const gameFrame = frames.find(
        (f) => f.url().includes("spribe") || f.url().includes("aviator")
      );

      if (!gameFrame) return;

      const multiplierText = await gameFrame.evaluate(() => {
        const bubbles = document.querySelectorAll(".payouts-block .bubble, .multiplier-history div");
        if (bubbles && bubbles.length > 0) {
          return bubbles[0].innerText.trim();
        }
        return null;
      });

      if (!multiplierText) return;

      if (/^\d+(\.\d+)?x$/i.test(multiplierText) && multiplierText !== lastExtractedMultiplier) {
        lastExtractedMultiplier = multiplierText;
        const cleanMultiplier = parseFloat(multiplierText.replace("x", ""));

        const obj = {
          type: "iframe_dom_multiplier",
          ts: Date.now(),
          multiplier: cleanMultiplier,
        };

        appendData(OUTPUT_FILE, obj);
        // Note: Not saving Iframe data to DB to prevent duplicate entries, 
        // since WS hex decoder is already capturing it perfectly.
        // console.log("🎯 IFRAME LIVE:", obj); // Commented out to keep terminal clean
      }
    } catch (e) {
      // Ignore evaluation errors caused by fast DOM changes
    }
  }, 500); 

})();