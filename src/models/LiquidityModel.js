const mongoose = require("mongoose");


const liquiditySchema = new mongoose.Schema({
    userAddress: {
        type: String,
        trim: true,
        requried: true
    },
    usdt:{
        type: Number,
        required: true
    },
    dsc:{
        type: Number,
        required: true
    },
    block: {
        type: Number,
        required: true
    },
    transactionHash: {
        type: String,
        required: true,
    },
  
}, { timestamps: true });


liquiditySchema.index({ userAddress: 1, transactionHash: 1, block: 1 }, { unique: true });

const LiquidityModel = mongoose.model("LiquidityModel", liquiditySchema);

module.exports = LiquidityModel;