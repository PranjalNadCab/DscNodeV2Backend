const mongoose = require("mongoose");


const NodeRegisteredSchema = new mongoose.Schema({   
    userAddress:{
        type:String,
        trim:true,
        requried:true
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
    nodeNum:{
        type:Number,
        default:null
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


NodeRegisteredSchema.index({ userAddress: 1 },{unique:true});

const NodesRegistered = mongoose.model("NodesRegistered", NodeRegisteredSchema);

module.exports = NodesRegistered;