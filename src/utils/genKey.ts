import {Wallet} from "ethers";
import * as fs from "fs";

const keypair = Wallet.createRandom();

const address = keypair.address;

fs.appendFileSync(".env",
    "EVM_PRIVKEY=\""+keypair.privateKey+"\"\n"+
    "EVM_ADDRESS=\""+address+"\"\n");

console.log("Generated address: "+address);
