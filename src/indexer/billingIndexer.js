const { dscNodeContract, web3, nodeBillingContract } = require("../web3/web3.js");
const BillingBlockConfig = require("../models/billingblockConfig.js");
const BigNumber = require("bignumber.js");
const { ct, returnLastRoiDistributedTimeOnFeeDeposit } = require("../helpers/helper.js");
const AssuranceFeeModel = require("../models/AssuranceFeeModel.js");
const NodeDeployedModel = require("../models/NodeDeployedModel.js");
const moment = require("moment");



async function billingSyncBlock() {
    let findLatestBlock = await BillingBlockConfig.findOne();
    if (!findLatestBlock) {
        findLatestBlock = await BillingBlockConfig.create({ lastSyncBlock: "669095" });
        return findLatestBlock.lastSyncBlock;
    }
    console.log("Latest billing sync block in database--->", findLatestBlock.lastSyncBlock);
    return findLatestBlock.lastSyncBlock;
}

async function getEventReciept(fromBlock, toBlock) {

    try {
        let eventsData = await nodeBillingContract.getPastEvents("allEvents", {
            fromBlock: fromBlock,
            toBlock: toBlock,
        });
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

            if (event == "Payment") {
                try {

                    let { user, nodeNum, amount, seqMonth } = returnValues;

                    const timestampMoment = moment.unix(Number(timestampNormal)); 
                    const currentMonth = timestampMoment.clone().startOf("month");
                    
                    const lastRecord = await AssuranceFeeModel
                        .findOne({ userAddress: user })
                        .sort({ time: -1 }); // get latest record by time
                    
                    let nextMonth;
                    
                    if (!lastRecord) {
                        // First ever fee for this user
                        nextMonth = currentMonth;
                    } else {
                        const lastPaidMonth = moment(lastRecord.calendarMonth, "MMMM YYYY").startOf("month");
                    
                        if (currentMonth.isAfter(lastPaidMonth)) {
                            // User paid after a gap → assign current real month
                            nextMonth = currentMonth;
                        } else {
                            // Multiple payments in same month → increment from lastPaidMonth
                            nextMonth = lastPaidMonth.clone().add(1, "month");
                        }
                    }
                    
                    const calendarMonth = nextMonth.format("MMMM YYYY");
                    
                    // ct({user,calendarMonth,lastRecord:lastRecord.calendarMonth,amount:Number(new BigNumber(amount).dividedBy(new BigNumber(10).pow(18)).toNumber())});
                    // continue;

                    const createAssuranceHistory = await AssuranceFeeModel.create({
                        userAddress: user,
                        nodeNum: Number(nodeNum),
                        amount: Number(new BigNumber(amount).dividedBy(new BigNumber(10).pow(18)).toNumber()),
                        seqMonth: Number(seqMonth),
                        calendarMonth: calendarMonth,
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash
                    });

                    let userNodeDeployedDoc = await NodeDeployedModel.findOne({ userAddress: user, nodeNum: Number(nodeNum) });

                    if (!userNodeDeployedDoc) continue;

                    // const startDayTime = moment.unix(timestampNormal).startOf("day").unix();

                    // // ✅ Compare months (timestampNormal vs current system month)
                    // const timestampMonth = moment.unix(timestampNormal).format("MMMM YYYY");
                    // const currentMonth = moment().format("MMMM YYYY");

                    const lastRoiDistributed = await returnLastRoiDistributedTimeOnFeeDeposit(
                        user,
                        Number(timestampNormal),
                        userNodeDeployedDoc.time,
                        lastRecord
                    )
                        ct({uid:"indexer", lastRoiDistributed, user,
                       depoTime: Number(timestampNormal),
                       deployedTime: userNodeDeployedDoc.time });
                    // if (timestampMonth === currentMonth) {
                    //     // Only update for current month
                    userNodeDeployedDoc.lastRoiDistributed = process.env.NODE_ENV === "development" ? Number(timestampNormal) : lastRoiDistributed;
                    await userNodeDeployedDoc.save();

                    //     console.log(
                    //         `Updated lastRoiDistributed for user ${user}, node ${nodeNum}, time ${startDayTime}`
                    //     );
                    // } else {
                    //     console.log(
                    //         `Skipped update for user ${user}, node ${nodeNum} (month ${timestampMonth} != ${currentMonth})`
                    //     );
                    // }

                    console.log("Assurance fee stored successfully for user:", user, "nodeNum:", nodeNum, createAssuranceHistory);


                } catch (error) {
                    console.log("Error while storing assurance fee", error);
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
        let isUpdated = await BillingBlockConfig.updateOne(
            {},
            { $set: { lastSyncBlock: updatedBlock } }
        );
        if (!isUpdated) {
            console.log("Something went wrong updating the block!");
        }
    } catch (e) {
        console.log("Error updating block:", e);
    }
}

const billingListEvents = async () => {

    try {
        let lastSyncBlock = await billingSyncBlock();
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

        // lastSyncBlock = "76324955"; 
        // toBlock = "76324955"
        let events = await getEventReciept(lastSyncBlock, toBlock);

        console.log("events", events.length);

        if (events.length > 0) {
            await processEvents(events);
        }
        await updateBlock(toBlock);

        setTimeout(billingListEvents, 5000);
    } catch (error) {
        console.log("Error in billing Events:", error);
        setTimeout(billingListEvents, 10000);
    }

}

module.exports = {
    billingListEvents
}