const mongoose = require('mongoose');

const StakingSchema = new mongoose.Schema({

    userAddress: {
        type: String,
        required: true,
        
    },
    currency:{
        type: String,
        enum: ['USDT', 'DSC'],
        required: true
    },
    totalAmountInUsd: {
        type: String,
        required: true
    },
    amountUsdPaid:{
        type:String,
        required:true
    },
    amountInDscInUsd:{
        type: String,
        default:"0"
    },
    amountInDsc:{
        type: String,
        defautl:"0"
    },
    amountInUsdt:{
        type: String,
        default:"0"
    },
    rateDollarPerDsc:{
        type: String,
        required: true
    },
    time: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    isPendingStake:{
        type:Boolean,
        default:false
    },
    lastUsedNonce:{
        type:Number,
        default: 0
    },
    mixTxHash:{
        type: String,
        default:"NA"
    },
    transactionHash:{
        type: String,
        required: true
    },
    block:{
        type: Number,
        required: true
    }
}, { timestamps: true, collection: 'staking'});

StakingSchema.index({ userAddress: 1, lastUsedNonce: 1,transactionHash:1 }, { unique: true });

const StakingModel = mongoose.model('staking', StakingSchema);


module.exports = StakingModel;

