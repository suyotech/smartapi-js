import { WebSocket } from "ws";
import SmartApi from "./SmartapiHttp.js";
import { v4 as uuidv4 } from "uuid";

class SmartapiWS30 {
  /**
   *
   * @param {SmartApi} api
   */
  constructor(api) {
    this.#api = api;
  }

  /**
   * @type {SmartApi}
   */
  #api;
  /**
   * @type {WebSocket}
   */
  #socket = null;
  /**
   *
   */

  #heartBeatDelay = 30 * 1000;
  #heartBeatSetInterval = null;
  #reconnectDelay = 3000;
  #reconnectCount = 0;
  #reconnecting = false;
  #maxReconnectAttempts = 20;
  #subscriptions = new Map();

  connect() {
    try {
      if (!this.#api.jwtToken || !this.#api.apiKey || !this.#api.clientID || !this.#api.feedToken) {
        throw new Error("api params undefined");
      }

      this.#socket = new WebSocket("wss://smartapisocket.angelone.in/smart-stream", {
        headers: {
          Authorization: this.#api.jwtToken,
          "x-api-key": this.#api.apiKey,
          "x-client-code": this.#api.clientID,
          "x-feed-token": this.#api.feedToken,
        },
      });

      this.#socket.on("open", () => {
        console.log("socket connected");

        //subscribing already set subscriptions
        const subs = Array.from(this.#subscriptions);
        if (subs.length > 0) {
          const insts = subs.map(([token, obj]) => obj?.instrument);
          console.log("instrumetns", insts);
          const tokens = this.#subUnsubTokens(1, this.#wsModes.SnapQuote, insts);
          this.#send(tokens);
        }

        //setting heart beat interval
        this.#setHeartBeat();
      });

      this.#socket.on("error", (error) => {
        console.log("error socket", error);
        this.#reconnect();
      });

      this.#socket.onmessage = (event) => {
        const data = this.#parseWSData(event.data);
        if (typeof data === "object") {
          const key = data.token;
          const subs = this.#subscriptions.get(data.token);
          subs.callbacks.forEach((obj) => {
            obj.callback({ ...subs.instrument, ...data });
          });
        } else {
          // console.log("message reviced", data);
        }
      };

      this.#socket.on("close", () => {
        console.log("socket closed");
        this.#heartBeatCleanup();
      });
    } catch (error) {
      throw error;
    }
  }

  disconnect() {
    console.log("closing socket");
    if (this.#socket.readyState === WebSocket.OPEN) {
      this.#socket.close();
    } else {
      console.log("socket is not open");
    }
  }

  #reconnect() {
    if (!this.#reconnecting && this.#reconnectCount < this.#maxReconnectAttempts) {
      this.#reconnectCount++;
      this.#reconnecting = true;
      this.#reconnectCount;
      this.connect();
    } else if (this.#reconnectCount >= this.#maxReconnectAttempts) {
      console.log("max attemps 20 stopping reconnecting");
    } else {
      setTimeout(() => {
        this.#reconnect();
      }, this.#reconnectDelay);
    }
  }

  #setHeartBeat() {
    this.#heartBeatSetInterval = setInterval(() => {
      if (this.#socket.readyState === WebSocket.OPEN) {
        this.#socket.send("ping");
        console.log("ping message sent");
      }
    }, this.#heartBeatDelay);
  }

  #heartBeatCleanup() {
    clearInterval(this.#heartBeatSetInterval);
    this.#heartBeatSetInterval = null;
  }

  #parseWSData(data) {
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
          const packet = best5data.slice(packetsize * i, packetsize * i + packetsize);
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

  #send(message) {
    const maxAttempts = 10;
    let attempts = 0;

    const trySending = () => {
      if (this.#socket.readyState === WebSocket.OPEN) {
        console.log("sending message");
        this.#socket.send(JSON.stringify(message));
      } else if (attempts < maxAttempts && this.#socket.readyState === WebSocket.OPEN) {
        attempts++;
        setTimeout(trySending, 500);
      } else {
        console.error("Unable to send message after 10 attempts. or Socket Closed");
      }
    };

    trySending();
  }

  #wsExchangeType = {
    NSE: 1,
    NFO: 2,
    BSE: 3,
    BFO: 4,
    MCX: 5,
    NCDEX: 7,
    CDS: 13,
  };

  #wsModes = {
    LTP: 1,
    Quote: 2,
    SnapQuote: 3,
  };

  #subUnsubTokens(action, mode, symbolArray = []) {
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
          exchangeType: this.#wsExchangeType.NSE,
          tokens: tokenlist.NSE,
        },
        {
          exchangeType: this.#wsExchangeType.NFO,
          tokens: tokenlist.NFO,
        },
        {
          exchangeType: this.#wsExchangeType.BSE,
          tokens: tokenlist.BSE,
        },
        {
          exchangeType: this.#wsExchangeType.BFO,
          tokens: tokenlist.BFO,
        },
        {
          exchangeType: this.#wsExchangeType.MCX,
          tokens: tokenlist.MCX,
        },
        {
          exchangeType: this.#wsExchangeType.CDS,
          tokens: tokenlist.CDS,
        },
        {
          exchangeType: this.#wsExchangeType.NCDEX,
          tokens: tokenlist.NCDEX,
        },
      ],
    };

    return wsConnectionData;
  }

  /**
   *
   * @param {SmartApiInstrument} instrument SmartApiInstrument
   * @param {Function} callback CallbackFunction
   */
  subscribe(instrument, callback) {
    try {
      if (!instrument.token || !instrument?.exch_seg) {
        console.log("no insrument for subscription");
        return;
      }

      const cbid = uuidv4();

      if (!this.#subscriptions.has(instrument.token)) {
        this.#subscriptions.set(instrument.token, {
          instrument,
          callbacks: [{ cbid, callback }],
        });
      } else {
        let sub = this.#subscriptions.get(instrument.token);
        sub?.callbacks.push({ cbid, callback });
        console.log("token already present", sub);
      }

      const tokens = this.#subUnsubTokens(1, this.#wsModes.SnapQuote, [instrument]);
      this.#send(tokens);

      const unsub = function () {
        if (this.#subscriptions.has(instrument.token)) {
          let sub = this.#subscriptions.get(instrument.token);
          sub.callbacks = sub.callbacks.filter((cb) => cb.cbid !== cbid);
          if (sub.callbacks.length === 0) {
            this.#subUnsubTokens(0, this.#wsModes.SnapQuote, [instrument]);
          }
        } else {
          console.log("token not found");
        }
      }.bind(this);
      return {
        unsub: unsub,
      };
    } catch (error) {
      console.log("error", error);
    }
  }

  view() {
    console.log("subs", this.#subscriptions);
  }

  unsuball() {
    this.#subscriptions.forEach((s) => {
      let sub = this.#subscriptions.get(s.instrument.token);
      sub.callbacks = [];
      if (sub.callbacks.length === 0) {
        this.#subUnsubTokens(0, this.#wsModes.SnapQuote, [s.instrument]);
      }
    });
  }
}

export default SmartapiWS30;
