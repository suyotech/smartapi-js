import { v4 as uuidv4 } from "uuid";
import cron from "node-cron";
import SmartApi from "./SmartapiHttp.js";

SmartApi;

class HistoricalDataProvider {
  /**
   * @param {SmartApi} api
   */
  constructor(api) {
    this.#api = api;
    this.#processhistque();
  }

  /**
   * @type {SmartApi} api
   * @private
   */
  #api;

  #histque = [];
  #histSubscriptions = new Map();
  #interval = {
    "1m": { string: "ONE_MINUTE", number: 1, prdays: 30 },
    "3m": { string: "THREE_MINUTE", number: 3, prdays: 60 },
    "5m": { string: "FIVE_MINUTE", number: 5, prdays: 100 },
    "10m": { string: "TEN_MINUTE", number: 10, prdays: 100 },
    "15m": { string: "FIFTEEN_MINUTE", number: 15, prdays: 200 },
    "30m": { string: "THIRTY_MINUTE", number: 30, prdays: 200 },
    "60m": { string: "ONE_HOUR", number: 60, prdays: 400 },
    "1d": { string: "ONE_DAY", number: 1440, prdays: 2000 }, // Assuming 1 day has 1440 minutes
  };

  #getFormattedDateTime(daysAgo) {
    const currentDate = new Date();

    if (daysAgo !== null && typeof daysAgo === "number") {
      const pastDate = new Date(currentDate);
      pastDate.setDate(currentDate.getDate() - daysAgo);
      return `${pastDate.toISOString().split("T")[0]} ${pastDate.getHours()}:${String(pastDate.getMinutes()).padStart(
        2,
        "0"
      )}`;
    } else {
      return `${currentDate.toISOString().split("T")[0]} ${currentDate.getHours()}:${String(
        currentDate.getMinutes()
      ).padStart(2, "0")}`;
    }
  }

  async #sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  async #processhistque() {
    const start = performance.now();
    const data = this.#histque.shift();
    if (data) {
      try {
        const params = {
          exchange: data.instrument.exch_seg,
          symboltoken: data.instrument.token,
          interval: this.#interval[data.interval].string,
          fromdate: this.#getFormattedDateTime(this.#interval[data.interval].prdays),
          todate: this.#getFormattedDateTime(),
        };

        const cd = await this.#api.getCandleData(params);
        if (cd) {
          if (data.callbacks.length > 0) {
            data.callbacks.forEach((c) => c.callback(cd));
          } else {
            console.log("no callbacks ", data.instrument.token);
          }
        }
      } catch (error) {
        console.log("error fetching candle data", error.message);
      }
    }
    const stop = performance.now();
    const diff = stop - start;
    const delay = diff > 350 ? 0 : 350 - diff;
    await this.#sleep(delay);
    this.#processhistque();
  }

  /**
   *
   * @param {Object} instrument
   * @param {"1m"|"3m"|"5m"|"10m"|"15m"|"30m","1h"|"1d"} interval Interval of data of candle available
   * @param {Function} callback
   * @returns
   */
  async subHistData(instrument, interval, callback) {
    try {
      if (
        typeof instrument != "object" ||
        Array.isArray(instrument) ||
        typeof interval != "string" ||
        typeof callback != "function"
      ) {
        throw new Error("invalid argument types");
      }
      const callbackid = uuidv4();
      const histkey = `${instrument.token}-${interval}`;
      if (!this.#histSubscriptions.has(histkey)) {
        const cronstring = `*/${this.#interval[interval].number} * * * *`;
        console.log("cron string", cronstring);
        const cronjob = cron.schedule(cronstring, () => {
          const d = { instrument, interval, callbacks: this.#histSubscriptions.get(histkey).callbacks };
          this.#histque.push(d);
        });
        this.#histSubscriptions.set(histkey, {
          instrument: instrument,
          cronjob: cronjob,
          callbacks: [{ callbackid, callback }],
        });
      } else {
        const sub = this.#histSubscriptions.get(histkey);
        sub.callbacks.push({ callbackid, callback });
      }

      const unsub = () => {
        const histsub = this.#histSubscriptions.get(histkey);
        console.log("unsub before", histkey, histsub.callbacks.length);
        histsub.callbacks = histsub.callbacks.filter((c) => c.callbackid !== callbackid);
        console.log("unsub after", histkey, histsub.callbacks.length);
        if (histsub.callbacks.length === 0) {
          histsub.cronjob.stop();
          console.log("stoping", histkey);
        }
      };
      return { unsub: unsub };
    } catch (error) {
      throw error;
    }
  }
}

export default HistoricalDataProvider;
