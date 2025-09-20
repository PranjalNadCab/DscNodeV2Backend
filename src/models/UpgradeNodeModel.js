const mongoose = require("mongoose");


const UpgradeNodeSchema = new mongoose.Schema({   
    userAddress:{
        type:String,
        trim:true,
        requried:true
    },
    nodeName: {
        type: String,
        required: true,
        trim:true
    },
    nodeNum:{
        type:Number,
        default:null
    },
    amountUsdtPaid:{
        type:String,
        required:true
    },
    majorIncome:{
        type:String,
        required:true
    },
    minor4Income:{
        type:String,
        required:true
    },
    oldBalance:{
        type:String,
        required:true
    },
    time:{
        type:Number,
        default:()=>Math.floor(Date.now()/1000)
    },
    block:{
        type:Number,
        required:true
    },
    transactionHash:{
        type:String,
        required:true,
    }
},{ timestamps: true });


UpgradeNodeSchema.index({ userAddress: 1,nodeName:1 },{unique:true});

const UpgradedNodes = mongoose.model("UpgradedNodes", UpgradeNodeSchema);

module.exports = UpgradedNodes;