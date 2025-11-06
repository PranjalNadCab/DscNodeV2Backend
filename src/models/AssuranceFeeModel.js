const mongoose = require("mongoose");


const assuranceFeeSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
    },
    nodeNum: {
        type: Number,
        required: true
    },
    time: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: "USDT"
    },
    seqMonth: {
        type: Number,
        required: true
    },
    calendarMonth: {
        type: String,
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
    invoiceId: {
        type: Number,
        unique: true,
    },

}, { timestamps: true });

assuranceFeeSchema.index({ invoiceId: 1 }, { unique: true });
assuranceFeeSchema.index({ userAddress: 1, nodeNum: 1, time: 1, block: 1, transactionHash: 1 }, { unique: true });

assuranceFeeSchema.pre("save", async function (next) {
    if (this.invoiceId) return next(); // Skip if already set

    let unique = false;
    let newId;

    while (!unique) {
        newId = Math.floor(10000 + Math.random() * 90000); // Generate random 5-digit number
        const exists = await mongoose.models.AssuranceFee.findOne({ invoiceId: newId });
        if (!exists) unique = true;
    }

    this.invoiceId = newId;
    next();
});

const AssuranceFeeModel = mongoose.model("AssuranceFee", assuranceFeeSchema);

module.exports = AssuranceFeeModel;