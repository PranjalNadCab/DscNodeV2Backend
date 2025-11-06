const mongoose = require("mongoose");


const assuranceFeeSchema = new mongoose.Schema({   
    userAddress: {
        type: String,
        required: true,
    },
    nodeNum:{
        type:Number,
        required:true
    },
    time:{
        type:Number,
        default:()=>Math.floor(Date.now()/1000)
    },
    amount:{
        type:Number,
        required:true
    },
    currency:{
        type:String,
        default:"USDT"
    },
    seqMonth:{
        type:Number,
        required:true
    },
    calendarMonth:{
        type:String,
        required:true
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


assuranceFeeSchema.index({ userAddress: 1,nodeNum:1,time:1,block:1,transactionHash:1 },{unique:true});

const AssuranceFeeModel = mongoose.model("AssuranceFee", assuranceFeeSchema);

module.exports = AssuranceFeeModel;