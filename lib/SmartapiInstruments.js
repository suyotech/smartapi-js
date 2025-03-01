import fs, { createWriteStream } from "fs";
import axios from "axios";

const filepath = "./instrumentslist.json";

/**
 * @typedef {Object} Instrument
 * @property {String} token
 * @property {String} symbol
 * @property {String} name
 * @property {String} expiry
 * @property {String} strike
 * @property {String} lotsize
 * @property {String} instrumenttype
 * @property {String} exch_seg
 * @property {String} tick_size
 */

/**
 *
 * @returns {Instrument[]}
 */
export function loadFileData() {
  try {
    const filedata = JSON.parse(fs.readFileSync(filepath));

    if (!Array.isArray(filedata)) {
      throw new Error("error reading file");
    }

    return filedata;
  } catch (error) {
    throw new Error(`error loading data ${error.message}`);
  }
}

async function DownloadInstruments() {
  try {
    const startTime = performance.now();
    const writer = createWriteStream(filepath);
    const instruments_uri =
      "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";
    const resp = await axios({
      method: "get",
      url: instruments_uri,
      responseType: "stream",
    });

    resp.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", (error) => reject(error));
    });

    const endTime = performance.now();
    const downloadTime = endTime - startTime;

    console.log(`instruments dowloaded in ${downloadTime.toFixed(2)} ms`);
  } catch (error) {
    throw new Error(`error downloading instruments  ${error.message}`);
  }
}

/**
 *
 * @param {Object} params
 * @param {String} [params.token]
 * @param {String} [params.symbol]
 * @param {String} [params.name]
 * @param {String} [params.expiry]
 * @param {String} [params.strike]
 * @param {String} [params.instrumenttype]
 * @param {String} [params.exch_seg]
 * @param {String} [params.optiontype]
 * @param {any} fd filedata variable
 * @returns
 */
function FindInstrument(params, fd = null) {
  let filedata = fd;
  if (!fd) {
    filedata = loadFileData();
  }
  const instrumentdata = filedata.filter((scrip) => {
    const isCE = params?.optiontype === "CE"; // Check if optiontype is "CE"
    const isCDS = scrip.exch_seg === "CDS";

    const tkswrong = scrip.token.split(" ");

    if (tkswrong.length !== 1) {
      return false;
    }

    return Object.keys(params).every((key) => {
      if (params[key] === "" || !params[key]) {
        return true; // If the parameter value is empty, skip this check
      }
      if (key === "optiontype") {
        return (isCE && scrip.symbol.endsWith("CE")) || (!isCE && scrip.symbol.endsWith("PE"));
      }
      if (key === "strike") {
        const paramStrike = params[key];
        const scripStrike = isCDS ? scrip.strike / 1000 : scrip.strike / 100;

        return scripStrike === Number(paramStrike);
      }
      return scrip[key] === params[key];
    });
  });
  const al = instrumentdata?.length;

  if (!al) {
    return null;
  }
  return al === 1 ? instrumentdata[0] : instrumentdata;
}

/**
 * @param {{exch_seg : "NFO"|"MCX"|"CDS",name:"",name:"",instrumenttype : "OPTIDX"|"OPTSTX"|"FUTOPT"}} params
 * @returns {String[]} ExpiryDates
 */
function GetExpiryDates(params, fd) {
  let filedata = fd;
  if (!fd) {
    filedata = loadFileData();
  }

  if (!filedata) {
    console.log("file data null");
    return null;
  }
  if (!params?.exch_seg || !params?.name || !params?.instrumenttype) {
    console.log("instrumenttype or name or exch_seg missing");
    return null;
  }

  const filteredData = filedata.filter((item) => {
    return (
      item.exch_seg === params.exch_seg &&
      item.name === params.name &&
      item.instrumenttype.startsWith(params.instrumenttype)
    );
  });

  const uniqueExpiryDates = new Set(filteredData.map((item) => item.expiry));
  const sortedExpiryDates = Array.from(uniqueExpiryDates).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA - dateB;
  });

  return sortedExpiryDates;
}

function FileOldOrNotExits(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const modifiedTime = stats.mtime;
    const checkTime = new Date();
    console.log("checktime", checkTime);
    checkTime.setHours(8, 30, 0, 0);
    console.log(modifiedTime.toLocaleString(), checkTime.toLocaleString());
    return modifiedTime < checkTime || stats.size === 0;
  } catch (error) {
    if (error.code === "ENOENT") {
      return true; // File does not exist
    } else {
      throw new Error(error.message); // Some other error occurred
    }
  }
}

/**
 * Download new Instruments for broker
 * @returns {void}
 */
async function CheckInstruments() {
  try {
    const downloadfile = FileOldOrNotExits(filepath);
    console.log("check file", downloadfile);
    if (downloadfile) {
      await DownloadInstruments();
    }
  } catch (error) {
    throw new Error(`downloading file error ${error.message}`);
  }
}

/**
 *
 * @param {{price : 0,name:"",expiry:"",instrumenttype : "OPTIDX"|"OPTSTX"|"FUTOPT",maxStrikes:5}} params
 * @param {Array} fd data from filedata function
 * @returns {{atmStrike:"",upStrikes:[],downStrikes:[]}}
 */
function GetOptionStrikes(params, fd) {
  try {
    const { price = 0, name = "", expiry = "", instrumenttype = "", maxStrikes = 5 } = params; // Maximum number of strikes to return for ITM and OTM}

    if (!price || !name || !expiry || !instrumenttype) {
      throw new Error("inputs mising");
    }
    const filedata = fd || loadFileData();
    // Filter strikes based on parameters and option type
    const filteredStrikes = Array.from(
      new Set(
        filedata
          .filter((inst) => {
            return (
              inst.name === name && inst.expiry === expiry && inst.instrumenttype === instrumenttype
            );
          })
          .map((i) => i.strike)
      )
    );

    // Calculate ATM, ITM, and OTM strikes
    const sortedStrikes = filteredStrikes
      .map((strike) => ({
        strike,
        diff: Math.abs(strike - price * 100),
      }))
      .sort((a, b) => a.diff - b.diff);

    const atmStrike = sortedStrikes.slice(0, 1).map((item) => item.strike / 100)[0]; // ATM strike

    const downStrikes = sortedStrikes
      .filter(
        (item) =>
          item.strike < price * 100 &&
          item.strike !== atmStrike * 100 &&
          item.strike < atmStrike * 100
      )
      .slice(0, maxStrikes)
      .map((item) => item.strike / 100); // ITM strikes

    const upStrikes = sortedStrikes
      .filter(
        (item) =>
          item.strike > price * 100 &&
          item.strike !== atmStrike * 100 &&
          item.strike > atmStrike * 100
      )
      .slice(0, maxStrikes)
      .map((item) => item.strike / 100); // OTM strikes

    return { atmStrike, downStrikes, upStrikes };
  } catch (error) {
    throw new Error(error.message);
  }
}

const SmartapiInstruments = {
  CheckInstruments,
  FindInstrument,
  GetExpiryDates,
  GetOptionStrikes,
  loadFileData,
};

export default SmartapiInstruments;
