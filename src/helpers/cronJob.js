const moment = require("moment");
const Admin = require("../models/AdminModel");
const { BigNumber } = require("bignumber.js");
const { ct, getTargetDaysFromCalendarMonth, givePaymentRatioForDeployedNode } = require("./helper");
const { default: mongoose } = require("mongoose");
// const NodeConverted = require("../models/NodeConvertedModel");
const RoiModel = require("../models/RoiModel");
const RegistrationModel = require("../models/RegistrationModel");
const NodeDeployedModel = require("../models/NodeDeployedModel");
const AssuranceFeeModel = require("../models/AssuranceFeeModel");

const updateNodeValueAssurance = async () => {
    try {
        const currentMonthNumber = moment().month();
        const currentYear = moment().year();
        const startingMonthName = process.env.STARTING_MONTH || "October";
        const startingYear = 2025;

        let startingMonthIndex = moment().month(startingMonthName).month();
        if (startingMonthIndex === currentMonthNumber && startingYear === currentYear) {
            console.log(`No update needed for ${startingMonthName} ${startingYear} ✅`);
        } else {

            const currentMonth = moment().format("YYYY-MM");
            const adminSettings = await Admin.findOne({});
            if (!adminSettings) {
                console.error("Admin settings not found.");
                return;
            }
            const lastUpdated = adminSettings.lastUpdatedMonthForNodeValidators;
            ct({ lastUpdatedMonth: lastUpdated, currentMonth: currentMonth });
            if (adminSettings.lastUpdatedMonthForNodeValidators === currentMonth) {
                console.log(`Already updated for ${currentMonth} ✅`);
                return;
            }

            let monthsPassed = 1; // default if null
            if (lastUpdated) {
                const lastMoment = moment(lastUpdated, "YYYY-MM");
                monthsPassed = moment(currentMonth, "YYYY-MM").diff(lastMoment, "months");
            }

            if (monthsPassed <= 0) {
                console.log(`Already updated for ${currentMonth} ✅`);
                return;
            }
            const currentNodeValueAssurance = adminSettings.nodeValidators || 0;



            adminSettings.nodeValidators = currentNodeValueAssurance.map((node) => {
                // Increase selfStaking by 3%
                // const stakingBN = new BigNumber(node.selfStaking);
                // const updatedSelfStaking = stakingBN.multipliedBy(1.03).toFixed(0); // keep as string (no decimals)

                // // Decrease baseMinAss by 3%
                // const updatedBaseMinAss = new BigNumber(node.baseMinAss).multipliedBy(0.97).toFixed(0); // keep as string (no decimals)

                const stakingBN = new BigNumber(node.selfStaking);
                const updatedSelfStaking = stakingBN.multipliedBy(new BigNumber(1.03).pow(monthsPassed)).toFixed(0);

                // Decrease baseMinAss by 3% compounded
                const baseMinAssBN = new BigNumber(node.baseMinAss);
                const updatedBaseMinAss = baseMinAssBN.multipliedBy(new BigNumber(0.97).pow(monthsPassed)).toFixed(0);

                return {
                    ...node,
                    selfStaking: updatedSelfStaking,
                    baseMinAss: updatedBaseMinAss,
                    nodeNum: node.nodeNum, // still increment nodeNum
                };
            });

            adminSettings.lastUpdatedMonthForNodeValidators = currentMonth;

            await adminSettings.save();

            console.log("Updated node value assurance for all validators.");

        }


        console.log("Cron job started: Updating node value assurance...", startingMonthIndex);
    } catch (error) {
        console.error("Error in cron job:", error);
    }
}

// const giveRoiToNodeHolders = async () => {
//     let session;
//     try {
//         // Start a session
//         session = await mongoose.startSession();
//         session.startTransaction();

//         // Use cursor with session
//         const cursor = NodeDeployedModel.find({}).cursor({ session });
//         const currTime = moment().unix();

//         for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
//             const { nodeNum, userAddress, baseMinValue, currGenratedRoi, baseMinAss, conversionMonth, time, lastRoiDistributed } = doc;

//             let daysPassed = 0;
//             if (process.env.NODE_ENV === "development") {
//                 //treat 2mins as 1 day

//                 daysPassed = Math.floor((currTime - (lastRoiDistributed || time)) / 120);

//             } else {

//                 daysPassed = Math.floor((currTime - (lastRoiDistributed || time)) / 86400); // 86400 seconds in a day

//             }
//             if (daysPassed < 1) {
//                 console.log(`Skipping user ${userAddress} for node ${nodeNum} as ROI already distributed today.`);
//                 continue;
//             }


//             const x = new BigNumber(baseMinAss || "0"); // baseMinAss as BigNumber

//             // Convert `time` (seconds) → moment object
//             const start = moment.unix(time);
//             const now = moment();

//             // Days since node conversion
//             const diffInDays = now.diff(start, "days");

//             // 30 days = 1 month (fixed)
//             const monthIndex = Math.floor(diffInDays / 30) + 1; // 1-based

//             // Monthly ROI based on slab
//             let monthlyROI = new BigNumber(0);

//             if (monthIndex >= 1 && monthIndex <= 6) {
//                 monthlyROI = x;
//             } else if (monthIndex >= 7 && monthIndex <= 12) {
//                 monthlyROI = x.div(2);
//             } else if (monthIndex >= 13 && monthIndex <= 18) {
//                 monthlyROI = x.div(4);
//             } else {
//                 monthlyROI = new BigNumber(0);
//             }

//             // Daily ROI = monthly / 30
//             const dailyROI = monthlyROI.div(30).multipliedBy(daysPassed); // still in 1e18 precision



//             await RoiModel.create({
//                 userAddress,
//                 nodeNum,
//                 baseMinAss,
//                 roiDscAssurance: dailyROI.toFixed(0), // still in 1e18 precision
//                 time: moment().unix(),
//                 roiGeneratedForNumDay: daysPassed
//             });

//             const totalRoiTillNow = new BigNumber(currGenratedRoi || "0").plus(dailyROI);

//             const updationTimeForRoiDistributed = process.env.NODE_ENV === "development" ? moment().unix() : moment().startOf('day').unix();
//             // If you need to save/update currGenratedRoi back to Mongo:
//             await NodeConverted.updateOne(
//                 { _id: doc._id },
//                 { $set: { currGenratedRoi: totalRoiTillNow.toFixed(0), lastRoiDistributed: updationTimeForRoiDistributed } },
//                 { session }
//             );


//             // Fetch current values of allTimeRoi and roiWithdrawWallet
//             const regDoc = await RegistrationModel.findOne({ userAddress }).session(session);

//             if (!regDoc) {
//                 throw new Error(`Registration doc not found for userAddress: ${userAddress}`);
//             }

//             const currentAllTimeRoi = new BigNumber(regDoc.allTimeRoi || "0");
//             const currentRoiWithdrawWallet = new BigNumber(regDoc.roiWithdrawWallet || "0");

//             // Add dailyROI to both
//             const updatedAllTimeRoi = currentAllTimeRoi.plus(dailyROI);
//             const updatedRoiWithdrawWallet = currentRoiWithdrawWallet.plus(dailyROI);

//             // Update back in DB
//             await RegistrationModel.updateOne(
//                 { userAddress },
//                 {
//                     $set: {
//                         allTimeRoi: updatedAllTimeRoi.toFixed(0),
//                         roiWithdrawWallet: updatedRoiWithdrawWallet.toFixed(0)
//                     }
//                 },
//                 { session }
//             );
//         }

//         // Commit transaction
//         await session.commitTransaction();
//         console.log("Transaction committed ✅");
//     } catch (error) {
//         if (session) await session.abortTransaction();
//         console.error("Error in giveRoiToNodeHolders:", error);
//     } finally {
//         if (session) session.endSession();
//     }
// };

const giveRoiToNodeHolders = async () => {
    try {
        // 💡 Define current date and time (real or mock)
        let now = moment();

        // 🧪 In development: use a simulated date for testing
        if (process.env.NODE_ENV === "development") {
            // Change this to simulate different days/months for testing
            now = moment("2025-12-07", "YYYY-MM-DD"); // e.g., 4th Jan 2025
            console.log("🧪 Using simulated date:", now.format("DD MMMM YYYY"));
        }

        const currentDate = Number(now.format("DD"));
        let targetMonth;

        // ✅ If today's date is between 1 and 6 → use previous month
        if (currentDate >= 1 && currentDate <= 6) {
            targetMonth = now.subtract(1, "month").format("MMMM YYYY");
        } else {
            targetMonth = now.format("MMMM YYYY");
        }

        ct({
            targetMonth,
            currentDate,
        });

        const targetDays = getTargetDaysFromCalendarMonth(targetMonth);

        // Fetch documents for the selected month
        const paidFees = AssuranceFeeModel.find({
            calendarMonth: targetMonth,
        }).cursor();


        for await (const doc of paidFees) {
            const { userAddress, nodeNum, seqMonth, calendarMonth } = doc;
            
            let deploymentDoc = await NodeDeployedModel.findOne({ userAddress, nodeNum });
            if(!deploymentDoc){
                console.log(`No deployment doc found for user ${userAddress} and node ${nodeNum}, skipping...`);
                continue;
            }
            
            const {time,baseMinValue,lastRoiDistributed,conversionMonth,currGenratedRoi,baseMinAss} = deploymentDoc;
            ct({ uid:"paid fees",userAddress, baseMinAss:new BigNumber(baseMinAss).dividedBy(1e18).toNumber(), seqMonth, calendarMonth });
            const perDayMinAssurance = new BigNumber(baseMinAss).dividedBy(targetDays);
            // const daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 86400); // 86400 seconds in a day
            if(process.env.NODE_ENV==="development"){
                //treat 2mins as 1 day
                daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 120);
            }else{
                daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 86400);

            }

            if (daysPassed < 1) {
                console.log(`Skipping user ${userAddress} for node ${nodeNum} as ROI already distributed today.`);
                continue;
            }

            const totalRoi = perDayMinAssurance.multipliedBy(daysPassed);

            const {ratio} = await givePaymentRatioForDeployedNode(userAddress,nodeNum);
            const {usdt,dsc} = ratio;

            const dscAllocation = totalRoi.multipliedBy(dsc).dividedBy(100);
            const swapAllocation = totalRoi.multipliedBy(usdt).dividedBy(100);

            await RoiModel.create({
                userAddress,
                nodeNum,
                baseMinAss,
                time: now.unix(),
                dscAllocation: dscAllocation.toFixed(0),
                swapAllocation: swapAllocation.toFixed(0),
                roiGeneratedForNumDay: daysPassed
            });

            const userRegDoc = await RegistrationModel.findOne({ userAddress });

            if(!userRegDoc){
                console.log(`No registration doc found for user ${userAddress}, skipping...`);
                continue;
            }

            userRegDoc.allTimeRoi = new BigNumber(userRegDoc.allTimeRoi || "0").plus(totalRoi).toFixed(0);
            updatedUser.dscAllocation = new BigNumber(userRegDoc.dscAllocation || "0").plus(dscAllocation).toFixed(0);
            updatedUser.swapAllocation = new BigNumber(userRegDoc.swapAllocation || "0").plus(swapAllocation).toFixed(0);
            await userRegDoc.save();

            deploymentDoc.currGenratedRoi = new BigNumber(currGenratedRoi || "0").plus(totalRoi).toFixed(0);
            deploymentDoc.lastRoiDistributed = now.startOf('day').unix();
            await deploymentDoc.save();

        }

        console.log("Fetched fee records:",);
    } catch (error) {
        console.error(error);
    }
};

module.exports = { updateNodeValueAssurance, giveRoiToNodeHolders };