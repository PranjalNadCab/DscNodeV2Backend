const moment = require("moment");
const Admin = require("../models/AdminModel");
const { BigNumber } = require("bignumber.js");
const { ct, getTargetDaysFromCalendarMonth, givePaymentRatioForDeployedNode, calculateUserRoiAssurance, giveNumFrom1e18 } = require("./helper");
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
                console.log(`Already updated-x-x-x- for ${currentMonth} ✅`);
                return;
            }

            let monthsPassed = 1; // default if null
            if (lastUpdated) {
                const lastMoment = moment(lastUpdated, "YYYY-MM");
                monthsPassed = moment(currentMonth, "YYYY-MM").diff(lastMoment, "months");
            }

            if (monthsPassed <= 0) {
                console.log(`Already updated--- for ${currentMonth} ✅`);
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

            // await adminSettings.save();

            console.log("Updated node value assurance for all validators.");

        }


        console.log("Cron job started: Updating node value assurance...", startingMonthIndex);
    } catch (error) {
        console.error("Error in cron job:", error);
    }
}

// const giveRoiToNodeHolders = async () => {
//     try {
//         // 💡 Define current date and time (real or mock)
//         let now = moment();

//         // 🧪 In development: use a simulated date for testing
//         if (process.env.NODE_ENV === "development") {
//             // Change this to simulate different days/months for testing
//             now = moment("2025-11-07", "YYYY-MM-DD"); // e.g., 4th Jan 2025
//             console.log("🧪 Using simulated date:", now.format("DD MMMM YYYY"));
//         }

//         const currentDate = Number(now.format("DD"));
//         let targetMonth;

//         // ✅ If today's date is between 1 and 6 → use previous month
//         if (currentDate >= 1 && currentDate <= 6) {
//             targetMonth = now.subtract(1, "month").format("MMMM YYYY");
//         } else {
//             targetMonth = now.format("MMMM YYYY");
//         }



//         const targetDays = getTargetDaysFromCalendarMonth(targetMonth);

//         console.log("------>target month:::",targetMonth,targetDays);
//         // Fetch documents for the selected month
//         const paidFees = AssuranceFeeModel.find({
//             calendarMonth: targetMonth,
//         }).cursor();


//         for await (const doc of paidFees) {
//             const { userAddress, nodeNum, seqMonth, calendarMonth } = doc;
//             if(userAddress.toLowerCase() !== "0xE44865573754FcB121226A4f42d56668934996a3".toLowerCase()){
//                 continue;
//             }
//             ct({uid:"xxxxxx",userAddress})

//             // if(userAddress !== "0xE44865573754FcB121226A4f42d56668934996a3") continue;

//             let deploymentDoc = await NodeDeployedModel.findOne({ userAddress, nodeNum,isIncomeExpired:false });
//             if (!deploymentDoc) {
//                 console.log(`No deployment doc found for user ${userAddress} and node ${nodeNum}, skipping...`);
//                 continue;
//             }

//             const { time, baseMinValue, lastRoiDistributed, conversionMonth, currGenratedRoi, baseMinAss } = deploymentDoc;
//             const {status,finalBaseMinAss,isIncomeExpired,message} = await calculateUserRoiAssurance(time, baseMinAss);

//             if(!status){
//                 console.log(`Skipping user ${userAddress} for node ${nodeNum}: ${message}`);
//                 continue;
//             }
//             const perDayMinAssurance = new BigNumber(finalBaseMinAss).dividedBy(targetDays);
//             // ct({perDayMinAssurance:perDayMinAssurance.toFixed(),finalBaseMinAss,targetDays,nodeNum,lastRoiDistributed,time});
//             // const daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 86400); // 86400 seconds in a day
//             if (process.env.NODE_ENV === "development") {
//                 //treat 2mins as 1 day
//                 daysPassed = Math.floor((moment().unix() - (lastRoiDistributed || time)) / 10);
//                 // ct({ uid: "paid fees", userAddress, baseMinAss: new BigNumber(baseMinAss).dividedBy(1e18).toNumber(), seqMonth, calendarMonth,currTime:moment().unix(), lastRoiDistributed, time, daysPassed });
//             } else {
//                 //agar fees miss hoti hai toh problem ho jaegi
//                 daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 86400);

//             }

//             ct({uid:"sgdg",daysPassed,userAddress,nodeNum,lastRoiDistributed,time,NowUnix:now.unix()});
//             if (daysPassed < 1) {
//                 console.log(`Skipping user ${userAddress} for node ${nodeNum} as ROI already distributed today.`);
//                 continue;
//             }

//             let totalRoi = perDayMinAssurance.multipliedBy(daysPassed);

//             // -----checking user total assurance for this month----

//             const totalAssuranceGotForUser = await RoiModel.aggregate([
//                 {
//                     $match: {
//                         userAddress: userAddress,
//                         nodeNum: nodeNum,
//                         time: {
//                             $gte: moment(targetMonth, "MMMM YYYY").startOf("month").unix(),
//                             $lte: moment(targetMonth, "MMMM YYYY").endOf("month").unix()
//                         }
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: null,
//                         totalDscAllocation: { $sum: { $toDouble: "$dscAllocation" } },
//                         totalSwapAllocation: { $sum: { $toDouble: "$swapAllocation" } }
//                     }
//                 }
//             ]);

//             const alreadyPaidRoi = totalAssuranceGotForUser.length > 0 ? new BigNumber(totalAssuranceGotForUser[0].totalDscAllocation || "0").plus(new BigNumber(totalAssuranceGotForUser[0].totalSwapAllocation || "0")) : new BigNumber(0);
//             // ct({ uid: "already paid roi check", userAddress, nodeNum, alreadyPaidRoi: alreadyPaidRoi.toFixed(0), totalRoi: totalRoi.toFixed(0) });

//             if (alreadyPaidRoi.plus(totalRoi).isGreaterThanOrEqualTo(new BigNumber(finalBaseMinAss))) {

//                 totalRoi = new BigNumber(finalBaseMinAss).minus(alreadyPaidRoi);
//             }



//             if(totalRoi.isLessThanOrEqualTo(0)){
//                 console.log(`Total ROI calculated is zero or negative for user ${userAddress} node ${nodeNum}, skipping...`);
//                 continue;
//             }

//             // -------------------END-------------------------------

//             const { ratio } = await givePaymentRatioForDeployedNode(userAddress, nodeNum);
//             const { usdt, dsc } = ratio;

//             const dscAllocation = totalRoi.multipliedBy(dsc).dividedBy(100);
//             const swapAllocation = totalRoi.multipliedBy(usdt).dividedBy(100);

//             continue;
//             // return;
//             const roiDoc = await RoiModel.create({
//                 userAddress,
//                 nodeNum,
//                 baseMinAss,
//                 baseMinValue,
//                 time: process.env.NODE_ENV === "development" ? moment().unix() : moment().startOf('day').unix(),
//                 dscAllocation: dscAllocation.toFixed(0),
//                 swapAllocation: swapAllocation.toFixed(0),
//                 roiGeneratedForNumDay: daysPassed
//             });

//             if (roiDoc) {

//                 ct({userAddress,nodeNum,baseMinAss,time:roiDoc.time,dscAllocation:roiDoc.dscAllocation,swapAllocation:roiDoc.swapAllocation,daysPassed});

//                 const userRegDoc = await RegistrationModel.findOne({ userAddress });

//                 if (!userRegDoc) {
//                     console.log(`No registration doc found for user ${userAddress}, skipping...`);
//                     continue;
//                 }

//                 userRegDoc.allTimeRoi = new BigNumber(userRegDoc.allTimeRoi || "0").plus(totalRoi).toFixed(0);
//                 userRegDoc.dscAllocation = new BigNumber(userRegDoc.dscAllocation || "0").plus(dscAllocation).toFixed(0);
//                 userRegDoc.swapAllocation = new BigNumber(userRegDoc.swapAllocation || "0").plus(swapAllocation).toFixed(0);
//                 await userRegDoc.save();

//                 deploymentDoc.currGenratedRoi = new BigNumber(currGenratedRoi || "0").plus(totalRoi).toFixed(0);
//                 deploymentDoc.lastRoiDistributed = process.env.NODE_ENV === "development" ? moment().unix() : moment().startOf('day').unix();
//                 deploymentDoc.isIncomeExpired = isIncomeExpired;
//                 await deploymentDoc.save();
//             }

//         }

//         console.log("Fetched fee records:",);
//     } catch (error) {
//         console.error(error);
//     }
// };

// const giveRoiToNodeHoldersV1 = async () => {
//     try {
//         // Use a simulated date in dev, otherwise use current time
//         const simulatedDate = process.env.NODE_ENV === "development"
//             ? moment("2025-11-07", "YYYY-MM-DD")
//             : moment("2025-12-06", "YYYY-MM-DD");

//         // 'today' never gets mutated
//         const today = simulatedDate ? simulatedDate.clone() : moment();

//              // Extract day-of-month from original 'today'
//              const currentDate = Number(today.format("DD"));
//                   // Determine the target month moment (not mutating 'today')
//         const targetMonthMoment = (currentDate >= 1 && currentDate <= 6)
//             ? today.clone().subtract(1, "month")
//             : today.clone();
//         // let targetMonth;
//         const targetMonth = targetMonthMoment.format("MMMM YYYY");
//         const targetDays = getTargetDaysFromCalendarMonth(targetMonth);

//         // ✅ If today's date is between 1 and 6 → use previous month
//         // if (currentDate >= 1 && currentDate <= 6) {
//         //     targetMonth = now.subtract(1, "month").format("MMMM YYYY");
//         // } else {
//         //     targetMonth = now.format("MMMM YYYY");
//         // }



//         // const targetDays = getTargetDaysFromCalendarMonth(targetMonth);

//         console.log("------>target month:::", targetMonth, targetDays);
//           const referenceNow = simulatedDate
//             ? simulatedDate.clone().startOf("day") // dev: treat simulated date as start of day
//             : moment().startOf("day"); 
//         // Fetch documents for the selected month
//         const paidFees = AssuranceFeeModel.find({
//             calendarMonth: targetMonth,
//         }).cursor();


//         for await (const doc of paidFees) {
//             const { userAddress, nodeNum, seqMonth, calendarMonth } = doc;
//             if (userAddress.toLowerCase() !== "0xE44865573754FcB121226A4f42d56668934996a3".toLowerCase()) {
//                 continue;
//             }
//             ct({ uid: "xxxxxx", userAddress })

//             // if(userAddress !== "0xE44865573754FcB121226A4f42d56668934996a3") continue;

//             let deploymentDoc = await NodeDeployedModel.findOne({ userAddress, nodeNum, isIncomeExpired: false });
//             if (!deploymentDoc) {
//                 console.log(`No deployment doc found for user ${userAddress} and node ${nodeNum}, skipping...`);
//                 continue;
//             }

//             const { time, baseMinValue, lastRoiDistributed, conversionMonth, currGenratedRoi, baseMinAss } = deploymentDoc;
//             const { status, finalBaseMinAss, isIncomeExpired, message } = await calculateUserRoiAssurance(time, baseMinAss);

//             if (!status) {
//                 console.log(`Skipping user ${userAddress} for node ${nodeNum}: ${message}`);
//                 continue;
//             }
//             const perDayMinAssurance = new BigNumber(finalBaseMinAss).dividedBy(targetDays);
//             // ct({perDayMinAssurance:perDayMinAssurance.toFixed(),finalBaseMinAss,targetDays,nodeNum,lastRoiDistributed,time});
//             // const daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 86400); // 86400 seconds in a day
//             // if (process.env.NODE_ENV === "development") {
//             //     //treat 2mins as 1 day
//             //     daysPassed = Math.floor((moment().unix() - (lastRoiDistributed || time)) / 10);
//             //     // ct({ uid: "paid fees", userAddress, baseMinAss: new BigNumber(baseMinAss).dividedBy(1e18).toNumber(), seqMonth, calendarMonth,currTime:moment().unix(), lastRoiDistributed, time, daysPassed });
//             // } else {
//             //     //agar fees miss hoti hai toh problem ho jaegi
//             //     daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 86400);

//             // }
//             const lastTimestamp = lastRoiDistributed || time || referenceNow.unix();
//             const daysPassed = Math.floor((referenceNow.unix() - lastTimestamp) / 86400);

//             ct({ uid: "sgdg", daysPassed, userAddress, nodeNum, lastRoiDistributed, time });
//             if (daysPassed < 1) {
//                 console.log(`Skipping user ${userAddress} for node ${nodeNum} as ROI already distributed today.`);
//                 continue;
//             }

//             let totalRoi = perDayMinAssurance.multipliedBy(daysPassed);

//                  // check total already paid in target month
//             const periodStart = moment(targetMonthMoment).startOf("month").unix();
//             const periodEnd = moment(targetMonthMoment).endOf("month").unix();

//             // -----checking user total assurance for this month----

//             const totalAssuranceGotForUser = await RoiModel.aggregate([
//                 {
//                     $match: {
//                         userAddress: userAddress,
//                         nodeNum: nodeNum,
//                         // time: {
//                         //     $gte: moment(targetMonth, "MMMM YYYY").startOf("month").unix(),
//                         //     $lte: moment(targetMonth, "MMMM YYYY").endOf("month").unix()
//                         // }
//                         time: { $gte: periodStart, $lte: periodEnd },
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: null,
//                         totalDscAllocation: { $sum: { $toDouble: "$dscAllocation" } },
//                         totalSwapAllocation: { $sum: { $toDouble: "$swapAllocation" } }
//                     }
//                 }
//             ]);

//             const alreadyPaidRoi =
//             (totalAssuranceGotForUser.length > 0)
//                 ? new BigNumber(totalAssuranceGotForUser[0].totalDscAllocation || "0")
//                     .plus(new BigNumber(totalAssuranceGotForUser[0].totalSwapAllocation || "0"))
//                 : new BigNumber(0);

//                 ct({ uid: "already paid roi check",periodStart,periodEnd, userAddress, nodeNum, alreadyPaidRoi: alreadyPaidRoi.toFixed(0), totalRoi: totalRoi.toFixed(0) });
//             if (alreadyPaidRoi.plus(totalRoi).isGreaterThanOrEqualTo(new BigNumber(finalBaseMinAss))) {

//                 totalRoi = new BigNumber(finalBaseMinAss).minus(alreadyPaidRoi);
//             }



//             if (totalRoi.isLessThanOrEqualTo(0)) {
//                 console.log(`Total ROI calculated is zero or negative for user ${userAddress} node ${nodeNum}, skipping...`);
//                 continue;
//             }

//             // -------------------END-------------------------------

//             const { ratio } = await givePaymentRatioForDeployedNode(userAddress, nodeNum);
//             const { usdt, dsc } = ratio;

//             const dscAllocation = totalRoi.multipliedBy(dsc).dividedBy(100);
//             const swapAllocation = totalRoi.multipliedBy(usdt).dividedBy(100);

//             continue;
//             // return;
//             const roiDoc = await RoiModel.create({
//                 userAddress,
//                 nodeNum,
//                 baseMinAss,
//                 baseMinValue,
//                 time: process.env.NODE_ENV === "development" ? moment().unix() :referenceNow.unix(),
//                 dscAllocation: dscAllocation.toFixed(0),
//                 swapAllocation: swapAllocation.toFixed(0),
//                 roiGeneratedForNumDay: daysPassed
//             });

//             if (roiDoc) {

//                 ct({ userAddress, nodeNum, baseMinAss, time: roiDoc.time, dscAllocation: roiDoc.dscAllocation, swapAllocation: roiDoc.swapAllocation, daysPassed });

//                 const userRegDoc = await RegistrationModel.findOne({ userAddress });

//                 if (!userRegDoc) {
//                     console.log(`No registration doc found for user ${userAddress}, skipping...`);
//                     continue;
//                 }

//                 userRegDoc.allTimeRoi = new BigNumber(userRegDoc.allTimeRoi || "0").plus(totalRoi).toFixed(0);
//                 userRegDoc.dscAllocation = new BigNumber(userRegDoc.dscAllocation || "0").plus(dscAllocation).toFixed(0);
//                 userRegDoc.swapAllocation = new BigNumber(userRegDoc.swapAllocation || "0").plus(swapAllocation).toFixed(0);
//                 await userRegDoc.save();

//                 deploymentDoc.currGenratedRoi = new BigNumber(currGenratedRoi || "0").plus(totalRoi).toFixed(0);
//                 // deploymentDoc.lastRoiDistributed = process.env.NODE_ENV === "development" ? moment().unix() : referenceNow.unix();
//                 deploymentDoc.isIncomeExpired = isIncomeExpired;
//                 await deploymentDoc.save();
//             }

//         }

//         console.log("Fetched fee records:",);
//     } catch (error) {
//         console.error(error);
//     }
// };

const giveRoiToNodeHolders = async () => {
    try {

        //periodStart and periodEnd is wrong , that should be from 7th of previous month to 6th of current month or 7th of current month to 6th of next month, that should depend on todays date

        const simulatedDate = process.env.NODE_ENV === "development"
            ? moment("2025-11-07", "YYYY-MM-DD")
            : moment();

        const today = simulatedDate.clone().startOf("day");
        const currentDate = today.date();

        // 🔥 Fix: Use custom billing month
        let targetMonthMoment;
        let periodStartMoment;
        let periodEndMoment;

        if (currentDate < 7) {
            // Example: 2 Dec → 7 Nov to 6 Dec
            targetMonthMoment = today.clone().subtract(1, "month");
            periodStartMoment = today.clone().subtract(1, "month").date(7).startOf("day");
            periodEndMoment = today.clone().date(6).endOf("day");
        } else {
            // Example: 10 Dec → 7 Dec to 6 Jan
            targetMonthMoment = today.clone();
            periodStartMoment = today.clone().date(7).startOf("day");
            periodEndMoment = today.clone().add(1, "month").date(6).endOf("day");
        }

        const targetMonth = targetMonthMoment.format("MMMM YYYY");
        const periodStart = periodStartMoment.unix();
        const periodEnd = periodEndMoment.unix();

        const targetDays = periodEndMoment.diff(periodStartMoment, "days") + 1;

        ct({uid:"📌 ROI Month:", targetMonth, days: targetDays});
        ct({uid:"➡ Range:", periodStart:periodStartMoment.format(),periodEnd: periodEndMoment.format()});
        // return;
        const paidFees = AssuranceFeeModel.find({
            calendarMonth: targetMonth,
        }).cursor();

        for await (const doc of paidFees) {
            const { userAddress, nodeNum } = doc;
            // if(userAddress !== "0xE44865573754FcB121226A4f42d56668934996a3") {
            //     continue;
            // }

            let deploymentDoc = await NodeDeployedModel.findOne({
                userAddress,
                nodeNum,
                isIncomeExpired: false,
            });

            if (!deploymentDoc) continue;
            const { time, baseMinAss, lastRoiDistributed, currGenratedRoi } = deploymentDoc;

            const { status, finalBaseMinAss } = await calculateUserRoiAssurance(time, baseMinAss);
            if (!status) continue;

            // 👇 Per day ROI
            const perDayMinAssurance = new BigNumber(finalBaseMinAss).div(targetDays);

            const lastTimestamp = lastRoiDistributed || time;
            const daysPassed = Math.floor((today.unix() - lastTimestamp) / 86400);

            if (daysPassed < 1) continue;
            

            let totalRoi = perDayMinAssurance.multipliedBy(daysPassed);

            // 🔥 Prevent exceeding monthly limit
            const totalAssuranceGotForUser = await RoiModel.aggregate([
                {
                    $match: {
                        userAddress,
                        nodeNum,
                        time: { $gte: periodStart, $lte: periodEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalDscAllocation: { $sum: { $toDouble: "$dscAllocation" } },
                        totalSwapAllocation: { $sum: { $toDouble: "$swapAllocation" } },
                    },
                },
            ]);

            const alreadyPaidRoi = (totalAssuranceGotForUser.length > 0)
                ? new BigNumber(totalAssuranceGotForUser[0].totalDscAllocation || "0")
                .plus(totalAssuranceGotForUser[0].totalSwapAllocation || "0")
                : new BigNumber(0);
                ct({daysPassed,alreadyPaidRoi:alreadyPaidRoi.toFixed()})
                
            if (alreadyPaidRoi.plus(totalRoi).isGreaterThan(finalBaseMinAss)) {
                totalRoi = new BigNumber(finalBaseMinAss).minus(alreadyPaidRoi);
            }

            if (totalRoi.isLessThanOrEqualTo(0)) continue;

            const { ratio: { usdt, dsc } } = await givePaymentRatioForDeployedNode(userAddress, nodeNum);

            const dscAllocation = totalRoi.multipliedBy(dsc).div(100).toFixed(0);
            const swapAllocation = totalRoi.multipliedBy(usdt).div(100).toFixed(0);
            ct({uid:"dxhnfgr",alreadyPaidRoi:giveNumFrom1e18(alreadyPaidRoi.toFixed(2)),swapAllocation:giveNumFrom1e18(swapAllocation),dscAllocation:giveNumFrom1e18(dscAllocation),daysPassed,totalRoi:giveNumFrom1e18(totalRoi).toFixed()})
            const roiDoc = await RoiModel.create({
                userAddress,
                nodeNum,
                baseMinAss,
                time: today.unix(),
                dscAllocation,
                swapAllocation,
                roiGeneratedForNumDay: daysPassed,
            });

            const userRegDoc = await RegistrationModel.findOne({ userAddress });
            if (!userRegDoc) continue;

            // Update user database values
            userRegDoc.allTimeRoi = new BigNumber(userRegDoc.allTimeRoi || 0)
                .plus(totalRoi).toFixed(0);
            userRegDoc.dscAllocation = new BigNumber(userRegDoc.dscAllocation || 0)
                .plus(dscAllocation).toFixed(0);
            userRegDoc.swapAllocation = new BigNumber(userRegDoc.swapAllocation || 0)
                .plus(swapAllocation).toFixed(0);
            await userRegDoc.save();

            deploymentDoc.currGenratedRoi = new BigNumber(currGenratedRoi || 0)
                .plus(totalRoi).toFixed(0);
            deploymentDoc.lastRoiDistributed = today.unix();
            deploymentDoc.isIncomeExpired = alreadyPaidRoi.plus(totalRoi).isGreaterThanOrEqualTo(finalBaseMinAss);
            await deploymentDoc.save();
        }

        console.log("🎉 ROI distribution completed successfully");
    } catch (error) {
        console.error("ROI Error:", error);
    }
};

// const giveRoiToNodeHoldersNew = async () => {
//     try {
//         // Use a simulated date in dev, otherwise use current time
//         const simulatedDate = process.env.NODE_ENV === "development"
//             ? moment("2025-11-07", "YYYY-MM-DD")
//             : null;

//         // 'today' never gets mutated
//         const today = simulatedDate ? simulatedDate.clone() : moment();

//         // Extract day-of-month from original 'today'
//         const currentDate = Number(today.format("DD"));

//         // Determine the target month moment (not mutating 'today')
//         const targetMonthMoment = (currentDate >= 1 && currentDate <= 6)
//             ? today.clone().subtract(1, "month")
//             : today.clone();

//         const targetMonth = targetMonthMoment.format("MMMM YYYY");
//         const targetDays = getTargetDaysFromCalendarMonth(targetMonth);

//         console.log("------> target month:", targetMonth, targetDays);

//         // For day calculations, pick a consistent reference timestamp.
//         // If you want to treat "day" as calendar-day based, use startOf('day').
//         // If you want exact seconds difference, use now() unix.
//         const referenceNow = simulatedDate
//             ? simulatedDate.clone().startOf("day") // dev: treat simulated date as start of day
//             : moment().startOf("day"); // prod: start of current day

//         // If you prefer using exact current timestamp (not startOf day),
//         // use moment() instead of moment().startOf('day') above.

//         // Fetch documents for the selected month using cursor
//         const paidFeesCursor = AssuranceFeeModel.find({
//             calendarMonth: targetMonth,
//         }).cursor();

//         for await (const doc of paidFeesCursor) {
//             const { userAddress, nodeNum } = doc;

//             // example filter used in your code — remove or modify as needed
//             if (userAddress.toLowerCase() !== "0xe44865573754fcb121226a4f42d56668934996a3".toLowerCase()) {
//                 continue;
//             }

//             const deploymentDoc = await NodeDeployedModel.findOne({
//                 userAddress,
//                 nodeNum,
//                 isIncomeExpired: false,
//             });

//             if (!deploymentDoc) {
//                 console.log(`No deployment doc for ${userAddress} / ${nodeNum}`);
//                 continue;
//             }

//             const {
//                 time,
//                 baseMinValue,
//                 lastRoiDistributed,
//                 conversionMonth,
//                 currGenratedRoi,
//                 baseMinAss,
//             } = deploymentDoc;

//             const { status, finalBaseMinAss, isIncomeExpired, message } =
//                 await calculateUserRoiAssurance(time, baseMinAss);

//             if (!status) {
//                 console.log(`Skipping user ${userAddress} for node ${nodeNum}: ${message}`);
//                 continue;
//             }

//             const perDayMinAssurance = new BigNumber(finalBaseMinAss).dividedBy(targetDays);

//             // Compute daysPassed:
//             // lastRoiDistributed or deployment time is expected to be a unix timestamp (seconds)
//             const lastTimestamp = lastRoiDistributed || time || referenceNow.unix();

//             // If you used startOf('day') for referenceNow, then use startOf('day') semantics here
//             const daysPassed = Math.floor((referenceNow.unix() - lastTimestamp) / 86400);

//             console.log({ daysPassed, userAddress, nodeNum, lastTimestamp, refNow: referenceNow.unix() });

//             if (daysPassed < 1) {
//                 console.log(`Skipping ${userAddress} node ${nodeNum} — ROI already distributed today.`);
//                 continue;
//             }

//             let totalRoi = perDayMinAssurance.multipliedBy(daysPassed);

//             // check total already paid in target month
//             const periodStart = moment(targetMonthMoment).startOf("month").unix();
//             const periodEnd = moment(targetMonthMoment).endOf("month").unix();

//             const totalAssuranceGotForUser = await RoiModel.aggregate([
//                 {
//                     $match: {
//                         userAddress,
//                         nodeNum,
//                         time: { $gte: periodStart, $lte: periodEnd },
//                     },
//                 },
//                 {
//                     $group: {
//                         _id: null,
//                         totalDscAllocation: { $sum: { $toDouble: "$dscAllocation" } },
//                         totalSwapAllocation: { $sum: { $toDouble: "$swapAllocation" } },
//                     },
//                 },
//             ]);

//             const alreadyPaidRoi =
//                 (totalAssuranceGotForUser.length > 0)
//                     ? new BigNumber(totalAssuranceGotForUser[0].totalDscAllocation || "0")
//                         .plus(new BigNumber(totalAssuranceGotForUser[0].totalSwapAllocation || "0"))
//                     : new BigNumber(0);

//             if (alreadyPaidRoi.plus(totalRoi).isGreaterThanOrEqualTo(new BigNumber(finalBaseMinAss))) {
//                 totalRoi = new BigNumber(finalBaseMinAss).minus(alreadyPaidRoi);
//             }

//             if (totalRoi.isLessThanOrEqualTo(0)) {
//                 console.log(`Total ROI <= 0 for ${userAddress} node ${nodeNum}, skipping.`);
//                 continue;
//             }

//             // ratio logic...
//             const { ratio } = await givePaymentRatioForDeployedNode(userAddress, nodeNum);
//             const { usdt, dsc } = ratio;

//             const dscAllocation = totalRoi.multipliedBy(dsc).dividedBy(100);
//             const swapAllocation = totalRoi.multipliedBy(usdt).dividedBy(100);

//             ct({ daysPassed, dscAllocation: giveNumFrom1e18(dscAllocation.toFixed()), swapAllocation: giveNumFrom1e18(swapAllocation.toFixed()) });
//             // create RoiModel doc and update registration & deployment docs...
//             // ...
//         }

//         console.log("Done processing paid fees.");
//     } catch (error) {
//         console.error(error);
//     }
// };


module.exports = { updateNodeValueAssurance, giveRoiToNodeHolders };