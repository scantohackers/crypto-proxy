const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const url = require('url');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (client, req) => {
  const { pathname } = url.parse(req.url, true);
  const parts = pathname.split('/');

  const exchange = parts[2]; // binance
  const pair = parts[3];     // btcusdt

  let targetWS;

  if (exchange === 'binance') {
    targetWS = new WebSocket(`wss://stream.binance.com:9443/ws/${pair}@depth`);
  } else {
    client.send(JSON.stringify({ error: 'Exchange not supported' }));
    client.close();
    return;
  }

  targetWS.on('message', (data) => {
    client.send(data);
  });

  client.on('close', () => {
    targetWS.close();
  });
});

app.get('/', (req, res) => {
  res.send('🟢 Proxy server running');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});
