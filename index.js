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

  const exchange = parts[2]; // e.g. 'binance'
  const pair = parts[3];     // e.g. 'btcusdt'

  if (exchange !== "binance" || !pair) {
    client.send(JSON.stringify({ error: "Unsupported or missing symbol" }));
    client.close();
    return;
  }

  // Connect to both @ticker and @depth
  const tickerWS = new WebSocket(`wss://stream.binance.com:9443/ws/${pair}@ticker`);
  const depthWS = new WebSocket(`wss://stream.binance.com:9443/ws/${pair}@depth`);

  const combined = {
    price: null,
    percent: null,
    bids: null,
    asks: null,
  };

  const sendIfComplete = () => {
    if (combined.price && combined.percent && combined.bids && combined.asks) {
      client.send(JSON.stringify({
        c: combined.price,
        P: combined.percent,
        b: combined.bids,
        a: combined.asks
      }));
    }
  };

  tickerWS.on("message", (data) => {
    const json = JSON.parse(data);
    combined.price = json.c;
    combined.percent = json.P;
    sendIfComplete();
  });

  depthWS.on("message", (data) => {
    const json = JSON.parse(data);
    combined.bids = json.b;
    combined.asks = json.a;
    sendIfComplete();
  });

  // Clean up
  const closeAll = () => {
    if (tickerWS.readyState === WebSocket.OPEN) tickerWS.close();
    if (depthWS.readyState === WebSocket.OPEN) depthWS.close();
  };

  client.on("close", closeAll);
  client.on("error", closeAll);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Proxy server running on port ${PORT}`);
});
