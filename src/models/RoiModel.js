const mongoose = require("mongoose");


const roiModelSchema = new mongoose.Schema({   
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
    roiDscAssurance:{
        type:String,
        default:""
    },
    baseMinAss:{
        type:String,
       default:null
    },

},{ timestamps: true });


roiModelSchema.index({ userAddress: 1,nodeName:1,time:1 },{unique:true});

const RoiModel = mongoose.model("Roi", roiModelSchema);

module.exports = RoiModel;