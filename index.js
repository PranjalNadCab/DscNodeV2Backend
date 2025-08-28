require("dotenv").config();
require("./src/config/dbConn")
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const moment = require("moment");
const userRoutes = require("./src/routes/userRoutes");
const { getLivePrice } = require("./src/utils/liveDscPriceApi");
const { errorHandler } = require("./src/middlewares/errorHandler");
const { dscNodeListEvents } = require("./src/indexer/nodeIndexer");
const { createDefaultOwnerRegDoc, giveCheckSummedAddress, manageRank, giveGapIncome, splitByRatio, generateDefaultAdminDoc, isAddressValid } = require("./src/helpers/helper");





app.use(express.json());
app.use(cors({
    origin: "*"
}));

app.get("/api/test", (req, res) => {
    res.status(200).json({ message: "Congratulations! Your backend is live." });
})

app.use("/api", userRoutes);
app.use(errorHandler);

const server = app.listen(PORT, async () => {
    const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
    const unixServerTimeCheck = moment().unix();
    console.log(`🚀 Server is running on port ${PORT} at ${currentTime} & in unix check: ${unixServerTimeCheck}`);

    if (process.env.NODE_ENV === "development") {
        const res = await getLivePrice();
        console.log("Live DSC Price fetched successfully:", res);
        await createDefaultOwnerRegDoc();
        await generateDefaultAdminDoc();

        // await dscNodeListEvents();
        // await manageRank("0x83a364Ac454f715B0F6292483F6D44aEfA1a049d");
        // await giveGapIncome("0x83a364Ac454f715B0F6292483F6D44aEfA1a049d","100000000000000000000");
        //    splitByRatio("500000000000000000000","6000000000000000000","19000000000000000000",50000)

    } else {


    }
});


server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Not connected to Port ${PORT} as this is already in use.`);
    } else {
        console.error("Server error:", error);
    }
});