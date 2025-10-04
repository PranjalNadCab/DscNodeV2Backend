const mongoose = require("mongoose");


const RegistrationSchema = new mongoose.Schema({
    uniqueRandomId:{
        type: String,
        required: true,
        unique: true
    },
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
    nodePurchasingBalance:{   //this is registration balance
        type:String, 
        default:"0"
    },
    isNodeRegDone:{
        type: Boolean,
        default: false
    },
    myNode:{
        type:{
            nodeName:{type:String},
            deployedAt:{type:Number},
            nodeNum:{type:Number}
        },
        default:null
    },
    roiWithdrawWallet:{
        type:String,
        default:"0"
    },
    allTimeRoi:{
        type:String,
        default:"0"
    },
    block:{
        type:Number,
        default:null
    },
    transactionHash:{
        type:String,
        default:null
    }
   
}, { timestamps: true, collection: 'registration' });

RegistrationSchema.index({ userAddress: 1, sponsorAddress: 1 }, { unique: true });

const RegistrationModel = mongoose.model('registration', RegistrationSchema);

module.exports = RegistrationModel;