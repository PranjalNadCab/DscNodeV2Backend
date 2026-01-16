const { dscNodeContract, web3 } = require("../web3/web3.js");
const DscNodeBlockConfig = require("../models/DscNodeBlockConfig.js");
const BigNumber = require("bignumber.js");
const { ct, registerUser, updateUserTotalSelfStakeUsdt, manageRank, giveGapIncome, updateDirectBusiness, updateUserNodeInfo, manageUserWallet, giveAdminSettings, sendNodeRegIncomeToUpline, updateTeamCount, updateDirectCount, generateRandomId, giveUserType, manageUserWalletForDsc, manageAssuranceIncome } = require("../helpers/helper.js");
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
const SwappingModel = require("../models/SwappingModel.js");
const LiquidityModel = require("../models/LiquidityModel.js");
const ManageAssuranceWithdrawalModel = require("../models/ManageAssuranceWithdrawalModel.js");
const mongoose = require("mongoose");


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
                    let { userAddress, majorIncome, minor4Income, amountNbdPaid, sponsorAddress, isRegistration, nodeNum = null } = returnValues;
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
                            rankAchievedAt: Number(timestampNormal)
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
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash,
                        amountNbdPaid: amountNbdPaid,
                        nodeNum: Number(nodeNum)
                    });


                    const { nodePurchasingBalance } = regDoc;
                    regDoc.nodePurchasingBalance = new BigNumber(nodePurchasingBalance).plus(amountNbdPaid).toFixed(0);

                    await regDoc.save();

                    await updateUserTotalSelfStakeUsdt(userAddress, amountNbdPaid);
                    await updateDirectBusiness(amountNbdPaid, userAddress);


                    await sendNodeRegIncomeToUpline(userAddress, majorIncome, minor4Income, Number(timestampNormal), amountNbdPaid, Number(nodeNum));
                    await manageRank(userAddress);
                    await manageRank(sponsorAddress);
                    await getLivePrice()
                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "UpgradeNode") {
                try {
                    let { user, nodeNum, amount, lastUsedNonce, totalAmountInUsd, mixTxHash, currency, rate } = returnValues;
                    let amountUsdtPaid = new BigNumber(amount).toFixed(0);
                    totalAmountInUsd = new BigNumber(totalAmountInUsd).toFixed(0);
                    rate = new BigNumber(rate).toFixed(0);

                    let isPaymentCompleted = true;
                    const userPrevNode = await UpgradedNodes.findOne({
                        userAddress: user,
                        nodeNum: { $lt: Number(nodeNum) }
                    }).sort({ nodeNum: -1 });
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

                        const netTotalAmountInUsd = userPrevNode ? new BigNumber(userUsdtStakePart.totalAmountInUsd).minus(userPrevNode.totalAmountInUsd) : new BigNumber(userUsdtStakePart.totalAmountInUsd);
                        const remainingUsdToPay = new BigNumber(netTotalAmountInUsd).minus(amountUsdPaidForDsc).minus(userUsdtStakePart.amountUsdPaid);

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
                        rankAchievedAt: Number(timestampNormal),
                        paidBy: {
                            userAddress: user,
                            userType: 'self',
                        }
                    });

                    let rankDuringStaking = null;


                    console.log("Node upgraded doc created:", upgradeNode);
                    const regDoc = await RegistrationModel.findOne({ userAddress: user });
                    if (!regDoc) {
                        console.log("No registration doc found for user while upgrading node:", user);
                    }
                    rankDuringStaking = regDoc.currentRank || "Beginner";
                    const { nodeValidators } = await giveAdminSettings();
                    const myNode = nodeValidators.find(n => n.nodeNum === Number(nodeNum));


                    await updateUserTotalSelfStakeUsdt(user, amountUsdtPaid);
                    await updateDirectBusiness(amountUsdtPaid, user);
                    await manageRank(user);
                    await manageRank(regDoc.sponsorAddress);


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
                        let stakingAmountIn1e18 = userTotalUpgradeDocs.find((item) => { return item.currency === "USDT" }).totalAmountInUsd;
                        stakingAmountIn1e18 = new BigNumber(stakingAmountIn1e18).minus(userPrevNode?.totalAmountInUsd || 0).toFixed(0);

                        const usdtStakedIn1e18 = userTotalUpgradeDocs.find((item) => { return item.currency === "USDT" }).amountUsdPaid;
                        const dscStakedInUsdtIn1e18 = userTotalUpgradeDocs.filter((item) => item.currency === "DSC").reduce((sum, item) => {
                            return sum.plus(item.amountUsdPaid)
                        }, new BigNumber(0));

                        await giveGapIncome(user, stakingAmountIn1e18, rankDuringStaking, usdtStakedIn1e18, dscStakedInUsdtIn1e18.toFixed(), "node", rateDollarPerDscInNum, Number(nodeNum));
                        await UpgradedNodes.updateMany(
                            { userAddress: user, mixTxHash },
                            { $set: { isPaymentCompleted: true } }
                        );
                    } else if (mixTxHash === "NA") {
                        const netAmountPaidInUsd = new BigNumber(totalAmountInUsd).minus(userPrevNode?.totalAmountInUsd || 0).toFixed(0);
                        await giveGapIncome(user, netAmountPaidInUsd, rankDuringStaking, amountInUsdt, amountInDscInUsd, "node", rateDollarPerDscInNum, Number(nodeNum));

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
                    const { user, nodeNum, name, sudoLink, mobile } = returnValues;

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

                    await manageUserWalletForDsc(userAddress, amountDscInUsd);


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

                    const { userType = "normal" } = await giveUserType(user);
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

                    const userDoc = await RegistrationModel.findOneAndUpdate({ userAddress: user }, {
                        $inc: {
                            activatedFsr: activationAmount
                        }
                    });




                    console.log("Found New FSR:", newFsr);



                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "SponsoredTx") {
                try {
                    let { userAddress, spnosoredTxHash, dscInUsdPaid, rateDollarPerDsc, lastUsedNonce } = returnValues;

                    dscInUsdPaid = new BigNumber(dscInUsdPaid);


                    let userDoc = await RegistrationModel.findOne({ userAddress });
                    if (!userDoc) {
                        console.log("No user doc found for sponsored tx:", userAddress);
                        continue;
                    }
                    const { utilizedFsr, activatedFsr } = userDoc;
                    if (userDoc.userType === "normal") {
                        console.log("Normal users are not allowed", userDoc);
                    }
                    const sponsoredTx = await UpgradedNodes.findOne({ transactionHash: spnosoredTxHash, isPaymentCompleted: false, currency: "USDT" });

                    if (!sponsoredTx) {
                        console.log("No sponsored tx found or already completed:", spnosoredTxHash);
                        continue;
                    }

                    const prevNode = await UpgradedNodes.findOne({
                        userAddress: sponsoredTx.userAddress,
                        nodeNum: { $lt: sponsoredTx.nodeNum },
                        isPaymentCompleted: true
                    }).sort({ nodeNum: -1 });

                    const { totalAmountInUsd, userAddress: sponsoredUser, amountUsdPaid, nodeNum, mixTxHash } = sponsoredTx;
                    let netTotalAmountInUsd = new BigNumber(totalAmountInUsd).minus(prevNode ? new BigNumber(prevNode.totalAmountInUsd) : 0);


                    const expectedAmountDscInUsd = new BigNumber(netTotalAmountInUsd).minus(amountUsdPaid).toFixed(0);
                    // if (!new BigNumber(expectedAmountDscInUsd).isEqualTo((dscInUsdPaid))) {
                    //     console.log("Sponsored tx amount mismatch:", expectedAmountDscInUsd, dscInUsdPaid.dividedBy(1e18).toFixed());
                    //     continue;
                    // }
                    const difference = new BigNumber(expectedAmountDscInUsd).minus(dscInUsdPaid);
                    if (difference.abs().gt(0.5)) {
                        console.log(
                            "Sponsored tx amount mismatch:",
                            expectedAmountDscInUsd,
                            dscInUsdPaid.dividedBy(1e18).toFixed()
                        );
                        continue;
                    }

                    console.log("Sponsored transaction completed for user:", sponsoredUser);

                    const history = await UpgradedNodes.create({
                        userAddress: sponsoredUser,
                        nodeNum: nodeNum,
                        amountUsdPaid: dscInUsdPaid.toFixed(0),
                        lastUsedNonce: Number(lastUsedNonce),
                        time: Number(timestampNormal),
                        block: Number(block),
                        transactionHash: transactionHash,
                        totalAmountInUsd: totalAmountInUsd,
                        currency: "DSC",
                        rateDollarPerDsc,
                        mixTransactionHash: spnosoredTxHash,
                        isPaymentCompleted: true,
                        rankAchievedAt: Number(timestampNormal),
                        paidBy: {
                            userAddress: userAddress,
                            userType: userDoc.userType,
                        }
                    });

                    sponsoredTx.isPaymentCompleted = true;
                    await sponsoredTx.save();

                    // userDoc.activatedFsr = activatedFsr - dscInUsdPaid.dividedBy(1e18).toNumber();
                    userDoc.utilizedFsr = utilizedFsr + dscInUsdPaid.dividedBy(1e18).toNumber();
                    await userDoc.save();

                    //----- calculate and give gap income----

                    const sponsoredUserDoc = await RegistrationModel.findOne({ userAddress: sponsoredUser });


                    const rateDollarPerDscInNum = Number(new BigNumber(rateDollarPerDsc).dividedBy(1e18).toFixed(2));

                    const userPrevNode = await UpgradedNodes.findOne({
                        userAddress: sponsoredUser,
                        nodeNum: { $lt: Number(nodeNum) }
                    }).sort({ nodeNum: -1 });
                    let rankDuringStaking = sponsoredUserDoc.currentRank || "Beginner";
                    const netAmountPaidInUsd = new BigNumber(totalAmountInUsd).minus(userPrevNode?.totalAmountInUsd || 0).toFixed(0);



                    const usdtStakedIn1e18 = amountUsdPaid;

                    await updateUserTotalSelfStakeUsdt(sponsoredUser, dscInUsdPaid.toFixed(0));
                    await updateDirectBusiness(dscInUsdPaid.toFixed(0), sponsoredUser);

                    await giveGapIncome(sponsoredUser, netAmountPaidInUsd, rankDuringStaking, usdtStakedIn1e18, dscInUsdPaid.toFixed(0), "node", rateDollarPerDscInNum, Number(nodeNum));
                    await manageRank(sponsoredUser);
                    await manageRank(sponsoredUserDoc.sponsorAddress);




                    console.log("Sponsored transaction history created:", history);



                } catch (error) {
                    console.log(error);
                    continue;
                }
            }
            else if (event == "Swapped") {
                try {
                    const { userAddress, swappedAmount } = returnValues;

                    const swapped = await SwappingModel.create({
                        userAddress,
                        swappedAmount: new BigNumber(swappedAmount).dividedBy(1e18).toNumber(),
                        block: Number(block),
                        transactionHash
                    });

                    console.log("Swapped amount--->>", swapped);
                } catch (error) {
                    console.log(error);
                    continue;
                }


            }
            else if (event == "Liquidity") {
                try {
                    const { userAddress, usdt, dsc } = returnValues;

                    const addedLiquidity = await LiquidityModel.create({
                        userAddress,
                        usdt: new BigNumber(usdt).dividedBy(1e18).toNumber(),
                        dsc: new BigNumber(dsc).dividedBy(1e18).toNumber(),
                        block: Number(block),
                        transactionHash
                    });

                    console.log("Added liquidity--->>", addedLiquidity);

                } catch (error) {
                    console.log(error);
                    continue;
                }

            }
            else if (event == "SwappedAssurance") {
                const session = await mongoose.startSession();

                try {
                    session.startTransaction();
                    let { user, amountDsc, amountUsdt, lastUsedNonce } = returnValues;

                    amountDsc = new BigNumber(amountDsc).toFixed(0);

                    const { status,message } = await manageAssuranceIncome(user, amountDsc, "SWAPPED", "minus", session);
                    if (!status) {
                        throw new Error(message);
                    }

                    const createdSwapAssurance = await ManageAssuranceWithdrawalModel.create(

                        [{
                            userAddress: user,
                            amountDsc,
                            amountUsdt,
                            actionType: "SWAPPED",
                            lastUsedNonce: Number(lastUsedNonce),
                            block: Number(block),
                            transactionHash,
                            time: Number(timestampNormal),
                        }],
                        { session }
                    );

                    console.log("Created swap assurance--->>", createdSwapAssurance);



                    await session.commitTransaction();
                    session.endSession();

                } catch (error) {
                    console.log(error);
                    await session.abortTransaction();
                    session.endSession();
                    continue;
                }

            }
            else if (event == "TransferAllocationAssurance") {
                const session = await mongoose.startSession();
                try {
                    session.startTransaction();
                    let { user, amountDscTransferred, lastUsedNonce } = returnValues;

                    amountDscTransferred = new BigNumber(amountDscTransferred).toFixed(0);

                    const { status } = await manageAssuranceIncome(user, amountDscTransferred, "TRANSFER", "minus", session);
                    if (!status) {
                        throw new Error("Error managing assurance income during TransferAllocationAssurance");
                    }

                    const createdTransferAssurance = await ManageAssuranceWithdrawalModel.create([{
                        userAddress: user,
                        amountDsc: amountDscTransferred,
                        amountUsdt: "0",
                        actionType: 'TRANSFER',
                        lastUsedNonce: Number(lastUsedNonce),
                        block: Number(block),
                        transactionHash,
                        time: Number(timestampNormal)
                    }], { session });

                    console.log("Created transfer assurance--->>", createdTransferAssurance);

                    await session.commitTransaction();
                    session.endSession();


                } catch (error) {
                    console.log(error);
                    await session.abortTransaction();
                    session.endSession();
                    continue;
                }
            }
            else if (event == "WithdrawAssurance") {
                const session = await mongoose.startSession();

                try {
                    session.startTransaction();
                    let { user, amountDsc, lastUsedNonce } = returnValues;

                    amountDsc = new BigNumber(amountDsc).toFixed(0);

                    const { status } = await manageAssuranceIncome(user, amountDsc, 'WITHDRAW', "minus",session);
                    if (!status) {
                        throw new Error("Error managing assurance income during WithdrawAssurance ");
                    }
                    const createdWithdrawAssurance = await ManageAssuranceWithdrawalModel.create([{
                        userAddress: user,
                        amountDsc: amountDsc,
                        amountUsdt: "0",
                        actionType: 'WITHDRAW',
                        lastUsedNonce: Number(lastUsedNonce),
                        block: Number(block),
                        transactionHash,
                        time: Number(timestampNormal)
                    }], { session });

                    console.log("Created withdraw assurance--->>", createdWithdrawAssurance);
                    await session.commitTransaction();
                    session.endSession();


                } catch (error) {
                    console.log(error);
                    await session.abortTransaction();
                    session.endSession();
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

        // lastSyncBlock = "714368"; 
        // toBlock = "714368"
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