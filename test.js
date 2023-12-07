import SmartApi from './SmartapiHttp.js';
import SmartapiInstruments from './SmartapiInstruments.js';
import WebSocket20 from './SmartapiWS.js';


async function main(){
    // const BrokerID  = "S358921"; 
    // const MPIN = "1988";
    // const API_KEY = "hF2gtdyV ";
    // const TOTP_KEY = "Z5AXZS7LCURLDMO72UKIA22TUQ";

    const BrokerID  = "V54035522"; 
    const MPIN = "1627";
    const API_KEY = "hVLhXyOK ";
    const TOTP_KEY = "HPI3KDLTNGJC2HUO2HBC4V5TEM";
    
    await SmartapiInstruments.CheckInstruments();

    const api = new SmartApi(BrokerID,MPIN,API_KEY,TOTP_KEY);
    
    api.setDebut(false);
    
    await api.generateSession()
    
    console.log("apidata",api.macAddress);
    const profile = await api.getUserProfile();
    console.log("profile ",profile);
   
    const inst = await SmartapiInstruments.FindInstrument({
        exch_seg : 'NSE',
        symbol : 'SBIN-EQ',
        instrumenttype : ''
    })


    // console.log('inst',inst);

    const marketdata  = await api.getMarketData('LTP',inst)
    console.log('marketdata',marketdata);

//     const candleData = await api.getCandleData({
//         "exchange": "NSE",
//         "symboltoken": "3045",
//         "interval": "ONE_MINUTE",
//         "fromdate": "2021-02-10 09:15",
//         "todate": "2021-02-10 09:16"
//    });
//     console.log('candle data',candleData)

    



    // const orderid = await api.placeOrder({
    //     "variety":api.variety.NORMAL,
    //     "tradingsymbol":"SBIN-EQ",
    //     "symboltoken":"3045",
    //     "transactiontype":"BUY",
    //     "exchange":"NSE",
    //     "ordertype":api.ordertype.LIMIT,
    //     "producttype":api.producttype.INTRADAY,
    //     "duration":"DAY",
    //     "price":560.0,
    //     "squareoff":"0",
    //     "stoploss":"0",
    //     "quantity":"1"
    //     })

    //     console.log("placed order id ",orderid);


    // const orderid = await api.modifyOrder({
    //     variety : "NORMAL",
    //     tradingsymbol : "SBIN-EQ",
    //     symboltoken : '3045',
    //     ordertype : api.ordertype.LIMIT,
    //     exchange : "NSE",
    //     orderid : "231117000407034",
    //     producttype: 'INTRADAY',
    //     duration: 'DAY',
    //     price: "561.0",
    //     quantity: "1",

    // })

    // const orderid = await api.cancelOrder({
    //     variety : 'NORMAL',
    //     orderid : 231117000407034
    // })

    // console.log('modify order ',orderid);

    
    // const orderBook  =await api.getOrderBook();
    // console.log('orderbook',orderBook);

    // const socket = new WebSocket20(api.apiKey,api.jwtToken,api.feedToken,api.clientID);

    

    // console.log('sending data ');

    // socket.subscribe(inst)

}

main();


