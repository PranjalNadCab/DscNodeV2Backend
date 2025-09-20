const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    withdrawDeductionPercent: {
        type: Number,
        required: true
    },
    nodeValidators: {
        type: [
            {
                name: { type: String, required: true },
                reward: { type: Number, required: true },
                selfStaking: { type: String, required: true },
                baseMinAss:{type:String,required:true},
                nodeNum:{type:Number,required:true}
            }
        ],
        required: true
    },
    lastUpdatedMonthForNodeValidators:{
        type: String,
        default: null
    },
    stakeRatio: {
        type: {
            part1: { type: Number, required: true },
            part2: { type: Number, required: true }
        },
        required: true
    }
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;