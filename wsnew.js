import { WebSocket } from "ws";

class NWS {
  constructor(api) {
    this.api = api;
    this.wsURL = "wss://smartapisocket.angelone.in/smart-stream";
    this.ws = null;
    this.store = new Map();
    this.heartbeat_period = 30000;
    this.heartbeat_interval = null;
    this.debugSocket = true;
    this.reconnectInterval = 2000;
    this.reconnectMaxAttempts = 100;
    this.reconnectAttempts = 0;
    this.connecting = false;
    this.reconnect = true;

    this.connect();
  }

  enableDebugSocket(value) {
    this.debugSocket = value;
  }

  connect() {
    this.connecting = true;
    this.ws = new WebSocket("wss://smartapisocket.angelone.in/smart-stream", {
      headers: {
        Authorization: this.api.jwtToken,
        "x-api-key": this.api.apiKey,
        "x-client-code": this.api.clientID,
        "x-feed-token": this.api.feedToken,
      },
    });

    this.ws.onopen = () => {
      if (this.debugSocket) console.log("socket connected");
      this.setHeartBeat();
    };

    this.ws.onclose = () => {
      if (this.debugSocket) console.log("socket closed");
      this.cleanupHeartBeat();
    };

    this.ws.onerror = (error) => {
      if (this.debugSocket) console.log("error connected", error);
    };

    this.ws.message = (e) => {
      if (this.debugSocket) console.log("recieved data", e.data);
    };
    this.connecting = false;
  }

  setHeartBeat() {
    this.heartbeat_interval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send("ping", (err) => {
          if (err) console.log(err);
        });
      } else {
      }
    }, this.heartbeat_period);
  }

  cleanupHeartBeat() {
    clearInterval(this.heartbeat_interval);
    this.heartbeat_interval = null;
  }

  reconnect(){
    if(!this.connecting){
      this.reconnect()
    }
    this.connecting = true
    this.reconnectAttempts =+ 1;
    
  }

  this
}

export default NWS;
