import {EVMWallet} from "crosslightning-evm/dist/evm/signer/EVMSigner"

const privKey = process.env.EVM_PRIVKEY;
const address = process.env.EVM_ADDRESS;

const rpcUrl = process.env.EVM_RPC_URL;
const networkId = parseInt(process.env.EVM_CHAIN_ID);

export const EVMSigner = new EVMWallet(privKey, rpcUrl, networkId, "storage/wallet");
