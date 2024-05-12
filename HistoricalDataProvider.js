import EventEmitter from "events";
import cron from "node-cron";

class HistoricalDataProvider extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.stocklist = new Map();
    this.TimeIntervals = {
      1: "ONE_MINUTE",
      3: "THREE_MINUTE",
      5: "FIVE_MINUTE",
      10: "TEN_MINUTE",
      15: "FIFTEEN_MINUTE",
      30: "THIRTY_MINUTE",
      60: "ONE_HOUR",
      1440: "ONE_DAY",  
    };
  }

  #getEnumValue(number) {
    // Get enum value for numbers
    return this.TimeIntervals[number] || "Unknown";
  }

  #getFormattedDateTime(daysAgo) {
    const currentDate = new Date();

    if (daysAgo !== null && typeof daysAgo === "number") {
      const pastDate = new Date(currentDate);
      pastDate.setDate(currentDate.getDate() - daysAgo);
      return `${
        pastDate.toISOString().split("T")[0]
      } ${pastDate.getHours()}:${String(pastDate.getMinutes()).padStart(
        2,
        "0"
      )}`;
    } else {
      return `${
        currentDate.toISOString().split("T")[0]
      } ${currentDate.getHours()}:${String(currentDate.getMinutes()).padStart(
        2,
        "0"
      )}`;
    }
  }
  /**
   *
   * @param {Object} brokerApi BrokerApi
   * @param {Object} inst Instrument
   * @param {Number} interval Minutes
   * @param {Number} days
   */

  subHistoricalData(brokerApi, inst, interval = 1, prDays) {
    console.log("hist log ", inst);
    if (this.stocklist.has(inst.token)) {
      console.log("already subscribe", inst);
    } else {
      const cronHist = cron.schedule(`*/${interval} * * * * `, async () => {
        try {
          const fromdate = this.#getFormattedDateTime(prDays);
          const todate = this.#getFormattedDateTime();
          const intvl = this.#getEnumValue(interval);
          const params = {
            exchange: inst.exch_seg,
            symboltoken: inst.token,
            interval: intvl,
            fromdate,
            todate,
          };
          console.log("params", params);
          const histData = await brokerApi.getCandleData(params);

          this.emit(inst.token, histData);
        } catch (error) {
          console.log("error getting historical data", inst, error);
        }
      });

      this.stocklist.set(inst.token, cronHist);
    }
  }

  unsubHistoricalData(inst) {
    if (this.stocklist.has(inst.token)) {
      const crontask = this.stocklist.get(inst.token);
      if (crontask) {
        crontask.stop();
      } else {
        console.log("task not found");
      }
    }
  }
}

export default HistoricalDataProvider;
