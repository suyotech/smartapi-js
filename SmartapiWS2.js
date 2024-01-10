import WebSocket from "ws";

class SmartapiWS2 {
  constructor(apikey, jwtToken, feedToken, clientCode) {
    this.apikey = apikey;
    this.jwtToken = jwtToken;
    this.feedToken = feedToken;
    this.clientCode = clientCode;
    this.socket = null;
    this.topics = new Map();
    this.heartbeatInterval = 30 * 1000;
    this.wsExchangeType = {
      NSE: 1,
      NFO: 2,
      BSE: 3,
      BFO: 4,
      MCX: 5,
      NCDEX: 7,
      CDS: 13,
    };
    this.wsModes = {
      LTP: 1,
      Quote: 2,
      SnapQuote: 3,
    };
  }

  connect() {
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

    this.socket.on("open", () => {
      this.#setupHeartBeat();
    });

    this.socket.onerror((error) => {
      console.log("Error", error.message);
    });

    this.socket.onclose((e) => {
      console.log("socket closed", e);
    });

    this.socket.onmessage((e) => {
      const data = JSON.parse(e.data);
      console.log("message : ", data);
    });
  }

  #setupHeartBeat() {
    this.heartBeatTimer = setInterval(() => {
      this.socket.send("ping");
      console.log("sent ping ");
    }, this.heartbeatInterval);
  }

  #waitToConnect() {
    setTimeout(() => {
      if (this.socket.readyState !== WebSocket.OPEN) {
        this.#waitToConnect();
      }
    }, 5);
  }

  /**
   *
   * @param {1|0} action - 1 = Subscribe | 0 = Unsubscribe
   * @param {} mode
   * @param {*} symbolArray
   * @returns
   */
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

  subscribe(instruments = []) {
    this.#waitToConnect();
    if (instruments.length === 0) {
      console.log("invalid instruments");
      return;
    }

    instruments.forEach((inst) => {
      if (!this.topics.has(inst.token)) {
        this.topics.set(inst.token);
      }
    });
  }
}
