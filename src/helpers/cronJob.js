const moment = require("moment");
const Admin = require("../models/AdminModel");

const updateNodeValueAssurance = async()=>{
    try{
        const currentMonthNumber = moment().month();
        const currentYear = moment().year(); 
        const startingMonthName = "October";
        const startingYear = 2025;

        let startingMonthIndex =  moment().month(startingMonthName).month();
        if (startingMonthIndex === currentMonthNumber && startingYear === currentYear) {
            console.log(`No update needed for ${startingMonthName} ${startingYear} ✅`);
        } else {
            const adminSettings = await Admin.findOne({});
            if (!adminSettings) {
                console.error("Admin settings not found.");
                return;
            }
            const currentNodeValueAssurance = adminSettings.nodeValidators || 0;

        }
 

        console.log("Cron job started: Updating node value assurance...", startingMonthIndex);
    }catch(error){
        console.error("Error in cron job:", error);
    }
}

module.exports = {updateNodeValueAssurance};