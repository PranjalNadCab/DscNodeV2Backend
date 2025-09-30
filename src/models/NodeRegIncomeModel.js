const mongoose = require("mongoose");

const NodeRegIncomeSchema = new mongoose.Schema({
    senderAddress:{
        type:String,
        required:true
    },
    receiverAddress:{
        type:String,
        required:true
    },
    amount:{
        type:String,
        required:true
    },
    time:{
        type:Number,
        default:()=>Math.floor(Date.now()/1000)
    }
}, { timestamps: true });

NodeRegIncomeSchema.index({ userAddress: 1, sponsorAddress: 1 }, { unique: true });

const NodeRegIncomeModel = mongoose.model('NodeRegistrationIncome', NodeRegIncomeSchema);

module.exports = NodeRegIncomeModel;