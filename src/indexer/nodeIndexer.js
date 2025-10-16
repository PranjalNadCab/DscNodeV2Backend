const { dscNodeContract, web3 } = require("../web3/web3.js");
const DscNodeBlockConfig = require("../models/DscNodeBlockConfig.js");
const BigNumber = require("bignumber.js");
const { ct, registerUser, updateUserTotalSelfStakeUsdt, manageRank, giveGapIncome, updateDirectBusiness, updateUserNodeInfo, manageUserWallet, giveAdminSettings, sendNodeRegIncomeToUpline, updateTeamCount, updateDirectCount, generateRandomId, giveUserType } = require("../helpers/helper.js");
const StakingModel = require("../models/StakingModel.js");
const RegistrationModel = require("../models/RegistrationModel.js");
const WithdrawIncomeModel = require("../models/WithdrawIncomeModel.js");
const NodesRegistered = require("../models/NodeRegistrationModel.js");
const UpgradedNodes = require("../models/UpgradeNodeModel.js");
const moment = require("moment");
const { zeroAddressTxhash, ranks } = require("../helpers/constant.js");
const NodeDeployedModel = require("../models/NodeDeployedModel.js");
const NbdFundModel = require("../models/NbdFundsModel.js");
const { getLivePrice } = require("../utils/liveDscPriceApi.js");
const ActivateFsrModel = require("../models/ActivateFsrModel.js");


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
                try {

                    const { userAddress, sponsorAddress, amount, majorIncome, minor4Income } = returnValues;
                    const regAmount = new BigNumber(amount).toFixed();


                    const newUser = await registerUser(userAddress, Number(timestampNormal), sponsorAddress, regAmount, Number(block), transactionHash);
                    // await sendNodeRegIncomeToUpline(userAddress, majorIncome, minor4Income, Number(timestampNormal),regAmount);
                    await getLivePrice()

                } catch (error) {
                    console.log("Error while registering user", error);
                    continue;
                }

            }
            else if (event == "NbdPaid") {
                try {
                    let { userAddress, majorIncome, minor4Income, amountNbdPaid, sponsorAddress, isRegistration,nodeNum=null } = returnValues;
                    amountNbdPaid = new BigNumber(amountNbdPaid).toFixed();


                    let regDoc = null;
                    if (isRegistration) {
                        // regDoc = await registerUser(userAddress, Number(timestampNormal), sponsorAddress, amountNbdPaid, Number(block), transactionHash);
                        const uniqueRandomId = await generateRandomId();
                        regDoc = await RegistrationModel.create({
                            uniqueRandomId: uniqueRandomId,
                            userAddress,
                            sponsorAddress,
                            time: Number(timestampNormal),
                            currentRank: "Beginner",
                            // nodePurchasingBalance:amountNbdPaid,
                            block: Number(block),
                            transactionHash,
                            rankAchievedAt:Number(timestampNormal)
                        });

                        await updateTeamCount(userAddress);
                        await updateDirectCount(sponsorAddress);

                    } else {
                        regDoc = await RegistrationModel.findOne({ userAddress: userAddress });
                    }

                    if (!regDoc) {
                        console.log("No registration doc found for user while upgrading node:", userAddress);
                        continue;
                    }

                    const newNbd = await NbdFundModel.create({
                        userAddress,
                        time:Number(timestampNormal),
                        block: Number(block),
                        transactionHash,
                        amountNbdPaid: amountNbdPaid,
                        nodeNum: Number(nodeNum)
                    });


                    const { nodePurchasingBalance } = regDoc;
                    regDoc.nodePurchasingBalance = new BigNumber(nodePurchasingBalance).plus(amountNbdPaid).toFixed(0);

                    await regDoc.save();

                    await sendNodeRegIncomeToUpline(userAddress, majorIncome, minor4Income, Number(timestampNormal), amountNbdPaid,Number(nodeNum));

                    await getLivePrice()
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
                        isPaymentCompleted: isPaymentCompleted,
                        rankAchievedAt: Number(timestampNormal)
                    });

                    let rankDuringStaking = null;


                    console.log("Node upgraded doc created:", upgradeNode);
                    const regDoc = await RegistrationModel.findOne({ userAddress: user });
                    if (!regDoc) {
                        console.log("No registration doc found for user while upgrading node:", user);
                    }
                    rankDuringStaking = regDoc.currentRank;
                    const { nodeValidators } = await giveAdminSettings();
                    const myNode = nodeValidators.find(n => n.nodeNum === Number(nodeNum));
                    

                    await updateUserTotalSelfStakeUsdt(user, amountUsdtPaid);
                    await updateDirectBusiness(amountUsdtPaid, user);
                    await manageRank(user);

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
                        const userTotalUpgradeDocs = await UpgradedNodes.find({ userAddress: user, nodeNum: Number(nodeNum) });
                        const stakingAmountIn1e18 = userTotalUpgradeDocs.find((item) => { return item.currency === "USDT" }).totalAmountInUsd;
                        const usdtStakedIn1e18 = userTotalUpgradeDocs.find((item) => { return item.currency === "USDT" }).amountUsdPaid;
                        const dscStakedInUsdtIn1e18 = userTotalUpgradeDocs.filter((item) => item.currency === "DSC").reduce((sum, item) => {
                            return sum.plus(item.amountUsdPaid)
                        }, new BigNumber(0));

                        await giveGapIncome(user, stakingAmountIn1e18, rankDuringStaking, usdtStakedIn1e18, dscStakedInUsdtIn1e18.toFixed(), "node", rateDollarPerDscInNum,Number(nodeNum));
                        await UpgradedNodes.updateMany(
                            { userAddress: user, mixTxHash },
                            { $set: { isPaymentCompleted: true } }
                        );
                    } else if (mixTxHash === "NA") {
                        await giveGapIncome(user, totalAmountInUsd, rankDuringStaking, amountInUsdt, amountInDscInUsd, "node", rateDollarPerDscInNum,Number(nodeNum));

                    } else {
                        console.log("do nothing for incomeplete node upgrades");
                    }

                    await getLivePrice()


                } catch (error) {
                    console.log(error);
                    continue;
                }

            }
            else if (event == "NodeDeployed") {
                try {
                    const { user, nodeNum,name,sudoLink,mobile } = returnValues;

                    const nodeConverted = await NodeDeployedModel.create({
                        userAddress: user,
                        nodeNum: Number(nodeNum),
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash,
                        lastRoiDistributed: moment().startOf('day').unix(),
                        name,
                        sudoLink,
                        mobile
                    });

                    console.log("Node deployed-->>", nodeConverted);

                    await updateUserNodeInfo(user, Number(nodeNum), Number(timestampNormal));


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
            else if (event == "FsrActivated") {
                try {
                    let { user, activationAmount, dscAmountInUsd, generatedDsc, priceInUsd, lastUsedNonce } = returnValues;
                    activationAmount = new BigNumber(activationAmount).dividedBy(1e18).toNumber();
                    dscAmountInUsd = new BigNumber(dscAmountInUsd).dividedBy(1e18).toNumber();
                    generatedDsc = new BigNumber(generatedDsc).dividedBy(1e18).toNumber();
                    priceInUsd = new BigNumber(priceInUsd).dividedBy(1e18).toNumber();
                    lastUsedNonce = Number(lastUsedNonce);

                    const {userType="normal"} = await giveUserType();
                    const newFsr = await ActivateFsrModel.create({
                        userAddress: user,
                        activationAmount,
                        dscAmountInUsd,
                        generatedDsc,
                        priceInUsd,
                        lastUsedNonce,
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash,
                        userType
                    });

                    console.log("Found New FSR:", newFsr);



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