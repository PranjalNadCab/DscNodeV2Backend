const moment = require('moment');

const ranks = [
    {
        rank: "Beginner",
        lowerBound: 100,
        upperBound: 6000,
        grade: 1
    },
    {
        rank: "Learner",
        lowerBound: 6100,
        upperBound: 18000,
        grade: 2
    },
    {
        rank: "Expert",
        lowerBound: 18100,
        upperBound: 36000,
        grade: 3
    },
    {
        rank: "Master",
        lowerBound: 36100,
        upperBound: 60000,
        grade: 4
    },
    {
        rank: "Mentor",
        lowerBound: 60001,
        upperBound: 99999999999,
        grade: 5
    },
];



const gapIncome = {
    Beginner: 0.06,
    Learner: 0.09,
    Expert: 0.12,
    Master: 0.15,
    Mentor: 0.18
}



// const ratioUsdDsc = () => {
//     const START_MONTH = process.env.START_MONTH || "2025-11"; // format YYYY-MM

//     // fixed 9 months
//     const MONTHS_COUNT = 9;

//     // base ratios (you can adjust increments however you want)
//     const baseUsd = 55;
//     const baseDsc = 45;
//     const increment = 5;

//     const startMoment = moment(START_MONTH, "YYYY-MM");

//     // Generate dynamic month ratio object
//     const usdDscRatio = {};

//     for (let i = 0; i < MONTHS_COUNT; i++) {
//         const monthName = startMoment.clone().add(i, "months").format("MMMM").toLowerCase();

//         usdDscRatio[monthName] = {
//             usd: baseUsd + i * increment,
//             dsc: baseDsc - i * increment
//         };
//     }

//     const monthKey = moment().format("MMMM").toLowerCase(); 
//     console.log("Current Month Key for USD/DSC Ratio:-----", usdDscRatio[monthKey]);
//     return usdDscRatio[monthKey] ? usdDscRatio[monthKey] : { usd: 55, dsc: 45 };
// }

const ratioUsdDsc = () => {
    const START_MONTH = process.env.START_MONTH || "2025-11"; // format YYYY-MM

    const MONTHS_COUNT = 9;
    
    const baseUsd = 55;
    const baseDsc = 45;
    const increment = 5;

    const today = moment();
    let cycleMonth = today.clone();

    // If date is 1 to 6 → treat it as previous month
    if (today.date() <= 6) {
        cycleMonth = today.clone().subtract(1, "month");
    }

    const startMoment = moment(START_MONTH, "YYYY-MM").date(6); // start cycle from 6th
    const usdDscRatio = {};

    for (let i = 0; i < MONTHS_COUNT; i++) {
        const monthKey = startMoment.clone().add(i, "month").format("MMMM").toLowerCase();

        usdDscRatio[monthKey] = {
            usd: baseUsd + i * increment,
            dsc: baseDsc - i * increment
        };
    }

    const currentMonthKey = cycleMonth.format("MMMM").toLowerCase();
    console.log("Current Cycle Month Key:", currentMonthKey, usdDscRatio[currentMonthKey]);

    // return usdDscRatio[currentMonthKey] || { usd: 55, dsc: 45 };
    return  { usd: 55, dsc: 45 };

};

const zeroAddressTxhash = "0x0000000000000000000000000000000000000000000000000000000000000000";

const nbdAmounts=[
    300,600,900,1200,1800,2400,3600,4800,6000
];

const nodeGroups =[
    {
        groupName:"Alpha I",
        month:"August 2025"
    },
    {
        groupName:"Alpha II",
        month:"September 2025"
    },
    {
        groupName:"Octa I",
        month:"October 2025"
    },
    {
        groupName:"Nova I",
        month:"November 2025"
    },
    {
        groupName:"Decenta I",
        month:"December 2025"
    },
    {
        groupName:"Janus I",
        month:"January 2026"
    },
    {
        groupName:"Fabrus I",
        month:"February 2026"
    },
    {
        groupName:"Marche I",
        month:"March 2026"
    },
    {
        groupName:"Aprila I",
        month:"April 2026"
    },
    {
        groupName:"Maya I",
        month:"May 2026"
    },
    {
        groupName:"Junio I",
        month:"June 2026"
    },
    {
        groupName:"Juliet I",
        month:"July 2026"
    },
    {
        groupName:"Augustus I",
        month:"August 2026"
    },
    {
        groupName:"Septima I",
        month:"September 2026"
    },
    {
        groupName:"Octa II",
        month:"October 2026"
    },
    {
        groupName:"Nova II",
        month:"November 2026"
    },
    {
        groupName:"Decenta II",
        month:"December 2026"
    },
    {
        groupName:"Janus II",
        month:"January 2027"
    },
    {
        groupName:"Fabrus II",
        month:"February 2027"
    },
    {
        groupName:"Marche II",
        month:"March 2027"
    },
    {
        groupName:"Aprila II",
        month:"April 2027"
    },
    {
        groupName:"Maya II",
        month:"May 2027"
    },
    {
        groupName:"Junio II",
        month:"June 2027"
    },
    {
        groupName:"Juliet II",
        month:"July 2027"
    },
    {
        groupName:"Augustus II",
        month:"August 2027"
    },
    {
        groupName:"Septima II",
        month:"September 2027"
    },
    {
        groupName:"Octa III",
        month:"October 2027"
    },
    {
        groupName:"Nova III",
        month:"November 2027"
    },
    {
        groupName:"Decenta III",
        month:"December 2027"
    },
    {
        groupName:"Janus III",
        month:"January 2028"
    },
    {
        groupName:"Fabrus III",
        month:"February 2028"
    },
    {
        groupName:"Marche III",
        month:"March 2028"
    },
    {
        groupName:"Aprila III",
        month:"April 2028"
    },
    {
        groupName:"Maya III",
        month:"May 2028"
    },
    {
        groupName:"Junio III",
        month:"June 2028"
    },
    {
        groupName:"Juliet III",
        month:"July 2028"
    },
    {
        groupName:"Augustus III",
        month:"August 2028"
    },
    {
        groupName:"Septima III",
        month:"September 2028"
    },
];

module.exports = {
    ranks,
    gapIncome,
    ratioUsdDsc,
    zeroAddressTxhash,
    nbdAmounts,
    nodeGroups
  
};