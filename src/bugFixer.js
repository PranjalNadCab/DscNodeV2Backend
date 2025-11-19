const { ct, giveGapIncome, giveNumFrom1e18, giveCheckSummedAddress } = require("./helpers/helper");
const AssuranceFeeModel = require("./models/AssuranceFeeModel");
const NodeDeployedModel = require("./models/NodeDeployedModel");
const RegistrationModel = require("./models/RegistrationModel");
const moment = require("moment");
const UpgradedNodes = require("./models/UpgradeNodeModel");
const { BigNumber } = require("bignumber.js");
const GapIncomeModel = require("./models/GapIncomeModel");
const NbdFundModel = require("./models/NbdFundsModel");
const { ranks } = require("./helpers/constant");


const giveUserTeam = async (userAddress = null) => {
    try {
        console.log("here")
        const downlineTeam = await RegistrationModel.aggregate([
            {
                $match: {
                    userAddress: "0x384ce8b6122166E7882CD49Ce78F12C3E0bf57Ed"
                }
            },
            {
                $graphLookup: {
                    from: "registration",
                    startWith: "$userAddress",
                    connectFromField: "userAddress",
                    connectToField: "sponsorAddress",
                    as: "downline",
                    maxDepth: 10000,
                    depthField: "level"
                }
            },
            {
                $unwind: {
                    path: "$downline",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    level: { $add: ["$downline.level", 1] },
                    userAddress: "$downline.userAddress",
                    uniqueRandomId: "$downline.uniqueRandomId",
                    currentRank: "$downline.currentRank",
                    userTotalStakeInUsd: "$downline.userTotalStakeInUsd",
                    userDirectPlusSelfStakeInUsd: "$downline.userDirectPlusSelfStakeInUsd"

                }
            },
            {
                $sort: { level: 1 }
            }
        ]);
        const team = downlineTeam;

        for (const member of team) {

            const { userAddress, level, uniqueRandomId, currentRank, userTotalStakeInUsd, userDirectPlusSelfStakeInUsd } = member;

            ct({ userAddress, level, uniqueRandomId, currentRank, userTotalStakeInUsd, userDirectPlusSelfStakeInUsd });
        }

    } catch (error) {
        console.error("Error in giveUserTeam:", error);
    }
}

const updateLastRoiDistributedToPaidAssuranceFees = async () => {
    try {
        const allFees = await AssuranceFeeModel.find({});

        for (const fee of allFees) {


            const userDeployedNode = await NodeDeployedModel.findOne({ userAddress: fee.userAddress, nodeNum: fee.nodeNum }).sort({ deployedAt: -1 }).limit(1);

            if (userDeployedNode) {
                ct({ userAddress: userDeployedNode.userAddress, feeId: (fee._id).toString(), amount: fee.amount, time: fee.time, lastRoiDistributed: userDeployedNode.lastRoiDistributed });
                const startOfDayUnix = moment.unix(fee.time).startOf('day').unix();
                userDeployedNode.lastRoiDistributed = startOfDayUnix;
                // await userDeployedNode.save();
            }
            // break;
        }

    } catch (error) {
        console.log(error);
    }
}

const distributeGapIncome = async () => {
    try {

        const sponsoredTxs = await UpgradedNodes.find({
            "paidBy.userType": { $ne: "self" },
            // userAddress: {
            //     $nin: [
            //         "0x2E7D16145771e74463a9Cac152dF311372166C82",
            //         "0x1a7fb9856a0da56c780304990BA99cf2EFb7CceE"
            //     ]
            // }
        });

        console.log(`sponsored transactions found: ${sponsoredTxs.length}`);

        let count = 0;

        for (const tx of sponsoredTxs) {
            // ct({userAddress:tx.paidBy.userAddress,txHash:tx.transactionHash,amountUsdPaid:tx.amountUsdPaid,time:tx.time});
            count++;
            const { userAddress, nodeNum, totalAmountInUsd, amountUsdPaid, time, isPaymentCompleted, rateDollarPerDsc, transactionHash, paidBy, currency, mixTransactionHash } = tx;

            const userDoc = await RegistrationModel.findOne({ userAddress: userAddress });


            const rateDollarPerDscInNum = Number(new BigNumber(rateDollarPerDsc).dividedBy(1e18).toFixed(2));

            const userPrevNode = await UpgradedNodes.findOne({
                userAddress: userAddress,
                nodeNum: { $lt: Number(nodeNum) }
            }).sort({ nodeNum: -1 });
            let rankDuringStaking = userDoc.currentRank || "Beginner";
            const netAmountPaidInUsd = new BigNumber(totalAmountInUsd).minus(userPrevNode?.totalAmountInUsd || 0).toFixed(0);

            let dscInUsdPaid = new BigNumber(0);
            if (currency === "DSC") {
                dscInUsdPaid = new BigNumber(amountUsdPaid);
            }

            const userOldDataForThisTx = await UpgradedNodes.findOne({
                userAddress: userAddress,
                nodeNum: nodeNum,
                mixTransactionHash: mixTransactionHash,
                currency: "USDT"
            });
            if (!userOldDataForThisTx) continue;

            const usdtStakedIn1e18 = userOldDataForThisTx?.amountUsdPaid;

            // ct({ count, userAddress, netAmountPaidInUsd, rankDuringStaking, amountUsdtPaid: usdtStakedIn1e18, dscInUsdPaid: dscInUsdPaid.toFixed(0), type: "node", rateDollarPerDscInNum, nodeNum: Number(nodeNum) })
            // await giveGapIncome(userAddress, netAmountPaidInUsd, rankDuringStaking, usdtStakedIn1e18, dscInUsdPaid.toFixed(0), "node", rateDollarPerDscInNum, Number(nodeNum));

        }


    } catch (error) {
        console.log(error);
    }
}


const fixGapIncome = async () => {
    try {
        const start = Math.floor(new Date("2025-11-17T00:00:00Z").getTime() / 1000);
        const end = Math.floor(new Date("2025-11-17T23:59:59Z").getTime() / 1000);

        const aggregated = await GapIncomeModel.aggregate([
            {
                $match: {
                    time: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: "$receiverAddress",

                    totalGapIncomeInUsd_1e18: {
                        $sum: { $toDecimal: "$gapIncomeInUsd" }
                    },

                    totalGapIncomeInDscInUsd_1e18: {
                        $sum: { $toDecimal: "$gapIncomeInDscInUsd" }
                    },

                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    receiverAddress: "$_id",
                    _id: 0,
                    totalGapIncomeInUsd_1e18: { $toString: "$totalGapIncomeInUsd_1e18" },
                    totalGapIncomeInDscInUsd_1e18: { $toString: "$totalGapIncomeInDscInUsd_1e18" },
                    count: 1
                }
            }
        ]);

        let userCount = 0;

        for (const doc of aggregated) {
            userCount++;

            const { receiverAddress, totalGapIncomeInUsd_1e18, totalGapIncomeInDscInUsd_1e18, count } = doc;

            if (receiverAddress === "0x5eD156B40f3dB1b98Ae340dDa12B2B624d81ae68") {
                continue;
            }

            // if(receiverAddress !== "0x384ce8b6122166E7882CD49Ce78F12C3E0bf57Ed"){
            //     continue;
            // }

            const userRegDoc = await RegistrationModel.findOne({ userAddress: receiverAddress });

            const {
                usdtIncomeWallet,
                totalIncomeUsdtReceived,
                dscIncomeInUsdWallet,
                totalIncomeDscInUsdReceived
            } = userRegDoc;

            // Convert 1e18 strings to BigNumbers
            const d_before = new BigNumber(dscIncomeInUsdWallet);
            const td_before = new BigNumber(totalIncomeDscInUsdReceived);
            const deduct = new BigNumber(totalGapIncomeInDscInUsd_1e18);

            const d_after = d_before.minus(deduct);
            const td_after = td_before.minus(deduct);

            // 🔥 DEBUG: show OLD, DEDUCT, NEW (all safe before save)
            console.log("==============================================");
            console.log(`USER #${userCount}: ${receiverAddress}`);
            console.log("Dsc Income in USD Wallet:");
            console.log("  OLD :", giveNumFrom1e18(d_before.toFixed(0)));
            console.log("  MINUS:", giveNumFrom1e18(deduct.toFixed(0)));
            console.log("  NEW :", giveNumFrom1e18(d_after.toFixed(0)));
            console.log("----------------------------------------------");
            console.log("Total Income Dsc In USD Received:");
            console.log("  OLD :", giveNumFrom1e18(td_before.toFixed(0)));
            console.log("  MINUS:", giveNumFrom1e18(deduct.toFixed(0)));
            console.log("  NEW :", giveNumFrom1e18(td_after.toFixed(0)));
            console.log("==============================================\n");

            // Apply new values
            // userRegDoc.dscIncomeInUsdWallet = d_after.toFixed(0);
            // userRegDoc.totalIncomeDscInUsdReceived = td_after.toFixed(0);

            // await userRegDoc.save();
        }

    } catch (error) {
        console.log(error);
    }
};

const updateDirectBusinessForAll = async () => {
    try {
        let count = 0;
        const allUsers = await RegistrationModel.find({});

        for await (const user of allUsers) {
            count++;
            const { userAddress } = user;

            // Fetch old directStaking before updating
            const oldDirectStaking = user.directStaking || 0;

            // 1. Find direct referred users
            const directUsers = await RegistrationModel.find(
                { sponsorAddress: userAddress },
                { userAddress: 1 }
            ).lean();

            let totalDirectBusiness = new BigNumber(0);
            let amountNbdPayments = new BigNumber(0);
            let amountNodeUpgrades = new BigNumber(0);

            // 2. Sum all business from direct users
            for await (const directUser of directUsers) {
                const directUserAddress = directUser.userAddress;

                const nodeUpgrades = await UpgradedNodes.find(
                    { userAddress: directUserAddress },
                    { amountUsdPaid: 1 }
                ).lean();

                const nbdPayments = await NbdFundModel.find(
                    { userAddress: directUserAddress },
                    { amountNbdPaid: 1 }
                ).lean();

                // Add UpgradedNode amounts

                for (const n of nodeUpgrades) {
                    // if (n.amountUsdPaid) {
                    //     totalDirectBusiness = totalDirectBusiness.plus(
                    //         new BigNumber(n.amountUsdPaid).dividedBy(1e18)
                    //     );
                    //     amountNodeUpgrades = amountNodeUpgrades.plus(
                    //         new BigNumber(n.amountUsdPaid).dividedBy(1e18)
                    //     );
                    // }
                    if (n.amountUsdPaid) {
                        totalDirectBusiness = totalDirectBusiness.plus(
                            new BigNumber(n.amountUsdPaid)
                        );
                        amountNodeUpgrades = amountNodeUpgrades.plus(
                            new BigNumber(n.amountUsdPaid)
                        );
                    }
                }



                // Add NBD amounts
                for (const n of nbdPayments) {
                    // if (n.amountNbdPaid) {
                    //     totalDirectBusiness = totalDirectBusiness.plus(
                    //         new BigNumber(n.amountNbdPaid).dividedBy(1e18)
                    //     );
                    //     amountNbdPayments = amountNbdPayments.plus(
                    //         new BigNumber(n.amountNbdPaid).dividedBy(1e18)
                    //     );
                    // }
                    if (n.amountNbdPaid) {
                        totalDirectBusiness = totalDirectBusiness.plus(
                            new BigNumber(n.amountNbdPaid)
                        );
                        amountNbdPayments = amountNbdPayments.plus(
                            new BigNumber(n.amountNbdPaid)
                        );
                    }
                }
                // totalDirectBusiness = totalDirectBusiness.dividedBy(1e18);
                // amountNbdPayments = amountNbdPayments.dividedBy(1e18);
                // amountNodeUpgrades = amountNodeUpgrades.dividedBy(1e18);
            }

            totalDirectBusiness = totalDirectBusiness.dividedBy(1e18);
            amountNbdPayments = amountNbdPayments.dividedBy(1e18);
            amountNodeUpgrades = amountNodeUpgrades.dividedBy(1e18);

            const newDirectStaking = Number(totalDirectBusiness.toFixed(2));
            const finalNbdPaid = amountNbdPayments.toNumber();
            const finalNodeUpgradePaid = amountNodeUpgrades.toNumber();
            ct({ count, uid: "jkr675", directCount: directUsers.length, fromNbd: finalNbdPaid, fromNode: finalNodeUpgradePaid, ownerUser: userAddress, oldDirectStaking, newDirectStaking, func: "updateDirectBusinessForAll" })

            // 4. Update user record
            await RegistrationModel.findOneAndUpdate(
                { userAddress },
                { $set: { directStaking: newDirectStaking } },
                { new: true }
            );
        }

        console.log("Direct business updated with logs!");

    } catch (error) {
        console.log("Error while updating direct business:", error);
    }
};
const updateSelfBusinessForAll = async () => {
    try {
        let count = 0;
        const allUsers = await RegistrationModel.find({});

        console.log(`Total users to update: ${allUsers.length}`);

        for (const user of allUsers) {
            count++;
            const userAddress = user.userAddress;

            // if (userAddress !== "0xdAD11D65d831e9F9Bd833081F362A4dafc02ca0c") {
            //     continue;
            // }

            try {
                // Fetch total NBD paid (in 1e18 as string)
                const nbdFunds = await NbdFundModel.find({ userAddress });

                let totalNbd = new BigNumber(0);
                for (const nbd of nbdFunds) {
                    totalNbd = totalNbd.plus(nbd.amountNbdPaid);
                }
                totalNbd = totalNbd.dividedBy(1e18);

                // Fetch node upgrade USD paid (string, normal USD but string)
                const upgradedNodes = await UpgradedNodes.find({ userAddress });

                console.log(`User ${userAddress} - Upgraded Nodes found: ${upgradedNodes.length}`);

                let totalUpgradeUsd = new BigNumber(0);
                let countingForNodeDoc=0;
                for (const upg of upgradedNodes) {
                    countingForNodeDoc++;
                    totalUpgradeUsd = totalUpgradeUsd.plus(upg.amountUsdPaid);
                }
                totalUpgradeUsd = totalUpgradeUsd.dividedBy(1e18);
                ct({countingForNodeDoc})

                // SUM OF BOTH BUSINESSES
                const finalSelfBusiness = totalNbd.plus(totalUpgradeUsd).toNumber();

                // Old value
                const oldValue = user.userTotalStakeInUsd;

                // console.log("------------------------------------------------------");
                // console.log("USER:", userAddress);
                // console.log("Old userTotalStakeInUsd:", oldValue);
                // console.log("Total NBD Paid:", totalNbd.toNumber());
                // console.log("Total USD Paid in Upgrades:", totalUpgradeUsd.toNumber());
                // console.log("New userTotalStakeInUsd:", finalSelfBusiness);
                // console.log("------------------------------------------------------");
                ct({ count, uid: "sbUddpt2024", userAddress, userOldTotalStakeInUsd: oldValue, userNewTotalStakeInUsd: finalSelfBusiness, totalNbd: totalNbd.toNumber(), totalUpgradeUsd: totalUpgradeUsd.toNumber(), func: "update self business for all" })

                // Update DB
                await RegistrationModel.updateOne(
                    { userAddress },
                    { $set: { userTotalStakeInUsd: finalSelfBusiness } }
                );
               

            } catch (err) {
                console.log(`Error processing user ${userAddress}:`, err);
            }
        }

        console.log("All users updated successfully!");

    } catch (error) {
        console.log("Error while updating self business:", error);
    }
};

const updateDirectPlusSelfForAllUser = async () => {
    try {
        let count = 0;
        const allUsers = await RegistrationModel.find({});

        console.log(`Total users to process: ${allUsers.length}`);

        for (const user of allUsers) {
            count++;
            const userAddress = user.userAddress;

            try {
                const directStaking = Number(user.directStaking) || 0;
                const selfStake = Number(user.userTotalStakeInUsd) || 0;

                // OLD VALUE
                const oldValue = Number(user.userDirectPlusSelfStakeInUsd) || 0;

                // NEW VALUE
                const newValue = directStaking + selfStake;



                ct({ count, uid: "dpsUddpt2024", userAddress, oldUserDirectPlusSelfStakeInUsd: oldValue, newUserDirectPlusSelfStakeInUsd: newValue, directStaking, selfStake, func: "update direct plus self" })
                // Update DB
                await RegistrationModel.updateOne(
                    { userAddress },
                    { $set: { userDirectPlusSelfStakeInUsd: newValue } }
                );

            } catch (err) {
                console.log(`Error processing user ${userAddress}:`, err);
            }
        }

        console.log("All users updated successfully! ✔");

    } catch (error) {
        console.log("Error while updating direct plus self business:", error);
    }
};

const updateRanksForAll = async () => {
    try {
        let count = 0;
        const allUsers = await RegistrationModel.find({});

        console.log("Total users to process:", allUsers.length);

        for (const user of allUsers) {

            count++;

            const userAddress = user.userAddress;
            const fUserAddress = giveCheckSummedAddress(userAddress);

            try {
                const userInfo = await RegistrationModel.findOne({ userAddress: fUserAddress });
                if (!userInfo) {
                    console.log("User not found:", fUserAddress);
                    continue;
                }

                // const directsNodeSums = await getDirectsNodeBalanceSum(fUserAddress);
                // let nodePurchasingBalance = new BigNumber(userInfo.nodePurchasingBalance).dividedBy(1e18);

                const userDirectPlusSelfStakeInUsdNormal = userInfo.userDirectPlusSelfStakeInUsd;

                const userTargetStakeForRankUpgradation =
                    new BigNumber(userDirectPlusSelfStakeInUsdNormal).toNumber();

                const matchedRank =
                    ranks.find(r =>
                        userTargetStakeForRankUpgradation >= r.lowerBound &&
                        userTargetStakeForRankUpgradation <= r.upperBound
                    ) || ranks[0];

                const currTimeInUnix = moment().unix();

                // Old rank details
                const oldRank = userInfo.currentRank;
                const oldRankGrade = ranks.find(r => r.rank === oldRank)?.grade || 1;

                // New possible rank
                const newRank = matchedRank.rank;
                const newRankGrade = matchedRank.grade;

                // 🔥 Log comparison
                // console.log("---------------------------------------------------------");
                // console.log("USER:", fUserAddress);
                // console.log("Old Rank:", oldRank, "| Grade:", oldRankGrade);
                // console.log("New Eligible Rank:", newRank, "| Grade:", newRankGrade);
                // console.log("Stake Considered:", userTargetStakeForRankUpgradation);
                // console.log("---------------------------------------------------------");

                ct({ count, uid: "rkUddpt2024", fUserAddress, oldRank, oldRankGrade, newRank, newRankGrade, userTargetStakeForRankUpgradation, func: "update ranks for all" })

                // Update if eligible
                // if (matchedRank && (newRank !== oldRank) && (newRankGrade > oldRankGrade)) {

                //     const updatedUser = await RegistrationModel.findOneAndUpdate(
                //         { userAddress: fUserAddress },
                //         { $set: { currentRank: newRank, rankAchievedAt: currTimeInUnix } },
                //         { new: true }
                //     );

                //     console.log("Rank updated successfully!");
                //     console.log("Updated Rank:", updatedUser.currentRank);
                // } else {
                //     console.log("Rank remains same. No update needed.");
                // }

            } catch (err) {
                console.log("Error processing user:", fUserAddress, err);
            }
        }

        console.log("Rank update completed for all users.");

    } catch (error) {
        console.log("Error while updating ranks for all users:", error);
    }
};

const fixSystemRankAndBusinesses = async () => {
    try {
        // await updateDirectBusinessForAll();
        // await updateSelfBusinessForAll();
        // await updateDirectPlusSelfForAllUser();
        await updateRanksForAll();


    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    giveUserTeam,
    updateLastRoiDistributedToPaidAssuranceFees,
    distributeGapIncome,
    fixGapIncome,
    fixSystemRankAndBusinesses
}