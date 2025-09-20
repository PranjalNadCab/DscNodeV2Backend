const mongoose = require("mongoose");


const NodeConvertedSchema = new mongoose.Schema({   
    nodeNum: {
        type: Number,
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
    },
    baseMinValue:{
        type:String,
        default:null
    },
    baseMinAss:{
        type:String,
       default:null
    },
    conversionMonth:{
        type:String,
        default:null
    }
},{ timestamps: true });


NodeConvertedSchema.index({ userAddress: 1,nodeName:1 },{unique:true});

const NodeConverted = mongoose.model("NodeConverted", NodeConvertedSchema);

module.exports = NodeConverted;