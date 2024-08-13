import SmartApi from "./SmartapiHttp";

class SmartapiWS21 {
  /**
   * @param {SmartApi} api
   */
  constructor(api) {
    this.api = api;
    this.reconnect_interval = 1000;
    this.heartbeat_interval = 30000;
  }

  #ws = null;
  #subscribed_instruments = [];

  subscribe() {}

  unsubscribe() {}


  setupHeartBeat(){
    
  }
}
