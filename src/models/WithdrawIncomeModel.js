const mongoose = require('mongoose');

const withdrawIncomeSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
        trim:true
    },
    amountInUsdt: {
        type: String,
        required: true
    },
    amountInDscInUsd: {
        type: String,
        required: true
    },
    amountInDsc: {
        type: String,
        required: true
    },
    time: {
        type: Number,
        default: Math.floor(Date.now() / 1000) 
    },
    lastUsedNonce: {
        type: Number,
        default: 0
    },
}, { timestamps: true ,collection:"WithdrawIncome"});

module.exports = mongoose.model('WithdrawIncome', withdrawIncomeSchema);