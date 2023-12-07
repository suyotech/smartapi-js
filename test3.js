import os from 'os'

function getIPandMac() {
    const nI = os.networkInterfaces();
    let localip = null;
    let mac = null;
  
    Object.keys(nI).find((key) => {
      const networks = nI[key];
      const found = networks.find((c) => {
        const address = c.address;
        if (address.includes("192.168")) {
          [localip, mac] = [c.address, c.mac.toUpperCase()];
          return true;
        }
        return false;
      });
  
      return found !== undefined;
    });
  
    return { localip, mac };
  }

  console.log("mac and ip",getIPandMac());