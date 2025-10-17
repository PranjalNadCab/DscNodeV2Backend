const mongoose = require("mongoose");


const ActivateFsrSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
        trim:true
    },
    dscAmountInUsd:{
        type: Number,
        required: true
    },
    activationAmount:{
        type: Number,
        required: true
    },
    generatedDsc:{
        type: Number,
        required: true
    },
    priceInUsd:{
        type: Number,
        required: true
    },
    lastUsedNonce:{
        type: Number,
        required: true
    },
    userType:{
        type:String,
        enum:["normal","dao","delegator"],
        default:"normal"
    },
    time:{
        type: Number,
        required: true
    },
    block:{
        type:Number,
        required:true
    },
    transactionHash:{
        type:String,
        required:true,
        trim:true
    },
}, { timestamps: true});

ActivateFsrSchema.index({ userAddress: 1,time:1  }, { unique: true });

const ActivateFsrModel = mongoose.model('activatedFsr', ActivateFsrSchema);

module.exports = ActivateFsrModel;