const mongoose = require("mongoose");


const roiModelSchema = new mongoose.Schema({
    nodeNum: {
        type: Number,
        required: true,
    },
    userAddress: {
        type: String,
        trim: true,
        requried: true
    },
    dscAllocation:{
        type: String,
        default: "0"
    },
    swapAllocation:{
        type: String,
        default: "0"
    },
    time: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    baseMinAss: {
        type: String,
        default: null
    },
    roiGeneratedForNumDay: {
        type: Number,
        default: 1
    }

}, { timestamps: true });


roiModelSchema.index({ userAddress: 1, nodeNum: 1, time: 1 }, { unique: true });

const RoiModel = mongoose.model("Roi", roiModelSchema);

module.exports = RoiModel;