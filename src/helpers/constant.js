const ranks = [
    {
        rank:"Beginner",
        lowerBound: 100,
        upperBound: 6000,
        grade:1
    },
    {
        rank:"Learner",
        lowerBound: 6100,
        upperBound: 18000,
        grade:2
    },
    {
        rank:"Expert",
        lowerBound: 18100,
        upperBound: 36000,
        grade:3
    },
    {
        rank:"Master",
        lowerBound: 36100,
        upperBound: 60000,
        grade:4
    },
    {
        rank:"Mentor",
        lowerBound: 60001,
        upperBound: 99999999999,
        grade:5
    },
];



const gapIncome = {
    Beginner: 0.06,
    Learner: 0.09,
    Expert: 0.12,
    Master: 0.15,
    Mentor: 0.18
}

;
const usdDscRatio = {
    october:{
        usd:55,
        dsc:45
    },
    november:{
        usd:60,
        dsc:40
    },
    december:{
        usd:65,
        dsc:35
    },
    january:{
        usd:70,
        dsc:30
    },
    february:{
        usd:75,
        dsc:25
    },
    march:{
        usd:80,
        dsc:20
    },
    april:{
        usd:85,
        dsc:15
    },
    may:{
        usd:90,
        dsc:10
    },
    june:{
        usd:95,
        dsc:5
    },
}



module.exports = {
    ranks,
    gapIncome,
    usdDscRatio
   
};