const { dscNodeContract, web3 } = require("../web3/web3.js");
const DscNodeBlockConfig = require("../models/DscNodeBlockConfig.js");
const BigNumber = require("bignumber.js");
const { ct, registerUser, updateUserTotalSelfStakeUsdt, manageRank, giveGapIncome, updateDirectBusiness, updateUserNodeInfo, manageUserWallet, giveAdminSettings } = require("../helpers/helper.js");
const StakingModel = require("../models/StakingModel.js");
const RegistrationModel = require("../models/RegistrationModel.js");
const WithdrawIncomeModel = require("../models/WithdrawIncomeModel.js");
const NodesRegistered = require("../models/NodeRegistrationModel.js");
const UpgradedNodes = require("../models/UpgradeNodeModel.js");
const moment = require("moment");
const { zeroAddressTxhash } = require("../helpers/constant.js");
const NodeDeployedModel = require("../models/NodeConvertedModel.js");


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

            if (event == "RegisterUser") {
                const { userAddress, sponsorAddress } = returnValues;
                const newUser = await registerUser(userAddress, Number(timestampNormal), sponsorAddress)
            }
            else if (event == "Staked") {
                try {

                    let { userAddress, amount, totalAmountInUsd, currency, rateDollarPerDsc, lastUsedNonce, mixTxHash } = returnValues;

                    amount = new BigNumber(amount).toFixed();
                    totalAmountInUsd = new BigNumber(totalAmountInUsd).toFixed();
                    lastUsedNonce = Number(lastUsedNonce);
                    rateDollarPerDsc = new BigNumber(rateDollarPerDsc).toFixed();

                    // const totalUsd = new BigNumber(amountDscInUsd).plus(amountUsdt).toFixed();

                    const isPendingStkae = mixTxHash === "NA" ? false : true;
                    let amountInUsdt = "0";
                    let amountInDscInUsd = "0";
                    let amountDsc = "0"
                    if (currency === "USDT") {
                        amountInUsdt = amount;
                    }
                    else {
                        amountInDscInUsd = amount;
                        amountDsc = new BigNumber(amount).dividedBy(rateDollarPerDsc).multipliedBy(1e18).toFixed(0);
                    }



                    const newStake = await StakingModel.create({
                        userAddress,
                        currency,
                        totalAmountInUsd: totalAmountInUsd,
                        amountInDscInUsd: amountInDscInUsd,
                        amountInDsc: amountDsc,
                        amountInUsdt: amountInUsdt,
                        rateDollarPerDsc: rateDollarPerDsc,
                        time: Number(timestampNormal),
                        lastUsedNonce,
                        block: Number(block),
                        transactionHash: transactionHash,
                        mixTxHash: mixTxHash,
                        isPendingStkae,
                    });

                    console.log("New stake created:", newStake);

                    let rankDuringStaking = null;
                    const userDoc = await RegistrationModel.findOne({ userAddress: userAddress });

                    rankDuringStaking = userDoc.currentRank;

                    await updateUserTotalSelfStakeUsdt(userAddress, amount);
                    await updateDirectBusiness(amount, userAddress);
                    await manageRank(userAddress);
                    // await giveGapIncome(userAddress, amount, rankDuringStaking, amountUsdt, amountDscInUsd);


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

                    await manageUserWallet(userAddress, new BigNumber(amountUsdt).toFixed(), null);

                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "WithdrawIncomeDsc") {
                try {
                    const { amountDsc, amountDscInUsd, amountDscAfterDeduction, amountDscInUsdAfterDeduction, rateDollarPerDsc, userAddress, lastUsedNonce } = returnValues;

                    const newWithdraw = await WithdrawIncomeModel.create({
                        userAddress,
                        amountInUsdt: null,
                        amountInUsdtAfterDeduction: null,
                        amountInDsc: new BigNumber(amountDsc).toFixed(),
                        amountInDscAfterDeduction: new BigNumber(amountDscAfterDeduction).toFixed(),
                        amountInDscInUsd: new BigNumber(amountDscInUsd).toFixed(),
                        amountInDscInUsdAfterDeduction: new BigNumber(amountDscInUsdAfterDeduction).toFixed(),
                        time: Number(timestampNormal),
                        lastUsedNonce: Number(lastUsedNonce),
                        block: Number(block),
                        transactionHash: transactionHash
                    });

                    console.log("Dsc withdraw doc created:", newWithdraw);

                    await manageUserWallet(userAddress, null, new BigNumber(amountDsc).toFixed());


                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "NodeDeployed") {
                try {
                    const { user, nodeNum } = returnValues;

                    const nodeConverted = await NodeDeployedModel.create({
                        userAddress: user,
                        nodeNum: Number(nodeNum),
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash,
                        lastRoiDistributed: moment().startOf('day').unix()
                    });

                    console.log("Node deployed-->>", nodeConverted);

                    await updateUserNodeInfo(user, Number(nodeNum), Number(timestampNormal));


                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "NodeRegistered") {
                try {
                    let { user, amountUsdtPaid, majorIncome, minor4Income } = returnValues;
                    amountUsdtPaid = new BigNumber(amountUsdtPaid).toFixed(0);
                    majorIncome = new BigNumber(majorIncome).toFixed(0);
                    minor4Income = new BigNumber(minor4Income).toFixed(0);

                    const newReg = await NodesRegistered.create({
                        userAddress: user,
                        amountUsdtPaid,
                        majorIncome,
                        minor4Income,
                        nodeNum: Number(nodeNum),
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash
                    });
                    console.log("New node registered", newReg)

                    const regDoc = await RegistrationModel.findOne({ userAddress: user });
                    if (!regDoc) {
                        console.log("No registration doc found for user while registering node:", user);
                    }
                    // const updatedBalance = new BigNumber(regDoc.nodePurchasingBalance).plus(amountUsdtPaid).toFixed(0);

                    // regDoc.nodePurchasingBalance = updatedBalance;
                    regDoc.isNodeRegDone = true;
                    await regDoc.save();

                } catch (error) {
                    console.log(error);
                    continue;
                }



            }
            else if (event == "UpgradeNode") {
                try {
                    let { user, nodeNum, amount, lastUsedNonce, totalAmountInUsd,mixTxHash,currency,rate } = returnValues;
                    amountUsdtPaid = new BigNumber(amount).toFixed(0);
                    totalAmountInUsd = new BigNumber(totalAmountInUsd).toFixed(0);
                    rate = new BigNumber(rate).toFixed(0);

                    const upgradeNode = await UpgradedNodes.create({
                        userAddress: user,
                        nodeNum: Number(nodeNum),
                        amountUsdPaid:amountUsdtPaid,
                        lastUsedNonce: Number(lastUsedNonce),
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash,
                        totalAmountInUsd,
                        currency,
                        rateDollarPerDsc:rate,
                        mixTransactionHash: mixTxHash,
                        isPaymentCompleted:true
                    });

                    console.log("Node upgraded doc created:", upgradeNode);
                    const regDoc = await RegistrationModel.findOne({ userAddress: user });
                    if (!regDoc) {
                        console.log("No registration doc found for user while upgrading node:", user);
                    }
                    const { nodePurchasingBalance } = regDoc;
                    const { nodeValidators } = await giveAdminSettings();
                    const myNode = nodeValidators.find(n => n.nodeNum === Number(nodeNum));
                    const nodePrice = new BigNumber(myNode ? myNode.selfStaking : "0").multipliedBy(0.1).toFixed();
                    if (new BigNumber(nodePurchasingBalance).isGreaterThan(nodePrice)) {
                        regDoc.nodePurchasingBalance = new BigNumber(nodePurchasingBalance).minus(nodePrice).toFixed(0);

                    } else {
                        //update nodepurchasing balance to zero
                        regDoc.nodePurchasingBalance = "0";

                    }
                    regDoc.currentNodeName = nodeName;
                    regDoc.purchasedNodes.push({ nodeName, purchasedAt: Number(timestampNormal), reward: myNode ? myNode.reward : 0 });
                    await regDoc.save();

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
        console.log("Error updating block:", e);
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

        // lastSyncBlock = "66260963"; 
        // toBlock = "66260963"
        let events = await getEventReciept(lastSyncBlock, toBlock);

        console.log("events", events.length);

        if (events.length > 0) {
            await processEvents(events);
        }
        await updateBlock(toBlock);

        setTimeout(dscNodeListEvents, 5000);
    } catch (error) {
        console.log("Error in dscNode Events:", error);
        setTimeout(dscNodeListEvents, 10000);
    }

}

module.exports = {
    dscNodeListEvents
}