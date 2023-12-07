import os from 'os'

// Function to get the local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let localIP = '';

  // Loop through network interfaces
  Object.keys(interfaces).forEach((interfaceName) => {
    const interfaceInfo = interfaces[interfaceName];
    // Find an IPv4 address that is not internal or loopback
    const activeInterface = interfaceInfo.find(
      (info) => !info.internal && info.family === 'IPv4'
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
  let macAddress = '';

  // Loop through network interfaces to find the MAC address
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaceInfo = networkInterfaces[interfaceName];

    const mac = interfaceInfo.find((details) => details.mac && details.mac !== '00:00:00:00:00:00');

    if (mac) {
      macAddress = mac.mac;
    }
  });

  return macAddress;
}

// Get and log the local IP address and MAC address
const localIPAddress = getLocalIP();
console.log('Local IP Address:', localIPAddress);

const macAddress = getMAC();
console.log('MAC Address:', macAddress);
