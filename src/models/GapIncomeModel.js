const mongoose  = require("mongoose")

const gapIncomeSchema = new mongoose.Schema({
    receiverAddress:{
        type: String,
        required: true,
        trim: true
    },
    receiverRank:{
        type: String,
        required: true,
        trim: true
    },
    senderAddress:{
        type: String,
        required: true,
        trim: true
    },
    senderRank:{
        type: String,
        default:null,
        trim: true
    },
    senderTotalStakedUsd:{
        type: Number,
        default: 0
    },
    totalGapIncomeInUsd:{
        type: String,
        required: true,
        trim: true
    },
    gapIncomeInUsd:{
        type: String,
        required: true,
        trim: true
    },
    gapIncomeInDsc:{
        type: String,
        required: true,
        trim: true
    },
    gapIncomeInDscInUsd:{
        type: String,
        required: true,
        trim: true
    },
    dscPrice:{
        type: Number,
        required: true,
    },
    percentReceived:{
        type:Number,
        required: true,
    },
    time:{
        type: Number,
        required: true,
        default: Math.floor(Date.now() / 1000) // Unix timestamp in seconds
    },
    stakingAmountInUsd: {
        type: String,
        default: null,
        trim: true
    },
    transactionHash:{
        type: String,
        default:null,
        trim: true
    },
    blockNumber:{
        type: Number,
        default: null
    },
    incomeType:{
        type: String,
        enum: ["node", "stake"],
        default:"stake"
    },
    isLapsed:{
        type: Boolean,
        default: false
    }

},
    { timestamps: true}
);

gapIncomeSchema.index({ senderTotalStakedUsd:1, senderAddress: 1,receiverAddress:1,time:1 }, { unique: true });

 const GapIncomeModel = mongoose.model("gapIncome", gapIncomeSchema);

module.exports = GapIncomeModel;
