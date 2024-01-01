import fs, { createWriteStream } from "fs";
import axios from "axios";

const filepath = "./instrumentslist.json";

function loadFileData() {
  const filedata = JSON.parse(fs.readFileSync(filepath));

  if (!Array.isArray(filedata)) {
    throw new Error("error reading file");
  }

  return filedata;
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
    console.log("error downloading instruments ", error.messsage);
  }
}

/**
 * Find Symbols from downloaded instruments
 * @param {object} params {
 * {exch_seg,name,instrumenttype,strike,expiry}
 * }
 */
async function FindInstrument(params) {
  const filedata = loadFileData();

  const instrumentdata = filedata.filter((scrip) => {
    return Object.keys(params).every((key) => {
      if (params[key] === "" || !params[key]) {
        return true; // If the parameter value is empty, skip this check
      }
      return scrip[key] === params[key];
    });
  });

  const al = instrumentdata?.length;

  if (!al) {
    return null;
  }
  return instrumentdata;
}

/**
 * @param {Object} params
 * @param {string} exch_seg
 * @param {string} name
 * @param {string} instrumenttype
 */
function GetExpiryDates(params) {
  const filedata = loadFileData();

  if(!filedata){
    console.log("file data null");
    return null
  }
  if(!params?.exch_seg || !params?.name || !params?.instrumenttype){
    console.log("instrumenttype or name or exch_seg missing");
    return null
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
    console.log('checktime',checkTime);
    checkTime.setHours(8, 30, 0, 0);
    console.log(modifiedTime.toLocaleString(),checkTime.toLocaleString());
    return modifiedTime < checkTime;
  } catch (error) {
    if (error.code === "ENOENT") {
      return true; // File does not exist
    } else {
      throw error; // Some other error occurred
    }
  }
}

async function CheckInstruments() {
  try {
    const downloadfile = FileOldOrNotExits(filepath);
    console.log("check file", downloadfile);
    if (downloadfile) {
      await DownloadInstruments();
    }
  } catch (error) {
    console.log("downloading file error", error.message);
    return null;
  }
}

function FindNearestStrike(price = 0, name = "", expiry = "",instrumenttype="",optiontype="") {
    try{
      const filedata = loadFileData();

      //Rounding price to nearest strike
      filedata.filter(inst=>{
        return 
      })
    }catch(error){
      console.log(error.message);
    }
}

const SmartapiInstruments = {
  CheckInstruments,
  FindInstrument,
  GetExpiryDates,
  FindNearestStrike
};

export default SmartapiInstruments;
