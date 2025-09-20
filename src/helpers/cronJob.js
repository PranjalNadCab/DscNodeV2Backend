const moment = require("moment");
const Admin = require("../models/AdminModel");
const { BigNumber } = require("bignumber.js");

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

            if (adminSettings.lastUpdatedMonthForNodeValidators === currentMonth) {
                console.log(`Already updated for ${currentMonth} ✅`);
                return;
              }
            const currentNodeValueAssurance = adminSettings.nodeValidators || 0;



            adminSettings.nodeValidators = currentNodeValueAssurance.map((node) => {
                // Increase selfStaking by 3%
                const stakingBN = new BigNumber(node.selfStaking);
                const updatedSelfStaking = stakingBN.multipliedBy(1.03).toFixed(0); // keep as string (no decimals)

                // Decrease baseMinAss by 3%
                const updatedBaseMinAss = Number((node.baseMinAss * 0.97).toFixed(2));

                return {
                    ...node,
                    selfStaking: updatedSelfStaking,
                    baseMinAss: updatedBaseMinAss,
                    nodeNum: node.nodeNum + 1, // still increment nodeNum
                };
            });

            adminSettings.lastUpdatedMonthForNodeValidators = currentMonth;

            await adminSettings.save();

            console.log(`Current Node Value Assurance: ${currentNodeValueAssurance}`);

        }


        console.log("Cron job started: Updating node value assurance...", startingMonthIndex);
    } catch (error) {
        console.error("Error in cron job:", error);
    }
}

module.exports = { updateNodeValueAssurance };