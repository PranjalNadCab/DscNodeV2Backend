const moment = require("moment");
const Admin = require("../models/AdminModel");
const { BigNumber } = require("bignumber.js");
const { ct, getTargetDaysFromCalendarMonth, givePaymentRatioForDeployedNode, calculateUserRoiAssurance } = require("./helper");
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

const giveRoiToNodeHolders = async () => {
    try {
        // 💡 Define current date and time (real or mock)
        let now = moment();

        // 🧪 In development: use a simulated date for testing
        if (process.env.NODE_ENV === "development") {
            // Change this to simulate different days/months for testing
            now = moment("2025-11-07", "YYYY-MM-DD"); // e.g., 4th Jan 2025
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

        
        
        const targetDays = getTargetDaysFromCalendarMonth(targetMonth);
        
        console.log("------>target month:::",targetMonth,targetDays);
        // Fetch documents for the selected month
        const paidFees = AssuranceFeeModel.find({
            calendarMonth: targetMonth,
        }).cursor();


        for await (const doc of paidFees) {
            const { userAddress, nodeNum, seqMonth, calendarMonth } = doc;

            let deploymentDoc = await NodeDeployedModel.findOne({ userAddress, nodeNum,isIncomeExpired:false });
            if (!deploymentDoc) {
                console.log(`No deployment doc found for user ${userAddress} and node ${nodeNum}, skipping...`);
                continue;
            }

            const { time, baseMinValue, lastRoiDistributed, conversionMonth, currGenratedRoi, baseMinAss } = deploymentDoc;
            const {status,finalBaseMinAss,isIncomeExpired,message} = await calculateUserRoiAssurance(time, baseMinAss);

            if(!status){
                console.log(`Skipping user ${userAddress} for node ${nodeNum}: ${message}`);
                continue;
            }
            const perDayMinAssurance = new BigNumber(finalBaseMinAss).dividedBy(targetDays);
            // const daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 86400); // 86400 seconds in a day
            if (process.env.NODE_ENV === "development") {
                //treat 2mins as 1 day
                daysPassed = Math.floor((moment().unix() - (lastRoiDistributed || time)) / 10);
                // ct({ uid: "paid fees", userAddress, baseMinAss: new BigNumber(baseMinAss).dividedBy(1e18).toNumber(), seqMonth, calendarMonth,currTime:moment().unix(), lastRoiDistributed, time, daysPassed });
            } else {
                daysPassed = Math.floor((now.unix() - (lastRoiDistributed || time)) / 86400);
                
            }
            
            if (daysPassed < 1) {
                console.log(`Skipping user ${userAddress} for node ${nodeNum} as ROI already distributed today.`);
                continue;
            }
            
            let totalRoi = perDayMinAssurance.multipliedBy(daysPassed);

            // -----checking user total assurance for this month----

            const totalAssuranceGotForUser = await RoiModel.aggregate([
                {
                    $match: {
                        userAddress: userAddress,
                        nodeNum: nodeNum,
                        time: {
                            $gte: moment(targetMonth, "MMMM YYYY").startOf("month").unix(),
                            $lte: moment(targetMonth, "MMMM YYYY").endOf("month").unix()
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDscAllocation: { $sum: { $toDouble: "$dscAllocation" } },
                        totalSwapAllocation: { $sum: { $toDouble: "$swapAllocation" } }
                    }
                }
            ]);

            const alreadyPaidRoi = totalAssuranceGotForUser.length > 0 ? new BigNumber(totalAssuranceGotForUser[0].totalDscAllocation || "0").plus(new BigNumber(totalAssuranceGotForUser[0].totalSwapAllocation || "0")) : new BigNumber(0);
            ct({ uid: "already paid roi check", userAddress, nodeNum, alreadyPaidRoi: alreadyPaidRoi.toFixed(0), totalRoi: totalRoi.toFixed(0) });

            if (alreadyPaidRoi.plus(totalRoi).isGreaterThanOrEqualTo(new BigNumber(finalBaseMinAss))) {
               
                totalRoi = new BigNumber(finalBaseMinAss).minus(alreadyPaidRoi);
            }

            if(totalRoi.isLessThanOrEqualTo(0)){
                console.log(`Total ROI calculated is zero or negative for user ${userAddress} node ${nodeNum}, skipping...`);
                continue;
            }

            // -------------------END-------------------------------

            const { ratio } = await givePaymentRatioForDeployedNode(userAddress, nodeNum);
            const { usdt, dsc } = ratio;

            const dscAllocation = totalRoi.multipliedBy(dsc).dividedBy(100);
            const swapAllocation = totalRoi.multipliedBy(usdt).dividedBy(100);

            const roiDoc = await RoiModel.create({
                userAddress,
                nodeNum,
                baseMinAss,
                baseMinValue,
                time: process.env.NODE_ENV === "development" ? moment().unix() : moment().startOf('day').unix(),
                dscAllocation: dscAllocation.toFixed(0),
                swapAllocation: swapAllocation.toFixed(0),
                roiGeneratedForNumDay: daysPassed
            });

            if (roiDoc) {

                ct({userAddress,nodeNum,baseMinAss,time:roiDoc.time,dscAllocation:roiDoc.dscAllocation,swapAllocation:roiDoc.swapAllocation,daysPassed});

                const userRegDoc = await RegistrationModel.findOne({ userAddress });

                if (!userRegDoc) {
                    console.log(`No registration doc found for user ${userAddress}, skipping...`);
                    continue;
                }

                userRegDoc.allTimeRoi = new BigNumber(userRegDoc.allTimeRoi || "0").plus(totalRoi).toFixed(0);
                userRegDoc.dscAllocation = new BigNumber(userRegDoc.dscAllocation || "0").plus(dscAllocation).toFixed(0);
                userRegDoc.swapAllocation = new BigNumber(userRegDoc.swapAllocation || "0").plus(swapAllocation).toFixed(0);
                await userRegDoc.save();

                deploymentDoc.currGenratedRoi = new BigNumber(currGenratedRoi || "0").plus(totalRoi).toFixed(0);
                deploymentDoc.lastRoiDistributed = process.env.NODE_ENV === "development" ? moment().unix() : moment().startOf('day').unix();
                deploymentDoc.isIncomeExpired = isIncomeExpired;
                await deploymentDoc.save();
            }

        }

        console.log("Fetched fee records:",);
    } catch (error) {
        console.error(error);
    }
};

module.exports = { updateNodeValueAssurance, giveRoiToNodeHolders };