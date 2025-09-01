const mongoose = require("mongoose");


const NodeConvertedSchema = new mongoose.Schema({   
    nodeName: {
        type: String,
        required: true,
    },
    userAddress:{
        type:String,
        trim:true,
        requried:true
    },
    time:{
        type:Number,
        default:()=>Math.floor(Date.now()/1000)
    },
    lastUsedNonce:{
        type:Number,
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


NodeConvertedSchema.index({ userAddress: 1,nodeName:1 },{unique:true});

const NodeConverted = mongoose.model("NodeConverted", NodeConvertedSchema);

module.exports = NodeConverted;