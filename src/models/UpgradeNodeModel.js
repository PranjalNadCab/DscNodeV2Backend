const mongoose = require("mongoose");


const UpgradeNodeSchema = new mongoose.Schema({   
    userAddress:{
        type:String,
        trim:true,
        requried:true
    },
    nodeNum:{
        type:Number,
        default:null
    },
    lastUsedNonce:{
        type:Number,
        required:true
    },
    totalAmountInUsd:{
        type:String,
        required:true
    },
    amountUsdPaid:{
        type:String,
        required:true
    },
    time:{
        type:Number,
        default:()=>Math.floor(Date.now()/1000)
    },
    currency:{
        type: String,
        enum: ['USDT', 'DSC'],
        required: true
    },
    isPaymentCompleted:{
        type:Boolean,
        default:true
    },
    rateDollarPerDsc:{
        type: String,
        required: true
    },
    block:{
        type:Number,
        required:true
    },
    transactionHash:{
        type:String,
        required:true,
    },
    mixTransactionHash:{
        type:String,
        default:"NA"
    }
},{ timestamps: true });


UpgradeNodeSchema.index({ userAddress: 1,nodeName:1 },{unique:true});

const UpgradedNodes = mongoose.model("UpgradedNodes", UpgradeNodeSchema);

module.exports = UpgradedNodes;