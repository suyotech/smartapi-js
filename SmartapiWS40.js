import WebSocket from 'ws'
import SmartApi from './SmartapiHttp.js'

class SmartapiWS40 {
  /**
   * @type {WebSocket}
   */
  #ws = null

  /**
   * @type {SmartApi}
   */
  #api = null
  /**
   * @param {SmartApi} api
   */

  #name = ''

  #heartbeat_duration = 30000
  #heartbeat_interval = null
  #reconnect_delay = 1000
  #reconnect_count = 0
  #reconnect_max_attempts = 100
  #disconnect = false
  #subscribed_tokens = []
  #onData = null

  constructor (name, api) {
    this.#api = api
    this.#name = name
  }

  async connect () {
    if (
      !this.#api.jwtToken ||
      !this.#api.apiKey ||
      !this.#api.clientID ||
      !this.#api.feedToken
    ) {
      throw new Error('api params undefined')
    }
    console.log('connecting', this.#name)

    this.#ws = new WebSocket('wss://smartapisocket.angelone.in/smart-stream', {
      headers: {
        Authorization: this.#api.jwtToken,
        'x-api-key': this.#api.apiKey,
        'x-client-code': this.#api.clientID,
        'x-feed-token': this.#api.feedToken
      }
    })

    this.#ws.on('open', () => {
      console.log('socket connected', this.#name)
      this.#setHeartBeat()
      this.#reconnect_count = 0
      this.#reconnect_delay = 1000
      this.#subtokens(this.#subscribed_tokens)
    })

    this.#ws.on('close', (code, reason) => {
      console.log('socket closed', this.#name, code, reason.toString())
      this.#cleanHeatBeat()
      if (!this.#disconnect) {
        this.#reconnect()
      }
    })

    this.#ws.on('error', err => {
      console.log('socket error', this.#name, err.message)
    })

    this.#ws.on('unexpected-response', (req, resp) => {
      console.log('unexpected resp', resp.headers)
    })

    this.#ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        console.log("message recieved", this.#name, data.toString(), isBinary);
      } else {
        if (this.#onData) {
          this.#onData(this.#parseWSData(data))
        }
      }
    })
  }

  disconnect () {
    this.#disconnect = true
    if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
      console.log('closing socket', this.#name)
      this.#ws.close()
    } else {
      console.log('connection already closed', this.#name)
    }
  }

  #setHeartBeat () {
    this.#heartbeat_interval = setInterval(() => {
      if (this.#ws.OPEN === WebSocket.OPEN) {
        this.#ws.send('ping')
      }
    }, this.#heartbeat_duration)
  }

  #cleanHeatBeat () {
    clearInterval(this.#heartbeat_interval)
    this.#heartbeat_interval = null
  }

  #reconnect () {
    this.#reconnect_count++
    this.#reconnect_delay += 5000
    if (this.#reconnect_count < this.#reconnect_max_attempts)
      setTimeout(() => {
        console.log(
          'reconnecting',
          this.#name,
          'count',
          this.#reconnect_count,
          'with delay',
          this.#reconnect_delay
        )
        this.connect()
      }, this.#reconnect_delay)
  }

  /**
   *   * @param {Array} instruments
   */
  subscribe (instruments) {
    if (!Array.isArray(instruments) || !instruments.length > 0) {
      console.log('invalid intruments')
      return
    }

    this.#subscribed_tokens.push(...instruments)
    this.#subtokens(instruments)
  }

  /**
   *
   * @param {Function} cb //cal
   * function(data){
   *  console.log(data)
   * }
   */
  onData (cb) {
    if (typeof cb !== 'function') {
      throw console.error('invalid callback ')
    }

    this.#onData = cb
  }
  #subtokens(instruments = []) {
    if (
      this.#ws &&
      this.#ws.readyState === WebSocket.OPEN &&
      instruments.length > 0
    ) {
      console.log('sending tokens', this.#name, instruments.length)
      const tokens = this.#convertTokens('subscribe', 'SnapQuote', instruments)
      this.#ws.send(JSON.stringify(tokens))
    }
  }

  /**
   *
   * @param {"subscribe"|"unsubscribe"} action
   * @param {"LTP"|"Quote"|"SnapQuote"} mode
   * @param {Array} symbolArray
   * @returns {Object}
   */
  #convertTokens (action, mode, symbolArray = []) {
    const wsExchangeType = {
      NSE: 1,
      NFO: 2,
      BSE: 3,
      BFO: 4,
      MCX: 5,
      NCDEX: 7,
      CDS: 13
    }

    const wsModes = {
      LTP: 1,
      Quote: 2,
      SnapQuote: 3
    }

    const actionType = {
      subscribe: 1,
      unsubscribe: 0
    }

    if (symbolArray.length == 0) {
      console.log('sub array empty')
      return null
    }

    let wsConnectionData = {}
    let r = (Math.random() + 1).toString(36).substring(7)
    wsConnectionData['correlationID'] = r //"suyotechdotcom";
    wsConnectionData['action'] = actionType[action] // 1 for subsribe 0 for unsubscribe

    let tokenlist = {
      NSE: [],
      NFO: [],
      MCX: [],
      CDS: [],
      BSE: [],
      BFO: [],
      NCDEX: []
    }

    symbolArray.forEach(inst => {
      switch (inst.exch_seg) {
        case 'NSE':
          tokenlist.NSE.push(inst.token)
          break
        case 'NFO':
          tokenlist.NFO.push(inst.token)
          break
        case 'MCX':
          tokenlist.MCX.push(inst.token)
          break
        case 'CDS':
          tokenlist.CDS.push(inst.token)
          break
        case 'BSE':
          tokenlist.BSE.push(inst.token)
          break
        case 'BFO':
          tokenlist.BFO.push(inst.token)
          break
        case 'NCDEX':
          tokenlist.NCDEX.push(inst.token)
          break
        default:
          break
      }
    })

    wsConnectionData['params'] = {
      mode: wsModes[mode],
      tokenList: [
        {
          exchangeType: wsExchangeType.NSE,
          tokens: tokenlist.NSE
        },
        {
          exchangeType: wsExchangeType.NFO,
          tokens: tokenlist.NFO
        },
        {
          exchangeType: wsExchangeType.BSE,
          tokens: tokenlist.BSE
        },
        {
          exchangeType: wsExchangeType.BFO,
          tokens: tokenlist.BFO
        },
        {
          exchangeType: wsExchangeType.MCX,
          tokens: tokenlist.MCX
        },
        {
          exchangeType: wsExchangeType.CDS,
          tokens: tokenlist.CDS
        },
        {
          exchangeType: wsExchangeType.NCDEX,
          tokens: tokenlist.NCDEX
        }
      ]
    }

    return wsConnectionData
  }

  #parseWSData (data) {
    if (typeof data === 'string') {
      return data
    } else if (typeof data === 'object') {
      const buffer = Buffer.from(data)
      const obj = {}

      obj['submode'] = buffer.readInt8(0)
      obj['localtimestamp'] = Date.now()
      obj['exchange'] = buffer.readInt8(1)
      const tokenIdBuffer = buffer.slice(2, 2 + 25)
      obj['token'] = tokenIdBuffer.toString('utf-8').replace(/\0/g, '')
      obj['sequence_no'] = buffer.readIntLE(27, 6)
      obj['exchangetimestamp'] = buffer.readUIntLE(35, 6)
      obj['ltp'] = buffer.readUIntLE(43, 6) / 100

      if (obj.submode === 2 || obj.submode === 3) {
        obj['ltqty'] = buffer.readUIntLE(51, 6)
        obj['avgprice'] = buffer.readUIntLE(59, 6) / 100
        obj['volume'] = buffer.readUIntLE(67, 6)
        obj['tbquty'] = buffer.readDoubleLE(75, 6)
        obj['tsquty'] = buffer.readDoubleLE(83, 6)
        obj['dopen'] = buffer.readUIntLE(91, 6) / 100
        obj['dhigh'] = buffer.readUIntLE(99, 6) / 100
        obj['dlow'] = buffer.readUIntLE(107, 6) / 100
        obj['prclose'] = buffer.readUIntLE(115, 6) / 100
      }

      if (obj.submode === 3) {
        obj['lttimestamp'] = buffer.readUIntLE(123, 6)
        obj['oi'] = buffer.readUIntLE(131, 6)
        obj['uc'] = buffer.readUIntLE(347, 6) / 100
        obj['lc'] = buffer.readUIntLE(355, 6) / 100
        obj['high52'] = buffer.readUIntLE(363, 6) / 100
        obj['low52'] = buffer.readUIntLE(371, 6) / 100

        //best5data

        const packetno = 10
        const packetsize = 20

        const best5data = buffer.slice(147, 347)
        for (let i = 0; i < packetno; i++) {
          const packet = best5data.slice(
            packetsize * i,
            packetsize * i + packetsize
          )
          const name = `b5${i > 4 ? 's' : 'b'}${i > 4 ? i - 4 : i + 1}`
          const data5 = {
            q: packet.readUIntLE(2, 6),
            p: packet.readUIntLE(10, 6) / 100,
            o: packet.readUInt16LE(18)
          }
          obj[name] = data5
        }
      }
      return obj
    }
  }
}

export default SmartapiWS40
