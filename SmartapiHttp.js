import axios from "axios";
import os from "os";
import totp from "totp-generator";

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

    if (data) {
      this.jwtToken = data.jwtToken;
      this.requestToken = data.refreshToken;
      this.feedToken = data.feedToken;
      this.httpClient.defaults.headers.Authorization = `Bearer ${this.jwtToken}`;
    }
  }

  async getUserProfile() {
    await this.InitDone();
    return await this.httpClient.get(routes.profileUrl);
  }

  /**
   * Place Order Buy Sell
   * @method
   * @async
   * @param Object params required for fetching candle data
   * @param String params.variety Normal Order (Regular),Stop loss order,After Market Order,ROBO (Bracket Order)
   * @param params.tradingsymbol  Tradingsymbol of instrument
   * @param params.symboltoken Token of instrument
   * @param params.exchange Exchange of instrument
   * @param params.transactiontype BUY or SELL
   * @param params.ordertype Order type (MARKET, LIMIT etc.)
   * @param params.quantity Quantity in Integer.
   * @param params.producttype Product type (CNC,MIS, NORMAL)
   * @param params.price The min or max price to execute the order at (for LIMIT orders)
   * @param params.triggerprice The price at which an order should be triggered (SL, SL-M)
   * @param params.squareoff Target Points Only For ROBO (Bracket Order)
   * @param params.stoploss Stoploss Points Only For ROBO (Bracket Order)
   * @param params.trailingStopLoss TSL Points  Only For ROBO (Bracket Order)
   * @param params.disclosedquantity Quantity to disclose publicly (for equity trades)
   * @param params.duration Order duration (DAY,IOC)
   * @param params.ordertag It is optional to apply to an order to identify.
   * @returns
   */
  async placeOrder(params) {
    return await this.httpClient.post(routes.placeOrderUrl, params);
  }

  /**
   * Modify Order as long as it is open.
   * @method
   * @param  params params required for fetching candle data
   * @param params.variety Normal Order (Regular),Stop loss order,After Market Order,ROBO (Bracket Order)
   * @param params.tradingsymbol  Tradingsymbol of instrument
   * @param params.symboltoken Token of instrument
   * @param params.exchange Exchange of instrument
   * @param params.orderid OrderID of Open Order Present in Orderbook
   * @param params.producttype Product type (CNC,MIS, NORMAL)
   * @param params.duration Order duration (DAY,IOC)
   * @param params.price The min or max price to execute the order at (for LIMIT orders)
   * @param params.quantity Quantity in Integer.
   * @returns
   */
  async modifyOrder(params) {
    return await this.httpClient.post(routes.modifyOrderUrl, params);
  }

  /**
   * Cancel Open Order in OrderBook
   * @method
   * @param params
   * @param params.variety Normal Order (Regular),Stop loss order,After Market Order,ROBO (Bracket Order)
   * @param params.orderid OrderID of Open Order Present in Orderbook
   * @returns
   */
  async cancelOrder(params) {
    return await this.httpClient.post(routes.cancelOrderUrl, params);
  }

  /**
   * @method
   * @async
   * @returns {Array} of ordebook
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
   * @param params params required for fetching candle data
   * @param params.exchange  Exchange of instrument
   * @param params.symboltoken Token of instrument
   * @param params.interval Timeframe of CandleData use timeframe constant Etc..
   * @param params.fromdate From Date like 2023-11-16 09:15
   * @param params.todate To Date like 2023-11-16 09:16
   * @returns Array of [[datetime,o,h,l,c,v]....]
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
    return data;
  }

  //Constants

  exchange = {
    BSE: "BSE",
    NSE: "NSE",
    NFO: "NFO",
    MCX: "MCX",
    CDS: "CDS",
  };

  orderDuration = {
    DAY: "DAY",
    IOC: "IOC",
  };

  producttype = {
    DELIVERY: "DELIVERY",
    CARRYFORWARD: "CARRYFORWARD",
    MARGIN: "MARGIN",
    INTRADAY: "INTRADAY",
    BO: "BO",
  };

  ordertype = {
    MARKET: "MARKET",
    LIMIT: "LIMIT",
    STOPLOSS_LIMIT: "STOPLOSS_LIMIT",
    STOPLOSS_MARKET: "STOPLOSS_MARKET",
  };

  transactiontype = {
    BUY: "BUY",
    SELL: "SELL",
    SHORT: "SELL",
    COVER: "BUY",
  };

  variety = {
    NORMAL: "NORMAL",
    STOPLOSS: "STOPLOSS",
    AMO: "AMO",
    ROBO: "ROBO",
  };

  timeframe = {
    ONE_MINUTE: "ONE_MINUTE",
    THREE_MINUTE: "THREE_MINUTE",
    FIVE_MINUTE: "FIVE_MINUTE",
    TEN_MINUTE: "TEN_MINUTE",
    FIFTEEN_MINUTE: "FIFTEEN_MINUTE",
    THIRTY_MINUTE: "THIRTY_MINUTE",
    ONE_HOUR: "ONE_HOUR",
    ONE_DAY: "ONE_DAY",
  };
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
