import * as dotenv from "dotenv";
dotenv.config();

import {EVMSigner} from "./evm/EVMSigner";
import * as fs from "fs/promises";
import {Subscriber} from "zeromq";
import {EVMBtcRelay, EVMBtcStoredHeader, EVMSwapData, EVMSwapProgram} from "crosslightning-evm";
import {BtcRPCConfig} from "./btc/BtcRPC";
import {BitcoindBlock, BitcoindRpc, BtcRelaySynchronizer} from "btcrelay-bitcoind";
import {EVMChainEvents} from "crosslightning-evm/dist/evm/events/EVMChainEvents";
import {Watchtower} from "btcrelay-watchtower";
import {UnsignedTransaction} from "ethers";

async function syncToLatest(
    synchronizer: BtcRelaySynchronizer<EVMBtcStoredHeader, UnsignedTransaction>,
    watchtower: Watchtower<EVMSwapData, EVMBtcStoredHeader, UnsignedTransaction>
) {

    console.log("[Main]: Syncing to latest...");

    const resp = await synchronizer.syncToLatestTxs();

    for(let key in resp.computedHeaderMap) {
        const computedHeader = resp.computedHeaderMap[key];
        console.log("Computed header, height: "+key+": ", {
            chainWork: computedHeader.chainWork.toHexString(),
            reversedPrevBlockHash: computedHeader.reversedPrevBlockHash,
            merkleRoot: computedHeader.merkleRoot,
            data1: computedHeader.data1.toHexString(),
            data2: computedHeader.data2.toHexString(),
        })
    }

    //console.log("[Main]: Synchronizer resp : ", resp);

    const nBlocks = Object.keys(resp.blockHeaderMap).length-1;
    console.log("[Main]: Synchronizing blocks: ", nBlocks);
    console.log("[Main]: Synchronizing blocks in # txs: ", resp.txs.length);

    const wtResp = await watchtower.syncToTipHash(resp.latestBlockHeader.hash, resp.computedHeaderMap);
    const nProcessed = Object.keys(wtResp).length;
    console.log("[Main]: Claiming # ptlcs: ", nProcessed);

    const totalTxs: UnsignedTransaction[] = [];
    resp.txs.forEach(tx => {
        totalTxs.push(tx);
    });

    for(let key in wtResp) {
        wtResp[key].txs.forEach(e => {
            totalTxs.push(e);
        });
    }

    console.log("[Main]: Sending total # txs: ", totalTxs.length);

    //TODO: Figure out some recovery here, since all relayers will be publishing blookheaders and claiming swaps
    let signature;
    for(let i=0;i<totalTxs.length;i++) {
        const tx = totalTxs[i];
        console.log("[Main]: Sending tx: ", i);
        signature = await EVMSigner.sendTransaction(tx);
        console.log("[Main]: TX sent: ", signature);
    }
    if(signature!=null) {
        await EVMSigner.provider.waitForTransaction(signature.hash);
    }
    console.log("[Main]: All txs confirmed!");

}

async function main() {

    try {
        await fs.mkdir("storage")
    } catch (e) {}

    await EVMSigner.init();

    const bitcoinRpc = new BitcoindRpc(
        BtcRPCConfig.protocol,
        BtcRPCConfig.user,
        BtcRPCConfig.pass,
        BtcRPCConfig.host,
        BtcRPCConfig.port
    );
    const btcRelay = new EVMBtcRelay<BitcoindBlock>(EVMSigner, bitcoinRpc, process.env.EVM_BTC_RELAY_CONTRACT_ADDRESS);
    const synchronizer = new BtcRelaySynchronizer(btcRelay, bitcoinRpc);

    const swapProgram = new EVMSwapProgram(EVMSigner, btcRelay, process.env.EVM_SWAP_CONTRACT_ADDRESS);

    await swapProgram.start();

    const chainEvents = new EVMChainEvents("./storage/events", EVMSigner.provider, swapProgram);

    const watchtower = new Watchtower<EVMSwapData, EVMBtcStoredHeader, UnsignedTransaction>("./storage/wt", btcRelay, synchronizer, chainEvents, swapProgram, bitcoinRpc, 30);

    let tipBlock = await btcRelay.getTipData();

    if(tipBlock==null) {
        const tipHeight = (await bitcoinRpc.getTipHeight())-25;
        const lastDiffAdjustmentBlockHeight = tipHeight-(tipHeight%2016);

        const submitBlockHash = await bitcoinRpc.getBlockhash(tipHeight);
        const submitBlock = await bitcoinRpc.getBlockHeader(submitBlockHash);

        const lastDiffAdjBlockHash = await bitcoinRpc.getBlockhash(lastDiffAdjustmentBlockHeight);
        const lastDiffAdjBlock = await bitcoinRpc.getBlockHeader(lastDiffAdjBlockHash);

        const prevBlockTimestamps: number[] = [];
        let lastBlockHash = submitBlock.getPrevBlockhash();
        for(let i=0;i<10;i++) {
            const prevBlock = await bitcoinRpc.getBlockHeader(lastBlockHash);
            prevBlockTimestamps.push(prevBlock.getTimestamp());

            lastBlockHash = prevBlock.getPrevBlockhash();
        }

        const tx = await btcRelay.saveInitialHeader(submitBlock, lastDiffAdjBlock.getTimestamp(), prevBlockTimestamps.reverse());

        const txResult = await EVMSigner.sendTransaction(tx);

        await EVMSigner.provider.waitForTransaction(txResult.hash);

        console.log("[Main]: BTC relay initialized at: ", txResult.hash);

        await new Promise(resolve => setTimeout(resolve, 5000));

        tipBlock = await btcRelay.getTipData();
    }

    console.log("[Main]: BTC relay tip height: ", tipBlock.blockheight);

    await watchtower.init();

    console.log("[Main]: Watchtower initialized!");

    await syncToLatest(synchronizer, watchtower);

    console.log("[Main]: Initial sync complete!");

    const sock = new Subscriber();
    sock.connect("tcp://"+process.env.BTC_HOST+":"+process.env.ZMQ_PORT);
    sock.subscribe("hashblock");

    console.log("[Main]: Listening to new blocks...");
    while(true) {
        try {
            for await (const [topic, msg] of sock) {
                const blockHash = msg.toString("hex");
                console.log("[Main]: New blockhash: ", blockHash);
                await syncToLatest(synchronizer, watchtower);
            }
        } catch (e) {
            console.error(e);
            console.log("[Main]: Error occurred in main...");
        }
    }

}

main().catch(e => {
    console.error(e);
});
