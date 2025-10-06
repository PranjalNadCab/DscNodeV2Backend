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
    fromLevel:{
        type:Number,
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

NodeRegIncomeSchema.index({ senderAddress: 1, receiverAddress: 1,fromLevel:1,time:1 }, { unique: true });

const NodeRegIncomeModel = mongoose.model('NodeRegistrationIncome', NodeRegIncomeSchema);

module.exports = NodeRegIncomeModel;