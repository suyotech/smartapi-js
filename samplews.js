const WebSocket = require("ws");

class SmartAPIWebSocketClient {
  constructor(apiKey, clientId, feedToken) {
    this.url = `wss://smartapisocket.angelone.in/smart-stream?clientCode=${clientId}&feedToken=${feedToken}&apiKey=${apiKey}`;
    this.apiKey = apiKey;
    this.clientId = clientId;
    this.feedToken = feedToken;
    this.reconnectInterval = 1000;
    this.maxReconnectInterval = 30000;
    this.reconnectDecay = 1.5;
    this.heartbeatInterval = 30000;
    this.messageQueue = [];
    this.liveData = new Map();
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.heartbeat();
      this.flushQueue();
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket closed", event);
      this.reconnect();
    };

    this.ws.onmessage = (message) => {
      const parsedMessage = this.parseMessage(message.data);
      this.updateLiveData(parsedMessage);
      console.log("Received message:", parsedMessage);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error", error);
    };
  }

  reconnect() {
    setTimeout(() => {
      this.reconnectInterval = Math.min(this.reconnectInterval * this.reconnectDecay, this.maxReconnectInterval);
      this.connect();
    }, this.reconnectInterval);
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.messageQueue.push(data);
    }
  }

  flushQueue() {
    while (this.messageQueue.length > 0) {
      this.send(this.messageQueue.shift());
    }
  }

  heartbeat() {
    setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      }
    }, this.heartbeatInterval);
  }

  parseMessage(data) {
    // Add binary data parsing logic here based on SmartAPI docs
    try {
      const parsed = JSON.parse(data);
      if (parsed.errorCode === "429") {
        this.handleRateLimit(parsed.retryAfter);
      }
      return parsed;
    } catch (e) {
      // Handle binary data parsing here
      return data;
    }
  }

  handleRateLimit(retryAfter) {
    this.ws.close();
    setTimeout(() => this.connect(), retryAfter * 1000);
  }

  updateLiveData(parsedMessage) {
    // Update live data map based on parsedMessage content
    if (parsedMessage && parsedMessage.token) {
      this.liveData.set(parsedMessage.token, parsedMessage);
    }
  }

  subscribe(instruments) {
    const tokenList = instruments.map((instrument) => ({
      exchangeType: this.getExchangeType(instrument.exch_seg),
      tokens: [instrument.token],
    }));

    const request = {
      correlationID: this.generateCorrelationID(),
      action: 1,
      params: {
        mode: 1, // Assuming full mode subscription
        tokenList,
      },
    };

    this.send(request);
  }

  unsubscribe(instruments) {
    const tokenList = instruments.map((instrument) => ({
      exchangeType: this.getExchangeType(instrument.exch_seg),
      tokens: [instrument.token],
    }));

    const request = {
      correlationID: this.generateCorrelationID(),
      action: 0,
      params: {
        mode: 1,
        tokenList,
      },
    };

    this.send(request);
  }

  getExchangeType(exch_seg) {
    const exchangeTypes = {
      NSE: 1,
      NSE_FO: 2,
      BSE: 3,
      BSE_FO: 4,
      MCX: 5,
      NCX_FO: 7,
      CDE_FO: 13,
    };
    return exchangeTypes[exch_seg] || 1;
  }

  generateCorrelationID() {
    return Math.random().toString(36).substring(2, 12);
  }

  getLiveData(token) {
    return this.liveData.get(token);
  }
}

// Usage example
const apiKey = "your_api_key";
const clientId = "your_client_id";
const feedToken = "your_feed_token";

const wsClient = new SmartAPIWebSocketClient(apiKey, clientId, feedToken);

const instruments = [
  {
    token: "21901",
    symbol: "655KL30-SG",
    name: "655KL30",
    expiry: "",
    strike: "-1.000000",
    lotsize: "100",
    instrumenttype: "",
    exch_seg: "NSE",
    tick_size: "1.000000",
  },
  // Add more instruments as needed
];

wsClient.subscribe(instruments);

wsClient.onmessage = (message) => {
  console.log("Received message:", message);
};

// Example of fetching live data
setTimeout(() => {
  const liveData = wsClient.getLiveData("21901");
  console.log("Live data for token 21901:", liveData);
}, 5000);
