import WebSocket from "ws";

const target =
  "wss://ws.smartwheel.com/websocket/services?master&domain=1win.com&version=1.3.393";

console.log("Connecting to:", target);

const ws = new WebSocket(target, {
  headers: {
    Origin: "https://1win.com",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36",
  },
});

ws.on("open", () => {
  console.log("✅ CONNECTED TO LIVE WS");
});

ws.on("message", (data) => {
  console.log("\n======================");
  console.log("📦 NEW MESSAGE");

  if (Buffer.isBuffer(data)) {
    console.log("HEX:");
    console.log(data.toString("hex"));

    try {
      console.log("\nTEXT:");
      console.log(data.toString());
    } catch (e) {
      console.log("Decode failed");
    }
  } else {
    console.log(data);
  }
});

ws.on("error", (err) => {
  console.error("❌ ERROR:", err);
});

ws.on("close", (code, reason) => {
  console.log("🔌 CLOSED:", code, reason.toString());
});