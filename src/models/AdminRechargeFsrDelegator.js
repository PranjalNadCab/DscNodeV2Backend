const mongoose = require('mongoose');

const adminRechargeFsrDelegatorSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
        trim:true
    },
    userType:{
        type: String,
        enum: ['delegator', 'dao'],
        default: 'delegator'
    },
    amount: {
        type: Number,
        required: true
    },
    time: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    }
},{timestamps:true});

const AdminRechargeFsrDelegator = mongoose.model('AdminRechargeFsrDelegator', adminRechargeFsrDelegatorSchema);
module.exports = AdminRechargeFsrDelegator;