# Bitcoin relay synchronizer + Watchtower

## Btc Relay
A nodejs app, utilizing bitcoind full node and synchronizing all blockheaders to [smart contract on EVM](https://github.com/adambor/BTCRelay). This app is also handling possible forks and chain splits and always tries to submit the chain with highest work.

## Watchtower
Watches the chain for Bitcoin -> EVM swaps and automatically claims them on behalf of payees, earning a fee in EVM native currency in return, more on it [here](https://github.com/adambor/CrossLightning-readme/blob/main/swaps/onchain.md#watchtowers) 

## Requirements
* bitcoind node (Download latest from [here](https://bitcoincore.org/en/download/) or [build from source](https://baloian.medium.com/how-to-setup-and-run-a-bitcoin-full-node-on-ubuntu-a106fb86dbb3))
* nodejs (requires v18 or higher)
* npm
* typescript

## Installation
1. Install npm packages: ```npm install```
2. Install typescript: ```npm install -g typescript```
3. Compile to javascript: ```tsc```
4. Setup bitcoind node in testnet mode (example config is in [bitcoin.conf](https://github.com/adambor/BtcRelay-Sol-TS/blob/main/bitcoin/mainnet.bitcoin.conf) (for mainnet) or [bitcoin.conf](https://github.com/adambor/BtcRelay-Sol-TS/blob/main/bitcoin/bitcoin.conf) (for testnet) file)
5. Rename the chain specific configuration (\_Q.env, \_POLYGON.env or \_LINEA\_TESTNET.env) file to .env
6. Fill in the details of your bitcoind node in .env file (you don't have to edit this file when using local node and a provided [bitcoin.conf](https://github.com/adambor/BtcRelay-EVM-TS/blob/main/bitcoin/bitcoin.conf) config)
7. Generate a new EVM keypair: ```npm run genKey```
8. Deposit some EVM native tokens to the address displayed, to cover tx fees.
9. Run the app with: ```npm start```
