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



const ratioUsdDsc = () => {
    const START_MONTH = process.env.START_MONTH || "2025-09"; // format YYYY-MM

    // fixed 9 months
    const MONTHS_COUNT = 9;

    // base ratios (you can adjust increments however you want)
    const baseUsd = 55;
    const baseDsc = 45;
    const increment = 5;

    const startMoment = moment(START_MONTH, "YYYY-MM");

    // Generate dynamic month ratio object
    const usdDscRatio = {};

    for (let i = 0; i < MONTHS_COUNT; i++) {
        const monthName = startMoment.clone().add(i, "months").format("MMMM").toLowerCase();

        usdDscRatio[monthName] = {
            usd: baseUsd + i * increment,
            dsc: baseDsc - i * increment
        };
    }

    const monthKey = moment().format("MMMM").toLowerCase(); 
    console.log(usdDscRatio[monthKey] )
    return usdDscRatio[monthKey] || null;
}

const zeroAddressTxhash = "0x0000000000000000000000000000000000000000000000000000000000000000";

const nbdAmounts=[
    300,600,900,1200,1800,2400,3600,4800,6000
]

module.exports = {
    ranks,
    gapIncome,
    ratioUsdDsc,
    zeroAddressTxhash,
    nbdAmounts

};