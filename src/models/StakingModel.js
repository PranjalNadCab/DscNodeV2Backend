const mongoose = require('mongoose');

const StakingSchema = new mongoose.Schema({

    userAddress: {
        type: String,
        required: true,
        unique: true
    },
    totalAmountInUsd: {
        type: string,
        required: true
    },
    amountInDscInUsd:{
        type: String,
        required: true
    },
    amountInDsc:{
        type: String,
        required: true
    },
    amountInUsdt:{
        type: String,
        required: true
    },
    time: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    lastUsedNonce:{
        type:Number,
        default: 0
    }
}, { timestamps: true, collection: 'staking'});

const StakingModel = mongoose.model('staking', StakingSchema);


module.exports = StakingModel;

