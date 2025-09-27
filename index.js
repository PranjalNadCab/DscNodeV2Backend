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
const { createDefaultOwnerRegDoc, giveCheckSummedAddress, manageRank, giveGapIncome, splitByRatio, generateDefaultAdminDoc, isAddressValid, setLatestBlock } = require("./src/helpers/helper");
const { updateNodeValueAssurance, giveRoiToNodeHolders } = require("./src/helpers/cronJob");
const cron = require('node-cron');
const { ratioUsdDsc } = require("./src/helpers/constant");





app.use(express.json());
app.use(cors({
    origin: "*"
}));

app.get("/api/test", (req, res) => {
    res.status(200).json({ message: "Congratulations! Your backend is live." });
})

app.use("/api", userRoutes);
app.use(errorHandler);

if (process.env.NODE_ENV !== "development") {
    cron.schedule('1 0 * * *', async () => {
        try {
            console.log(`Cron job started at ${new Date().toLocaleString()}`);
            await giveRoiToNodeHolders();

        } catch (err) {
            console.error('Error executing updateLegRanksForAllUsersThroughCron cron job:', err);
        }

    }, {
        timezone: 'Asia/Kolkata'
    });

    cron.schedule('1 0 1 * *', async () => {
        try {
            console.log(`Monthly Cron (12:01 AM 1st day) started at ${new Date().toLocaleString()}`);
            await updateNodeValueAssurance();
        } catch (err) {
            console.error('Error in monthly cron job:', err);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });

} else {
    // cron.schedule('*/2 * * * *', async () => {
    //     try {
    //         console.log(`Cron job started at ${new Date().toLocaleString()}`);
    //         await giveRoiToNodeHolders();

    //     } catch (err) {
    //         console.error('Error executing updateLegRanksForAllUsersThroughCron cron job:', err);
    //     }

    // }, {
    //     timezone: 'Asia/Kolkata'
    // });
    // cron.schedule('*/15 * * * *', async () => {
    //     try {
    //         console.log(`Cron (every 15 mins) started at ${new Date().toLocaleString()}`);
    //         await updateNodeValueAssurance();
    //     } catch (err) {
    //         console.error('Error in 15-min cron job:', err);
    //     }
    // }, {
    //     timezone: 'Asia/Kolkata'
    // });
}

const server = app.listen(PORT, async () => {
    const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
    const unixServerTimeCheck = moment().unix();
    console.log(`🚀 Server is running on port ${PORT} at ${currentTime} & in unix check: ${unixServerTimeCheck}`);

    if (process.env.NODE_ENV === "development") {
        const res = await getLivePrice();
        console.log("Live DSC Price fetched successfully:", res);
        // await setLatestBlock();
        await generateDefaultAdminDoc();
        await createDefaultOwnerRegDoc();
        // ratioUsdDsc();
        await dscNodeListEvents();
        // await giveRoiToNodeHolders();
        // await updateNodeValueAssurance();
        // await manageRank("0x83a364Ac454f715B0F6292483F6D44aEfA1a049d");
        // await giveGapIncome("0x70E5EEc9877387cf3Fe46ec6a5E8b72A3330D2dE","100000000000000000000","Beginner","100000000000000000000","0");
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