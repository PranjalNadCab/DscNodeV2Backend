const mongoose  = require("mongoose")

const blockConfigSchema = new mongoose.Schema({
    lastSyncBlock: { type: String, default:"48787822",required: true },
},
    { timestamps: true, collection: "BlockConfig" }
);

 const DscNodeBlockConfig = mongoose.model("BlockConfig", blockConfigSchema);

module.exports = DscNodeBlockConfig;
