const mongoose = require("mongoose");


const NbdFundSchema = new mongoose.Schema({   
    userAddress:{
        type:String,
        trim:true,
        requried:true
    },
    nodeNum:{
        type:Number,
        default:null
    },
    time:{
        type:Number,
        default:()=>Math.floor(Date.now()/1000)
    },
    amountNbdPaid:{
        type:String,
        required:true
    },
    block:{
        type:String,
        required:true
    },
    transactionHash:{
        type:String,
        required:true
    },
  
},{ timestamps: true });


NbdFundSchema.index({ userAddress: 1,time:1 },{unique:true});

const NbdFundModel = mongoose.model("NbdFund", NbdFundSchema);

module.exports = NbdFundModel;