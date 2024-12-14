import axios from "axios";
import os from "os";
import totp from "totp-generator";

//Constants

class SmartApi {
  constructor(clientID, mpin, apiKey, totpKey) {
    this.clientID = clientID;
    this.mpin = mpin;
    this.apiKey = apiKey;
    this.timeout = 7000;
    this.totpKey = totpKey;
    this.publicIP = null;
    this.macAddress = null;
    this.localIP = null;
    this.jwtToken = "";
    this.requestToken = "";
    this.feedToken = "";
    this.httpClient = null;
    this.debug = false;
    this.InitPromise = this.init();
  }

  /**
   * @enum {String}
   */
  Exchange = {
    BSE: "BSE",
    NSE: "NSE",
    NFO: "NFO",
    MCX: "MCX",
    CDS: "CDS",
  };

  /**
   * @enum {String}
   */
  OrderDuration = {
    DAY: "DAY",
    IOC: "IOC",
  };

  /**
   * @enum {String}
   */
  // @ts-ignore
  ProductType = {
    DELIVERY: "DELIVERY",
    CARRYFORWARD: "CARRYFORWARD",
    MARGIN: "MARGIN",
    INTRADAY: "INTRADAY",
    BO: "BO",
  };

  /**
   * @enum {String}
   */
  OrderType = {
    MARKET: "MARKET",
    LIMIT: "LIMIT",
    STOPLOSS_LIMIT: "STOPLOSS_LIMIT",
    STOPLOSS_MARKET: "STOPLOSS_MARKET",
  };

  /**
   * @enum {String}
   */
  TransactionType = {
    BUY: "BUY",
    SELL: "SELL",
    SHORT: "SELL",
    COVER: "BUY",
  };

  /**
   * @enum {String}
   */
  Variety = {
    NORMAL: "NORMAL",
    STOPLOSS: "STOPLOSS",
    AMO: "AMO",
    ROBO: "ROBO",
  };

  /**
   * @enum {String}
   */
  Timeframe = {
    ONE_MINUTE: "ONE_MINUTE",
    THREE_MINUTE: "THREE_MINUTE",
    FIVE_MINUTE: "FIVE_MINUTE",
    TEN_MINUTE: "TEN_MINUTE",
    FIFTEEN_MINUTE: "FIFTEEN_MINUTE",
    THIRTY_MINUTE: "THIRTY_MINUTE",
    ONE_HOUR: "ONE_HOUR",
    ONE_DAY: "ONE_DAY",
  };

  async init() {
    try {
      this.localIP = getLocalIP();
      this.macAddress = getMAC();

      const publicIP = await getPublicIP();
      this.publicIP = publicIP;

      this.httpClient = axios.create({
        baseURL: routes.burl,
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-User-Type": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": this.localIP,
          "X-ClientPublicIP": this.publicIP,
          "X-MACAddress": this.macAddress,
          "X-PrivateKey": this.apiKey,
          Authorization: `Bearer ${this.jwtToken}`,
        },
      });

      this.httpClient.interceptors.response.use(
        (response) => {
          if (!response.data.status) {
            console.log("error", response.data.message);
            return null;
          }
          return response.data.data;
        },
        (error) => {
          if (error.resquest) {
            console.log("request error ", error);
          } else if (error.response) {
            console.log(
              "response error ",
              this.debug ? error : error.response.data
            );
          } else {
            console.log("error ", this.debug ? error : error.message);
          }
        }
      );

      this.httpClient.interceptors.request.use(
        (config) => {
          return config;
        },
        (error) => {
          console.log("request error ", error);
          return Promise.reject(error);
        }
      );
    } catch (error) {
      console.log("init error", error);
    }
  }

  async InitDone() {
    return this.InitPromise;
  }

  /**
   *
   * @param {true | false} debug
   */
  setDebug(debug = false) {
    this.debug = debug;
  }

  async generateSession() {
    await this.InitDone();
    const data = await this.httpClient.post(routes.loginUrl, {
      clientcode: this.clientID,
      password: this.mpin,
      totp: totp(this.totpKey),
    });

    // @ts-ignore
    const { jwtToken, refreshToken, feedToken } = data;
    if (data) {
      this.jwtToken = jwtToken;
      this.requestToken = refreshToken;
      this.feedToken = feedToken;
      this.httpClient.defaults.headers.Authorization = `Bearer ${this.jwtToken}`;
    }
  }

  async getUserProfile() {
    await this.InitDone();
    return await this.httpClient.get(routes.profileUrl);
  }

  /**
   *
   * @param {orderParams} params
   * @returns {Promise<{script : String,orderid : String,uniqueorderid : String} | undefined>}
   */
  async placeOrder(params) {
    return await this.httpClient.post(routes.placeOrderUrl, params);
  }

  /**
   *
   * @param {modifyOrderParams} params
   * @returns
   */
  async modifyOrder(params) {
    return await this.httpClient.post(routes.modifyOrderUrl, params);
  }

  /**
   * Cancel Open Order in OrderBook
   * @typedef {Object} cancelOrderParams
   * @property {Variety} variety Normal Order (Regular),Stop loss order,After Market Order,ROBO (Bracket Order)
   * @property {String} orderid OrderID of Open Order Present in Orderbook
   */

  /**
   * @method
   * @param {cancelOrderParams} params
   * @returns {Promise<any|undefined>}
   */
  async cancelOrder(params) {
    const data = await this.httpClient.post(routes.cancelOrderUrl, params);
    return data?.data;
  }

  /**
   * @method
   * @async
   * @returns {Promise<Array|undefined>} of ordebook
   */

  async getOrderBook() {
    const data = await this.httpClient.get(routes.orderBookUrl);
    return data;
  }

  async getTradeBook() {
    const data = await this.httpClient.get(routes.tradeBookUrl);
    return data;
  }

  async getPositionBook() {
    const data = await this.httpClient.get(routes.positionBookUrl);
    return data;
  }

  async getHoldingAll() {
    const data = await this.httpClient.get(routes.holdingAllBookUrl);
    return data;
  }

  /**
   *
   * @param {"LTP"} mode
   * @param {import("./SmartapiInstruments.js").Instrument[]} instrumentlist
   * @returns
   */
  async getMarketData(mode = "LTP", instrumentlist = []) {
    if (!Array.isArray(instrumentlist) || !mode) {
      console.log("instrument list null or mode is not defined");
      return null;
    }

    const params = ArrayInstToMarketDataParams(mode, instrumentlist);
    const data = await this.httpClient.post(routes.marketDataUrl, params);
    return data;
  }

  /**
   *
   * @param {candleDataParams} params
   * @returns {Promise<Candle[] | undefined>}
   */
  async getCandleData(params) {
    if (
      !params.exchange ||
      !params.symboltoken ||
      !params.interval ||
      !params.fromdate ||
      !params.todate
    ) {
      throw new Error("some params missing");
    }
    const data = await this.httpClient.post(routes.candleDataUrl, params);
    return data?.data;
  }
}
//utils functions

const routes = {
  burl: "https://apiconnect.angelone.in",
  loginUrl: "/rest/auth/angelbroking/user/v1/loginByPassword",
  profileUrl: "/rest/secure/angelbroking/user/v1/getProfile",
  placeOrderUrl: "/rest/secure/angelbroking/order/v1/placeOrder",
  modifyOrderUrl: "/rest/secure/angelbroking/order/v1/modifyOrder",
  cancelOrderUrl: "/rest/secure/angelbroking/order/v1/cancelOrder",
  orderBookUrl: "/rest/secure/angelbroking/order/v1/getOrderBook",
  positionBookUrl: "/rest/secure/angelbroking/order/v1/getPosition",
  holdingAllBookUrl: "/rest/secure/angelbroking/order/v1/getAllHolding",
  tradeBookUrl: "/rest/secure/angelbroking/order/v1/getTradeBook",
  marketDataUrl: "/rest/secure/angelbroking/market/v1/quote/",
  candleDataUrl: "/rest/secure/angelbroking/historical/v1/getCandleData",
};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let localIP = "";

  // Loop through network interfaces
  Object.keys(interfaces).forEach((interfaceName) => {
    const interfaceInfo = interfaces[interfaceName];
    // Find an IPv4 address that is not internal or loopback
    const activeInterface = interfaceInfo.find(
      (info) => !info.internal && info.family === "IPv4"
    );

    if (activeInterface) {
      localIP = activeInterface.address;
    }
  });

  return localIP;
}

// Function to get the MAC address
function getMAC() {
  const networkInterfaces = os.networkInterfaces();
  let macAddress = "";

  // Loop through network interfaces to find the MAC address
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaceInfo = networkInterfaces[interfaceName];

    const mac = interfaceInfo.find(
      (details) => details.mac && details.mac !== "00:00:00:00:00:00"
    );

    if (mac) {
      macAddress = mac.mac;
    }
  });

  return macAddress;
}

const getPublicIP = async () => {
  try {
    const response = await axios.get("https://ipv4.icanhazip.com/");
    const ipAddress = response.data.trim();
    return ipAddress;
  } catch (error) {
    console.error("Error fetching IP address:", error.message);
  }
};

/**
 *
 * @param {String} mode LTP,OHLC,FULL
 * @param {Array} instruments Array of Instruments
 * @returns MarketData Params
 */

const ArrayInstToMarketDataParams = (mode, instruments = []) => {
  if (instruments.length == 0) {
    console.log("no instruments found");
    return null;
  }

  let params = {
    mode,
    exchangeTokens: {
      NSE: [],
      NFO: [],
      MCX: [],
      CDS: [],
      BSE: [],
      BFO: [],
    },
  };
  instruments.forEach((inst) => {
    switch (inst.exch_seg) {
      case "NSE":
        params.exchangeTokens.NSE.push(inst.token);
        break;
      case "NFO":
        params.exchangeTokens.NFO.push(inst.token);
        break;
      case "MCX":
        params.exchangeTokens.MCX.push(inst.token);
        break;
      case "CDS":
        params.exchangeTokens.CDS.push(inst.token);
        break;
      case "BSE":
        params.exchangeTokens.BSE.push(inst.token);
        break;
      case "BFO":
        params.exchangeTokens.BFO.push(inst.token);
        break;
      default:
        break;
    }
  });

  //Cleaning empty exchange token keys
  Object.keys(params.exchangeTokens).forEach((key) => {
    if (params.exchangeTokens[key].length == 0) {
      delete params.exchangeTokens[key];
    }
  });

  return params;
};

export default SmartApi;

/**
 * @typedef {Object} orderParams
 * @property {string} tradingsymbol - Trading Symbol of the instrument.
 * @property {string} symboltoken - Symbol Token is a unique identifier.
 * @property {string} exchange - Name of the exchange.
 * @property {string} transactiontype - BUY or SELL.
 * @property {string} ordertype - Order type (e.g., MARKET, LIMIT).
 * @property {number} quantity - Quantity to transact.
 * @property {string} producttype - Product type (e.g., CNC, MIS).
 * @property {number} [price] - (Optional) The min or max price to execute the order at (for LIMIT orders).
 * @property {number} [triggerprice] - (Optional) The price at which an order should be triggered (for SL, SL-M).
 * @property {number} [squareoff] - (Optional) Only for ROBO (Bracket Order).
 * @property {number} [stoploss] - (Optional) Only for ROBO (Bracket Order).
 * @property {number} [trailingStopLoss] - (Optional) Only for ROBO (Bracket Order).
 * @property {number} [disclosedquantity] - (Optional) Quantity to disclose publicly (for equity trades).
 * @property {string} [duration] - (Optional) Order duration (e.g., DAY, IOC).
 * @property {string} [ordertag] - (Optional) Tag to identify the order (max 20 characters).
 */

/**
 * Modify Order as long as it is open.
 * @typedef {Object} modifyOrderParams params required for fetching candle data
 * @property {String} variety Normal Order (Regular),Stop loss order,After Market Order,ROBO (Bracket Order)
 * @property {String} tradingsymbol  Tradingsymbol of instrument
 * @property {String} symboltoken Token of instrument
 * @property {String} exchange Exchange of instrument
 * @property {String} orderid OrderID of Open Order Present in Orderbook
 * @property {String} producttype Product type (CNC,MIS, NORMAL)
 * @property {String} duration Order duration (DAY,IOC)
 * @property {String} price The min or max price to execute the order at (for LIMIT orders)
 * @property {String} quantity Quantity in Integer.
 */

/**
 * @typedef {Object} Candle
 * @property {String} time
 * @property {Number} open
 * @property {Number} high
 * @property {Number} low
 * @property {Number} close
 * @property {Number} volume
 */

/**
 * @typedef {Object} candleDataParams params required for fetching candle data
 * @property {String} exchange  Exchange of instrument
 * @property {String} symboltoken Token of instrument
 * @property {String} interval Timeframe of CandleData use timeframe constant Etc..
 * @property {String} fromdate From Date like 2023-11-16 09:15
 * @property {String} todate To Date like 2023-11-16 09:16
 */
