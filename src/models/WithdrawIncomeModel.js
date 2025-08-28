const mongoose = require('mongoose');

const withdrawIncomeSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
        trim:true
    },
    amountInUsdt: {
        type: String,
        default:null
    },
    amountInUsdtAfterDeduction: {
        type: String,
        default:null
    },
    amountInDscInUsd: {
        type: String,
        default:null
    },
    amountInDscInUsdAfterDeduction: {
        type: String,
        default:null
    },
    amountInDsc: {
        type: String,
        default:null
    },
    amountInDscAfterDeduction: {
        type: String,
        default:null
    },
    time: {
        type: Number,
        default: Math.floor(Date.now() / 1000),
        required: true
    },
    lastUsedNonce: {
        type: Number,
        default: 0
    },
    block: {
        type: Number,
        required: true
    },
    transactionHash: {
        type: String,
        required: true,
        trim:true
    }
}, { timestamps: true ,collection:"WithdrawIncome"});

withdrawIncomeSchema.index({ userAddress: 1, transactionHash: 1 }, { unique: true });

module.exports = mongoose.model('WithdrawIncome', withdrawIncomeSchema);