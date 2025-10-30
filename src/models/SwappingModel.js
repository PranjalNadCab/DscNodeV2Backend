const mongoose = require("mongoose");


const swappingSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        trim: true,
        requried: true
    },
    swappedAmount:{
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


swappingSchema.index({ userAddress: 1, transactionHash: 1, block: 1 }, { unique: true });

const SwappingModel = mongoose.model("SwappingModel", swappingSchema);

module.exports = SwappingModel;