#Unofficial SDK for angelone.in smartapi

## Installation

### Note - Support only for ES6 modules. Commonjs not supported.

```bash
npm install @suyotech-dev/smartapi-js
```

```bash
const brokerid = "ABCD";
const mpin = "2025";
const apikey = "aklsdjflskd";
const totpkey = "AFDDFJDJLLEEIJD";

const api = new SmartApi(brokerid,mpin,apikey,totpkey);
await api.generateSession();
```
