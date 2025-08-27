const mongoose = require("mongoose");


const RegistrationSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
        unique: true
    },
    sponsorAddress: {
        type: String,
        required: true,
    },
    teamCount: {
        type: Number,
        default: 0
    },
    directCount: {
        type: Number,
        default: 0
    },
    directStaking: {
        type: Number,
        default: 0
    },
    userTotalStakeInUsd: {
        type: Number,
        default: 0
    },
    userDirectPlusSelfStakeInUsd: {
        type: Number,
        default: 0
    },
    currentRank: {
        type: String,
        default: null
    },
    rankAchievedAt: {
        type: Number,
        default: null
    },
    usdtIncomeWallet: {
        type: String,
        default: "0"
    },
    dscIncomeWallet: {
        type: String,
        default: "0"
    },
    totalIncomeDscReceived: {
        type: String,
        default: "0"
    },
    totalIncomeUsdtReceived: {
        type: String,
        default: "0"
    },
    time: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    achievedNodes:{
        type: [{
            nodeName: { type: String, required: true },
            achievedAt: { type: Number, required: true },
            reward: { type: Number, required: true }
        }],
        default: []
    },
    currentNodeName:{
        type:String,
        default: null
    }
}, { timestamps: true, collection: 'registration' });

RegistrationSchema.index({ userAddress: 1, sponsorAddress: 1 }, { unique: true });

const RegistrationModel = mongoose.model('registration', RegistrationSchema);

module.exports = RegistrationModel;