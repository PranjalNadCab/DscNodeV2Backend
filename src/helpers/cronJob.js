const moment = require("moment");
const Admin = require("../models/AdminModel");
const { BigNumber } = require("bignumber.js");
const { ct } = require("./helper");

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

module.exports = { updateNodeValueAssurance };