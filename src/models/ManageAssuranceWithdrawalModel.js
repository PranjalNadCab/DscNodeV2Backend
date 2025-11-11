const mongoose = require('mongoose');

const ManageAssuranceWithdrawalSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        trim: true,
        requried: true
    },
    actionType:{
        type: String,
        enum: ['WITHDRAW', 'TRANSFER','SWAPPED'],
        required: true
    },
    amountDsc: {
        type: String,
        required: true,
    },
    amountUsdt: {
        type: String,
        default:"0"
    },
    lastUsedNonce:{
        type: Number,
        required:true
    },
    time: {
        type: Date,
        default: Date.now
    },
    block:{
        type: Number,
        required:true
    },
    transactionHash:{
        type: String,
        required:true
    }
},{timestamps:true});

ManageAssuranceWithdrawalSchema.index({ userAddress: 1,time:1,amountDsc:1, actionType:1 },{ unique: true });

const ManageAssuranceWithdrawalModel = mongoose.model('ManageAssuranceWithdrawal', ManageAssuranceWithdrawalSchema);

module.exports = ManageAssuranceWithdrawalModel;