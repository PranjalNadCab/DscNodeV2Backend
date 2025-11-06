const mongoose  = require("mongoose")

const billingConfigSchema = new mongoose.Schema({
    lastSyncBlock: { type: String, default:"48787822",required: true },
},
    { timestamps: true, collection: "BillingBlockConfig" }
);

 const BillingBlockConfig = mongoose.model("BillingBlockConfig", billingConfigSchema);

module.exports = BillingBlockConfig;
