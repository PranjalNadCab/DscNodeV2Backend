const mongoose = require("mongoose");


const nodeDeployedSchema = new mongoose.Schema({   
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
    currGenratedRoi:{
        type:String,
        default:""
    },
    lastRoiDistributed:{
        type:Number,
        default:()=>Math.floor(Date.now()/1000)
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


nodeDeployedSchema.index({ userAddress: 1,nodeNum:1 },{unique:true});

const NodeDeployedModel = mongoose.model("NodeDeployed", nodeDeployedSchema);

module.exports = NodeDeployedModel;