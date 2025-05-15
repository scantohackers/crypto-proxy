// index.js

const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const url = require("url");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get("/", (req, res) => {
  res.send("🟢 WebSocket Proxy is running");
});

wss.on("connection", (client, req) => {
  const { pathname } = url.parse(req.url);
  const parts = pathname.split("/");

  const exchange = parts[2]; // e.g., 'binance'
  const pair = parts[3];     // e.g., 'btcusdt'

  if (exchange !== "binance" || !pair) {
    client.send(JSON.stringify({ error: "Unsupported or missing symbol" }));
    client.close();
    return;
  }

  const streamUrl = `wss://stream.binance.com:9443/stream?streams=${pair}@ticker/${pair}@depth`;
  const binanceWS = new WebSocket(streamUrl);

  const combined = {
    price: null,
    percent: null,
    bids: null,
    asks: null,
  };

  const sendIfComplete = () => {
    if (combined.price && combined.percent && combined.bids && combined.asks) {
      const fullData = {
        c: combined.price,
        P: combined.percent,
        b: combined.bids,
        a: combined.asks
      };
      client.send(JSON.stringify(fullData));
    }
  };

  binanceWS.on("open", () => {
    console.log(`✅ Connected to Binance stream for ${pair}`);
  });

  binanceWS.on("message", (data) => {
    try {
      console.log("🔥 Received from Binance:", data); // Debug log
      const msg = JSON.parse(data);
      const stream = msg.stream;
      const json = msg.data;

      if (stream.endsWith("@ticker")) {
        combined.price = json.c;
        combined.percent = json.P;
      } else if (stream.endsWith("@depth")) {
        combined.bids = json.b;
        combined.asks = json.a;
      }

      sendIfComplete();

    } catch (e) {
      console.error("❌ Failed to parse message:", e.message);
    }
  });

  binanceWS.on("error", (err) => {
    console.error("❌ Binance WebSocket error:", err.message);
  });

  binanceWS.on("close", () => {
    console.log("🔌 Binance WebSocket closed");
  });

  client.on("close", () => {
    if (binanceWS.readyState === WebSocket.OPEN) {
      binanceWS.close();
    }
  });
});

const PORT = process.env.PORT;

server.listen(PORT, () => {
  console.log(`✅ Proxy server running on port ${PORT}`);
});
 
