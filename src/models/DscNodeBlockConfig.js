import mongoose from "mongoose";

const blockConfigSchema = new mongoose.Schema({
    lastSyncBlock: { type: String, default:"48787822",required: true },
},
    { timestamps: true, collection: "BlockConfig" }
);

export const DForceBlockConfig = mongoose.model("BlockConfig", blockConfigSchema);