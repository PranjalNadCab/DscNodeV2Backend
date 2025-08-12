const mongoose = require("mongoose");
const LivePriceDscSchema = new mongoose.Schema({
    price: {
        type: Number,
        required: true
    },

},{timestamps: true});

const LivePriceDsc = mongoose.model('LivePriceDsc', LivePriceDscSchema);

module.exports= LivePriceDsc

