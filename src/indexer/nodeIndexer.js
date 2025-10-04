const { dscNodeContract, web3 } = require("../web3/web3.js");
const DscNodeBlockConfig = require("../models/DscNodeBlockConfig.js");
const BigNumber = require("bignumber.js");
const { ct, registerUser, updateUserTotalSelfStakeUsdt, manageRank, giveGapIncome, updateDirectBusiness, updateUserNodeInfo, manageUserWallet, giveAdminSettings, sendNodeRegIncomeToUpline } = require("../helpers/helper.js");
const StakingModel = require("../models/StakingModel.js");
const RegistrationModel = require("../models/RegistrationModel.js");
const WithdrawIncomeModel = require("../models/WithdrawIncomeModel.js");
const NodesRegistered = require("../models/NodeRegistrationModel.js");
const UpgradedNodes = require("../models/UpgradeNodeModel.js");
const moment = require("moment");
const { zeroAddressTxhash, ranks } = require("../helpers/constant.js");
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
                try{

                    const { userAddress, sponsorAddress, amount } = returnValues;
                const regAmount = new BigNumber(amount).toFixed();

                // find matching rank
                // const matchedRank = ranks.find(r =>
                //     regAmount.gte(r.lowerBound) && regAmount.lte(r.upperBound)
                // ) || null;

                const newUser = await registerUser(userAddress, Number(timestampNormal), sponsorAddress,regAmount,Number(block),transactionHash);

                }catch(error){
                    console.log("Error while registering user",error);
                    continue;
                }
                
            }
            else if (event == "Staked") {
                try {

                    let { userAddress, amount, totalAmountInUsd, currency, rateDollarPerDsc, lastUsedNonce, mixTxHash } = returnValues;

                    amount = new BigNumber(amount).toFixed();
                    totalAmountInUsd = new BigNumber(totalAmountInUsd).toFixed();
                    lastUsedNonce = Number(lastUsedNonce);
                    rateDollarPerDsc = new BigNumber(rateDollarPerDsc).toFixed();

                    // const totalUsd = new BigNumber(amountDscInUsd).plus(amountUsdt).toFixed();
                    let isPendingStake = false;
                    if (mixTxHash == zeroAddressTxhash) {
                        isPendingStake = true;
                        mixTxHash = transactionHash
                    } else if ((mixTxHash !== "NA") && (mixTxHash !== zeroAddressTxhash)) {
                        const userPendingStakes = await StakingModel.find({ userAddress: userAddress, isPendingStake: true, mixTxHash: mixTxHash });
                        let amountUsdPaidForDsc = userPendingStakes.filter((stake) => stake.currency === "DSC").reduce((sum, item) => {
                            return sum.plus(item.amountUsdPaid)
                        }, new BigNumber(0));
                        amountUsdPaidForDsc = amountUsdPaidForDsc.plus(amount);
                        const userUsdtStakePart = userPendingStakes.find((item) => item.currency === "USDT");
                        const remainingUsdToPay = new BigNumber(userUsdtStakePart.totalAmountInUsd).minus(amountUsdPaidForDsc).minus(userUsdtStakePart.amountUsdPaid);
                        isPendingStake = remainingUsdToPay.isEqualTo(0) ? false : true;

                    }

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
                        amountUsdPaid: amount,
                        amountInDsc: amountDsc,
                        amountInUsdt: amountInUsdt,
                        rateDollarPerDsc: rateDollarPerDsc,
                        time: Number(timestampNormal),
                        lastUsedNonce,
                        block: Number(block),
                        transactionHash: transactionHash,
                        mixTxHash: mixTxHash,
                        isPendingStake,
                    });

                    console.log("New stake created:", newStake);



                    let rankDuringStaking = null;
                    const userDoc = await RegistrationModel.findOne({ userAddress: userAddress });

                    rankDuringStaking = userDoc.currentRank;

                    await updateUserTotalSelfStakeUsdt(userAddress, amount);
                    await updateDirectBusiness(amount, userAddress);
                    await manageRank(userAddress);
                    let rateDollarPerDscInNum = Number(new BigNumber(rateDollarPerDsc).dividedBy(1e18).toFixed(2));
                    if (!isPendingStake && mixTxHash !== "NA") {
                        const userTotalStakes = await StakingModel.find({ userAddress: userAddress, mixTxHash: mixTxHash });
                        const stakingAmountIn1e18 = userTotalStakes.find((item) => { return item.currency === "USDT" }).totalAmountInUsd;
                        const usdtStakedIn1e18 = userTotalStakes.find((item) => { return item.currency === "USDT" }).amountUsdPaid;
                        const dscStakedInUsdtIn1e18 = userTotalStakes.filter((item) => item.currency === "DSC").reduce((sum, item) => {
                            return sum.plus(item.amountUsdPaid)
                        }, new BigNumber(0));

                        await giveGapIncome(userAddress, stakingAmountIn1e18, rankDuringStaking, usdtStakedIn1e18, dscStakedInUsdtIn1e18.toFixed(), "stake", rateDollarPerDscInNum);
                        await StakingModel.updateMany(
                            { userAddress, mixTxHash },
                            { $set: { isPendingStake: false } }
                        );
                    } else if (mixTxHash === "NA") {
                        await giveGapIncome(userAddress, totalAmountInUsd, rankDuringStaking, amountInUsdt, amountInDscInUsd, "stake", rateDollarPerDscInNum);

                    } else {
                        console.log("do nothing for incomeplete stakes");
                    }


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
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash
                    });
                    console.log("New node registered", newReg)

                    const regDoc = await RegistrationModel.findOne({ userAddress: user });
                    if (!regDoc) {
                        console.log("No registration doc found for user while registering node:", user);
                    }
                    const updatedBalance = new BigNumber(regDoc.nodePurchasingBalance).plus(amountUsdtPaid).toFixed(0);

                    regDoc.nodePurchasingBalance = updatedBalance;
                    regDoc.isNodeRegDone = true;
                    await regDoc.save();

                    await sendNodeRegIncomeToUpline(user, majorIncome, minor4Income, Number(timestampNormal));

                } catch (error) {
                    console.log(error);
                    continue;
                }



            }
            else if (event == "UpgradeNode") {
                try {
                    let { user, nodeNum, amount, lastUsedNonce, totalAmountInUsd, mixTxHash, currency, rate } = returnValues;
                    amountUsdtPaid = new BigNumber(amount).toFixed(0);
                    totalAmountInUsd = new BigNumber(totalAmountInUsd).toFixed(0);
                    rate = new BigNumber(rate).toFixed(0);

                    let isPaymentCompleted = true;
                    if (mixTxHash == zeroAddressTxhash) {
                        isPaymentCompleted = false;
                        mixTxHash = transactionHash
                    } else if ((mixTxHash !== "NA") && (mixTxHash !== zeroAddressTxhash)) {
                        const userPendingUpgradeNodes = await UpgradedNodes.find({ userAddress: user, isPaymentCompleted: false, mixTxHash: mixTxHash });
                        let amountUsdPaidForDsc = userPendingUpgradeNodes.filter((stake) => stake.currency === "DSC").reduce((sum, item) => {
                            return sum.plus(item.amountUsdPaid)
                        }, new BigNumber(0));
                        amountUsdPaidForDsc = amountUsdPaidForDsc.plus(amount);
                        const userUsdtStakePart = userPendingUpgradeNodes.find((item) => {
                            return item.currency === "USDT";
                        });
                        const remainingUsdToPay = new BigNumber(userUsdtStakePart.totalAmountInUsd).minus(amountUsdPaidForDsc).minus(userUsdtStakePart.amountUsdPaid);

                        isPaymentCompleted = remainingUsdToPay.isEqualTo(0) ? true : false;

                    }

                    const upgradeNode = await UpgradedNodes.create({
                        userAddress: user,
                        nodeNum: Number(nodeNum),
                        amountUsdPaid: amountUsdtPaid,
                        lastUsedNonce: Number(lastUsedNonce),
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash,
                        totalAmountInUsd,
                        currency,
                        rateDollarPerDsc: rate,
                        mixTransactionHash: mixTxHash,
                        isPaymentCompleted: isPaymentCompleted
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
                        regDoc.nodePurchasingBalance = "0";

                    }

                    await regDoc.save();

                    let amountInUsdt = "0";
                    let amountInDscInUsd = "0";
                    let amountDsc = "0"
                    if (currency === "USDT") {
                        amountInUsdt = amount;
                    }
                    else {
                        amountInDscInUsd = amount;
                        amountDsc = new BigNumber(amount).dividedBy(rate).multipliedBy(1e18).toFixed(0);
                    }
                    let rateDollarPerDscInNum = Number(new BigNumber(rate).dividedBy(1e18).toFixed(2));

                    if (isPaymentCompleted && mixTxHash !== "NA") {
                        const userTotalUpgradeDocs = await UpgradedNodes.find({ userAddress: userAddress, nodeNum: Number(nodeNum) });
                        const stakingAmountIn1e18 = userTotalUpgradeDocs.find((item) => { return item.currency === "USDT" }).totalAmountInUsd;
                        const usdtStakedIn1e18 = userTotalUpgradeDocs.find((item) => { return item.currency === "USDT" }).amountUsdPaid;
                        const dscStakedInUsdtIn1e18 = userTotalUpgradeDocs.filter((item) => item.currency === "DSC").reduce((sum, item) => {
                            return sum.plus(item.amountUsdPaid)
                        }, new BigNumber(0));

                        await giveGapIncome(userAddress, stakingAmountIn1e18, rankDuringStaking, usdtStakedIn1e18, dscStakedInUsdtIn1e18.toFixed(), "node", rateDollarPerDscInNum);
                        await UpgradedNodes.updateMany(
                            { userAddress: user, mixTxHash },
                            { $set: { isPaymentCompleted: true } }
                        );
                    } else if (mixTxHash === "NA") {
                        await giveGapIncome(userAddress, totalAmountInUsd, rankDuringStaking, amountInUsdt, amountInDscInUsd, "node", rateDollarPerDscInNum);

                    } else {
                        console.log("do nothing for incomeplete node upgrades");
                    }


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

        // lastSyncBlock = "66872032"; 
        // toBlock = "66872032"
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