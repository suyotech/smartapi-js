import WebSocket from "ws";
import { EventEmitter } from "events";
/**
 * @params apikey
 * @params jwtToken
 * @params feedToken
 * @params clientCode
 */
class SmartApiWS20 extends EventEmitter {
  constructor(apikey, jwtToken, feedToken, clientCode) {
    super();
    this.apikey = apikey;
    this.jwtToken = jwtToken;
    this.feedToken = feedToken;
    this.clientCode = clientCode;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 300;
    this.heartInterval = 30000;
    this.heartBeatTimer = null;
    this.subInstruments = new Set();
    this.initPromise = this.connect();
  }

  async connect() {
    this.socket = new WebSocket(
      "wss://smartapisocket.angelone.in/smart-stream",
      {
        headers: {
          Authorization: this.jwtToken,
          "x-api-key": this.apikey,
          "x-client-code": this.clientCode,
          "x-feed-token": this.feedToken,
        },
      }
    );

    this.socket.onopen = () => {
      console.log("Websocket connection successfull");
      this.setupHeartBeat();
      this.reconnectAttempts = 0;
      const subtokens = Array.from(this.subInstruments);
      if (subUnsubTokens.length > 0) {
        this.subscribe(subtokens);
      }
    };

    this.socket.onmessage = (event) => {
      const data = parseWSData(event.data);
      this.emit("data", data);
    };

    this.socket.onclose = (event) => {
      console.log("Websocket Connection Closed ");
      this.cleanup();
      this.reconnect();
    };

    this.socket.onerror = (error) => {
      console.log("Websocket error ", error?.message);
      // this.cleanup();
      // this.reconnect();
    };
  }

  async connectPromise() {
    return this.initPromise;
  }

  setupHeartBeat() {
    this.heartBeatTimer = setInterval(() => {
      this.socket.send("ping");
      console.log("sent ping ");
    }, this.heartInterval);
  }

  cleanup() {
    clearInterval(this.heartBeatTimer);
    this.heartBeatTimer = null;
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential delay in milliseconds
      console.log(
        `Attempting to reconnect in ${delay / 1000} seconds... Attemp count ${
          this.reconnectAttempts
        }`
      );
      setTimeout(() => {
        this.connect();
        this.reconnectAttempts++;
      }, delay);
    } else {
      console.error("Maximum reconnection attempts reached.");
    }
  }

  send(message) {
    if (this.socket.readyState == WebSocket.CLOSED) {
      this.connect();
    } else if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error("Websocket is not open");
      this.socket.terminate();
    }
  }

  async subscribe(instruments = []) {
    await this.initPromise;
    instruments.forEach((i) => this.subInstruments.add(i));
    const tokens = subUnsubTokens(1, wsModes.SnapQuote, instruments);
    await this.initPromise;
    this.send(tokens);
    console.log("Token Subscribed");
  }

  async unsubscribe(instruments = []) {
    await this.initPromise;
    const deltokens = instruments.map((d) => d.token);
    this.subInstruments.forEach((d) => {
      if (deltokens.includes(d.token)) {
        this.subInstruments.delete(d);
      }
    });
    const tokens = subUnsubTokens(0, wsModes.SnapQuote, instruments);
    await this.initPromise;
    this.send(tokens);
    console.log("Token Unsubscribed");
  }
}

const wsExchangeType = {
  NSE: 1,
  NFO: 2,
  BSE: 3,
  BFO: 4,
  MCX: 5,
  NCDEX: 7,
  CDS: 13,
};

const wsModes = {
  LTP: 1,
  Quote: 2,
  SnapQuote: 3,
};

export default SmartApiWS20;

function parseWSData(data) {
  if (typeof data === "string") {
    return data;
  } else if (typeof data === "object") {
    const buffer = Buffer.from(data);
    const obj = {};

    obj["submode"] = buffer.readInt8(0);
    obj["localtimestamp"] = Date.now();
    obj["exchange"] = buffer.readInt8(1);
    const tokenIdBuffer = buffer.slice(2, 2 + 25);
    obj["token"] = tokenIdBuffer.toString("utf-8").replace(/\0/g, "");
    obj["sequence_no"] = buffer.readIntLE(27, 6);
    obj["exchangetimestamp"] = buffer.readUIntLE(35, 6);
    obj["ltp"] = buffer.readUIntLE(43, 6) / 100;

    if (obj.submode === 2 || obj.submode === 3) {
      obj["ltqty"] = buffer.readUIntLE(51, 6);
      obj["avgprice"] = buffer.readUIntLE(59, 6) / 100;
      obj["volume"] = buffer.readUIntLE(67, 6);
      obj["tbquty"] = buffer.readDoubleLE(75, 6);
      obj["tsquty"] = buffer.readDoubleLE(83, 6);
      obj["dopen"] = buffer.readUIntLE(91, 6) / 100;
      obj["dhigh"] = buffer.readUIntLE(99, 6) / 100;
      obj["dlow"] = buffer.readUIntLE(107, 6) / 100;
      obj["prclose"] = buffer.readUIntLE(115, 6) / 100;
    }

    if (obj.submode === 3) {
      obj["lttimestamp"] = buffer.readUIntLE(123, 6);
      obj["oi"] = buffer.readUIntLE(131, 6);
      obj["uc"] = buffer.readUIntLE(347, 6) / 100;
      obj["lc"] = buffer.readUIntLE(355, 6) / 100;
      obj["high52"] = buffer.readUIntLE(363, 6) / 100;
      obj["low52"] = buffer.readUIntLE(371, 6) / 100;

      //best5data

      const packetno = 10;
      const packetsize = 20;

      const best5data = buffer.slice(147, 347);
      for (let i = 0; i < packetno; i++) {
        const packet = best5data.slice(
          packetsize * i,
          packetsize * i + packetsize
        );
        const name = `b5${i > 4 ? "s" : "b"}${i > 4 ? i - 4 : i + 1}`;
        const data5 = {
          q: packet.readUIntLE(2, 6),
          p: packet.readUIntLE(10, 6) / 100,
          o: packet.readUInt16LE(18),
        };
        obj[name] = data5;
      }
    }
    return obj;
  }
}

function subUnsubTokens(action, mode, symbolArray = []) {
  if (symbolArray.length == 0) {
    console.log("sub array empty");
    return null;
  }
  let wsConnectionData = {};
  wsConnectionData["correlationID"] = "suyotechdotcom";
  wsConnectionData["action"] = action; // 1 for subsribe 0 for unsubscribe

  let tokenlist = {
    NSE: [],
    NFO: [],
    MCX: [],
    CDS: [],
    BSE: [],
    BFO: [],
    NCDEX: [],
  };

  symbolArray.forEach((inst) => {
    switch (inst.exch_seg) {
      case "NSE":
        tokenlist.NSE.push(inst.token);
        break;
      case "NFO":
        tokenlist.NFO.push(inst.token);
        break;
      case "MCX":
        tokenlist.MCX.push(inst.token);
        break;
      case "CDS":
        tokenlist.CDS.push(inst.token);
        break;
      case "BSE":
        tokenlist.BSE.push(inst.token);
        break;
      case "BFO":
        tokenlist.BFO.push(inst.token);
        break;
      case "NCDEX":
        tokenlist.NCDEX.push(inst.token);
        break;
      default:
        break;
    }
  });

  wsConnectionData["params"] = {
    mode,
    tokenList: [
      {
        exchangeType: wsExchangeType.NSE,
        tokens: tokenlist.NSE,
      },
      {
        exchangeType: wsExchangeType.NFO,
        tokens: tokenlist.NFO,
      },
      {
        exchangeType: wsExchangeType.BSE,
        tokens: tokenlist.BSE,
      },
      {
        exchangeType: wsExchangeType.BFO,
        tokens: tokenlist.BFO,
      },
      {
        exchangeType: wsExchangeType.MCX,
        tokens: tokenlist.MCX,
      },
      {
        exchangeType: wsExchangeType.CDS,
        tokens: tokenlist.CDS,
      },
      {
        exchangeType: wsExchangeType.NCDEX,
        tokens: tokenlist.NCDEX,
      },
    ],
  };

  return wsConnectionData;
}
