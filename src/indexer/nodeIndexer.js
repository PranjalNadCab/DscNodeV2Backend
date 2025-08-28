const { dscNodeContract, web3 } = require("../web3/web3.js");
const DscNodeBlockConfig = require("../models/DscNodeBlockConfig.js");
const BigNumber = require("bignumber.js");
const { ct, registerUser, updateUserTotalSelfStakeUsdt, manageRank, giveGapIncome } = require("../helpers/helper.js");
const StakingModel = require("../models/StakingModel.js");
const RegistrationModel = require("../models/RegistrationModel.js");
const WithdrawIncomeModel = require("../models/WithdrawIncomeModel.js");
const NodeConverted = require("../models/NodeConvertedModel.js");


async function dscNodeSyncBlock() {
    let findLatestBlock = await DscNodeBlockConfig.findOne();
    if (!findLatestBlock) {
        findLatestBlock = await DscNodeBlockConfig.create({ lastSyncBlock: "669095" });
        return findLatestBlock.lastSyncBlock;

    }
    console.log("Latest dscNode sync block in database--->", findLatestBlock.lastSyncBlock);
    return findLatestBlock.lastSyncBlock;
}

async function getEventReciept(fromBlock, toBlock) {

    try {
        let eventsData = await dscNodeContract.getPastEvents("allEvents", {
            fromBlock: fromBlock,
            toBlock: toBlock,
        });
        const uniqueEvents = Array.from(
            new Map(eventsData.map(event => [`${event.transactionHash}_${event.logIndex}`, event])).values()
        );

        // return uniqueEvents;
        return eventsData;
    } catch (error) {
        console.error("Error fetching event receipts:", error);
        return [];
    }
}

async function getTimestamp(blockNumber) {
    let { timestamp } = await web3.eth.getBlock(blockNumber);
    return timestamp;
}

async function processEvents(events) {
    try {

        for (let i = 0; i < events.length; i++) {
            // console.log("-----------got event and block timestamp and returnValues---->", events[i]);
            const { blockNumber, transactionHash, returnValues, event } = events[i];
            const timestamp = await getTimestamp(blockNumber);
            let block = blockNumber.toString();
            let timestampNormal = new BigNumber(timestamp).toFixed();


            console.log("-----------got event and block timestamp and returnValues---->", event, transactionHash, timestamp);

            if (event == "Staked") {
                try {

                    let { sponsor, amountDsc, amountDscInUsd, amountUsdt, rateDollarPerDsc, userAddress, lastUsedNonce } = returnValues;

                    amountDsc = new BigNumber(amountDsc).toFixed();
                    amountDscInUsd = new BigNumber(amountDscInUsd).toFixed();
                    amountUsdt = new BigNumber(amountUsdt).toFixed();
                    lastUsedNonce = Number(lastUsedNonce);
                    rateDollarPerDsc = new BigNumber(rateDollarPerDsc).toFixed();

                    const totalUsd = new BigNumber(amountDscInUsd).plus(amountUsdt).toFixed();
                    const newStake = await StakingModel.create({
                        userAddress,
                        totalAmountInUsd: totalUsd,
                        amountInDscInUsd: amountDscInUsd,
                        amountInDsc: amountDsc,
                        amountInUsdt: amountUsdt,
                        rateDollarPerDsc: rateDollarPerDsc,
                        time: Number(timestampNormal),
                        lastUsedNonce,
                        block: Number(block),
                        transactionHash: transactionHash
                    });

                    console.log("New stake created:", newStake);

                    let rankDuringStaking = null;
                    const userDoc = await RegistrationModel.findOne({ userAddress: userAddress });
                    if (!userDoc) {
                        await registerUser(userAddress, Number(timestampNormal), sponsor);
                    } else {
                        rankDuringStaking = userDoc.currentRank;
                    }


                    await updateUserTotalSelfStakeUsdt(userAddress, totalUsd);
                    await manageRank(userAddress);
                    await giveGapIncome(userAddress, totalUsd, rankDuringStaking, amountUsdt, amountDscInUsd);


                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "WithdrawIncomeUsdt") {
                try {
                    const { userAddress, amountUsdt, amountUsdtAfterDeduction, lastUsedNonce } = returnValues;

                     const newWithdraw = await WithdrawIncomeModel.create({
                        userAddress,
                        amountInUsdt: new BigNumber(amountUsdt).toFixed(),
                        amountInUsdtAfterDeduction: new BigNumber(amountUsdtAfterDeduction).toFixed(),
                        amountInDsc: null,
                        amountInDscAfterDeduction: null,
                        amountInDscInUsd: null,
                        amountInDscInUsdAfterDeduction: null,
                        time: Number(timestampNormal),
                        lastUsedNonce: Number(lastUsedNonce),
                        block: Number(block),
                        transactionHash: transactionHash
                     });

                     console.log("Usdt withdraw doc created:", newWithdraw);

                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "WithdrawIncomeDsc") {
                try {
                    const { amountDsc,amountDscInUsd,amountDscAfterDeductionuserAddress,amountDscInUsdAfterDeduction,rateDollarPerDsc,userAddress, lastUsedNonce } = returnValues;

                        const newWithdraw = await WithdrawIncomeModel.create({
                        userAddress,
                        amountInUsdt: null,
                        amountInUsdtAfterDeduction: null,
                        amountInDsc: new BigNumber(amountDsc).toFixed(),
                        amountInDscAfterDeduction: new BigNumber(amountDscAfterDeductionuserAddress).toFixed(),
                        amountInDscInUsd: new BigNumber(amountDscInUsd).toFixed(),
                        amountInDscInUsdAfterDeduction: new BigNumber(amountDscInUsdAfterDeduction).toFixed(),
                        time: Number(timestampNormal),
                        lastUsedNonce: Number(lastUsedNonce),
                        block: Number(block),
                        transactionHash: transactionHash
                        });

                    console.log("Dsc withdraw doc created:", newWithdraw);


                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "ConvertToNode") {
                try {
                    const { user,nodeName,lastUsedNonce } = returnValues;

                        const nodeConverted = await NodeConverted.create({
                        userAddress:user,
                        nodeName:nodeName,
                        time: Number(timestampNormal),
                        lastUsedNonce: Number(lastUsedNonce),
                        block: Number(block),
                        transactionHash: transactionHash
                        });

                    console.log("Node converted doc created:", nodeConverted);


                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else {
                console.log("Got no events!");
            }


        }
    } catch (error) {
        console.log(error)
    }
}


async function updateBlock(updatedBlock) {
    try {
        let isUpdated = await DscNodeBlockConfig.updateOne(
            {},
            { $set: { lastSyncBlock: updatedBlock } }
        );
        if (!isUpdated) {
            console.log("Something went wrong updating the block!");
        }
    } catch (e) {
        console.log("Error updating block:", error);
    }
}

const dscNodeListEvents = async () => {

    try {
        let lastSyncBlock = await dscNodeSyncBlock();
        lastSyncBlock = Number(lastSyncBlock);
        let latestBlock = await web3.eth.getBlockNumber();
        latestBlock = Number(latestBlock);
        let toBlock =
            latestBlock > lastSyncBlock + 100 ? lastSyncBlock + 100 : latestBlock;
        // console.log("Latest block and last synced block of blockchain is: ", latestBlock.toString(), lastSyncBlock.toString());

        latestBlock = latestBlock.toString();
        lastSyncBlock = lastSyncBlock.toString();
        toBlock = toBlock.toString()
        ct({ latestBlock, lastSyncBlock, diffBlock: (new BigNumber(latestBlock).minus(lastSyncBlock)).toFixed(), fromBlock: lastSyncBlock, toBlock });

        // lastSyncBlock = "54716604"; 
        // toBlock = "54716604"
        let events = await getEventReciept(lastSyncBlock, toBlock);

        console.log("events", events.length);

        if (events.length > 0) {
            await processEvents(events);
        }
        await updateBlock(toBlock);

        setTimeout(dscNodeListEvents, 8000);
    } catch (error) {
        console.log("Error in dscNode Events:", error);
        setTimeout(dscNodeListEvents, 10000);
    }

}

module.exports = {
    dscNodeListEvents
}