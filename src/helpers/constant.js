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
]

module.exports = {
    ranks,
   
};