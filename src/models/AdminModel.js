const mongoose = require('mongoose');
const bcrypt = require("bcrypt");


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
                baseMinAss: { type: String, required: true },
                nodeNum: { type: Number, required: true }
            }
        ],
        required: true
    },
    lastUpdatedMonthForNodeValidators: {
        type: String,
        default: null
    },
    stakeRatio: {
        type: {
            part1: { type: Number, required: true },
            part2: { type: Number, required: true }
        },
        required: true
    },
    disabledStakings: {
        type: [{
            type: String,
            enum: ["DSC", "USDT", "Mix"],
            // required: true
        }],
        default: []
    },
    role: {
        type: String,
        enum: ["admin", "dao", "delegator"],
        default: "admin"
    },
    walletAddress: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String
    }
}, { timestamps: true });


adminSchema.pre("save", async function (next) {

    if (!this.isModified('password')) {
        next();
    } else {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
})

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;