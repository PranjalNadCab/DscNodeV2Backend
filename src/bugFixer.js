const { ct, giveGapIncome, giveNumFrom1e18 } = require("./helpers/helper");
const AssuranceFeeModel = require("./models/AssuranceFeeModel");
const NodeDeployedModel = require("./models/NodeDeployedModel");
const RegistrationModel = require("./models/RegistrationModel");
const moment = require("moment");
const UpgradedNodes = require("./models/UpgradeNodeModel");
const { BigNumber } = require("bignumber.js");
const GapIncomeModel = require("./models/GapIncomeModel");


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
            "paidBy.userType": { $ne: "self" }, userAddress: {
                $nin: [
                    "0x2E7D16145771e74463a9Cac152dF311372166C82",
                    "0x1a7fb9856a0da56c780304990BA99cf2EFb7CceE"
                ]
            }
        });

        console.log(`sponsored transactions found: ${sponsoredTxs.length}`);

        let count = 0;

        for (const tx of sponsoredTxs) {
            // ct({userAddress:tx.paidBy.userAddress,txHash:tx.transactionHash,amountUsdPaid:tx.amountUsdPaid,time:tx.time});
            count++;
            const { userAddress, nodeNum, totalAmountInUsd, amountUsdPaid, time, isPaymentCompleted, rateDollarPerDsc, transactionHash, paidBy, currency } = tx;

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

            ct({ count, userAddress, netAmountPaidInUsd, rankDuringStaking, amountUsdtPaid: "0", dscInUsdPaid: dscInUsdPaid.toFixed(0), type: "node", rateDollarPerDscInNum, nodeNum: Number(nodeNum) })
            // if(count === 1){
            // await giveGapIncome(userAddress, netAmountPaidInUsd, rankDuringStaking, "0", dscInUsdPaid.toFixed(0), "node", rateDollarPerDscInNum, Number(nodeNum));
            // }else{
            //    continue;
            // }
        }


    } catch (error) {
        console.log(error);
    }
}

// const fixGapIncome = async () => {
//     try {
//         const start = Math.floor(new Date("2025-11-17T00:00:00Z").getTime() / 1000);
//         const end = Math.floor(new Date("2025-11-17T23:59:59Z").getTime() / 1000);



//         const aggregated = await GapIncomeModel.aggregate([
//             {
//                 $match: {
//                     time: { $gte: start, $lte: end }
//                 }
//             },
//             {
//                 $group: {
//                     _id: "$receiverAddress",

//                     totalGapIncomeInUsd_1e18: {
//                         $sum: { $toDecimal: "$gapIncomeInUsd" }
//                     },

//                     totalGapIncomeInDscInUsd_1e18: {
//                         $sum: { $toDecimal: "$gapIncomeInDscInUsd" }
//                     },

//                     count: { $sum: 1 }
//                 }
//             },
//             {
//                 // Convert Decimal128 back to string
//                 $project: {
//                     receiverAddress: "$_id",
//                     _id: 0,
//                     totalGapIncomeInUsd_1e18: { $toString: "$totalGapIncomeInUsd_1e18" },
//                     totalGapIncomeInDscInUsd_1e18: { $toString: "$totalGapIncomeInDscInUsd_1e18" },
//                     count: 1
//                 }
//             }
//         ]);

//         let userCount=0;

//         for (const doc of aggregated){
//             userCount++;
//             const { receiverAddress, totalGapIncomeInUsd_1e18, totalGapIncomeInDscInUsd_1e18, count } = doc;


            
//             const userRegDoc = await RegistrationModel.findOne({userAddress:receiverAddress});
//             const {usdtIncomeWallet,totalIncomeUsdtReceived,dscIncomeInUsdWallet,totalIncomeDscInUsdReceived} = userRegDoc;
            
//             ct({userCount, receiverAddress, totalGapIncomeInUsd_1e18:giveNumFrom1e18(totalGapIncomeInUsd_1e18), totalGapIncomeInDscInUsd_1e18:giveNumFrom1e18(totalGapIncomeInDscInUsd_1e18), count,usdtIncomeWallet:giveNumFrom1e18(usdtIncomeWallet),totalIncomeUsdtReceived:giveNumFrom1e18(totalIncomeUsdtReceived),dscIncomeInUsdWallet:giveNumFrom1e18(dscIncomeInUsdWallet),totalIncomeDscInUsdReceived:giveNumFrom1e18(totalIncomeDscInUsdReceived) });
//             // userRegDoc.usdtIncomeWallet = new BigNumber(usdtIncomeWallet).minus(totalGapIncomeInUsd_1e18).toFixed(0);
//             // userRegDoc.totalIncomeUsdtReceived = new BigNumber(totalIncomeUsdtReceived).minus(totalGapIncomeInUsd_1e18).toFixed(0);
//             userRegDoc.dscIncomeInUsdWallet = new BigNumber(dscIncomeInUsdWallet).minus(totalGapIncomeInDscInUsd_1e18).toFixed(0);
//             userRegDoc.totalIncomeDscInUsdReceived = new BigNumber(totalIncomeDscInUsdReceived).minus(totalGapIncomeInDscInUsd_1e18).toFixed(0);

//             console.log({
//                 dscIncomeInUsdWallet,
//                 totalIncomeDscInUsdReceived,
//                 totalGapIncomeInDscInUsd_1e18
//             })


//             await userRegDoc.save();


//         }


//     } catch (error) {
//         console.log(error);
//     }
// }



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

            if(receiverAddress === "0x5eD156B40f3dB1b98Ae340dDa12B2B624d81ae68"){
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

module.exports = {
    giveUserTeam,
    updateLastRoiDistributedToPaidAssuranceFees,
    distributeGapIncome,
    fixGapIncome
}