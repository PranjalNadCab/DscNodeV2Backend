const mongoose  =require("mongoose");


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
    teamCount:{
        type:Number,
        default:0
    },
    directCount:{
        type:Number,
        default:0
    },
    directStaking:{
        type: Number,
        default:0
    },
    userTotalStakeInUsd:{
        type: Number,
        default:0
    },
    userDirectPlusSelfStakeInUsd:{
        type: Number,
        default:0
    },
    currentRank:{
        type: String,
        default: null
    },
    rankAchievedAt:{
        type: Number,
        default: null
    },
    totalIncomeUsd:{
        type: String,
        default: "0"
    },
    totalIncomeDsc:{
        type: String,
        default: "0"
    },
    totalIncomeDscInUsd:{
        type: String,
        default: "0"
    },

    time:{
        type:Number,
        default: () => Math.floor(Date.now() / 1000)
    }
},{timestamps: true, collection: 'registration'});

RegistrationSchema.index({ userAddress: 1, sponsorAddress: 1 }, { unique: true });

const RegistrationModel = mongoose.model('registration', RegistrationSchema);

module.exports = RegistrationModel;