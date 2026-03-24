require("dotenv").config();
require("./src/config/dbConn")
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const moment = require("moment");
const userRoutes = require("./src/routes/userRoutes");
const adminRoutes = require("./src/routes/adminRoutes");

const { getLivePrice } = require("./src/utils/liveDscPriceApi");
const { errorHandler } = require("./src/middlewares/errorHandler");
const { dscNodeListEvents } = require("./src/indexer/nodeIndexer");
const { createDefaultOwnerRegDoc, giveCheckSummedAddress, manageRank, giveGapIncome, splitByRatio, generateDefaultAdminDoc, isAddressValid, setLatestBlock, refreshDaoDelegatorUsers, givePaymentRatioForDeployedNode, calculateUserRoiAssurance, ct, getMonthIndex, returnLastRoiDistributedTimeOnFeeDeposit } = require("./src/helpers/helper");
const { updateNodeValueAssurance, giveRoiToNodeHolders } = require("./src/helpers/cronJob");
const cron = require('node-cron');
const { ratioUsdDsc } = require("./src/helpers/constant");
const { getDaoAndDelegator, createDaoAndDelegatorsAdminInBulk, updateDaoDelegatorForAdmins } = require("./src/helpers/adminHelper");
const { giveUserTeam, updateLastRoiDistributedToPaidAssuranceFees, fixGapIncome, fixSystemRankAndBusinesses } = require("./src/bugFixer");
const { billingListEvents } = require("./src/indexer/billingIndexer");
const { BigNumber } = require("bignumber.js");





app.use(express.json());
app.use(cors({
    origin: "*"
}));

app.get("/api/test", (req, res) => {
    res.status(200).json({ message: "Congratulations! Your backend is live." });
})

app.use("/api", userRoutes);
app.use("/api/admin", adminRoutes);

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

    cron.schedule('1 0 7 * *', async () => {
        try {
            console.log(`Monthly Cron (12:01 AM 1st day) started at ${new Date().toLocaleString()}`);
            await updateNodeValueAssurance();
        } catch (err) {
            console.error('Error in monthly cron job:', err);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });
    cron.schedule('*/1 * * * *', async () => {
        try {
            console.log(`[CRON] Updating live price at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
            const res = await getLivePrice();
            console.log("Live DSC Price fetched successfully:", res);
            await updateDaoDelegatorForAdmins();
            await refreshDaoDelegatorUsers();
        } catch (err) {
            console.error('Error in monthly cron job:', err);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });

} else {
    cron.schedule('*/2 * * * *', async () => {
        try {
            console.log(`Cron job started at ${new Date().toLocaleString()}`);
            await giveRoiToNodeHolders();

        } catch (err) {
            console.error('Error executing updateLegRanksForAllUsersThroughCron cron job:', err);
        }

    }, {
        timezone: 'Asia/Kolkata'
    });
    cron.schedule('*/15 * * * *', async () => {
        try {
            console.log(`Cron (every 15 mins) started at ${new Date().toLocaleString()}`);
            await updateNodeValueAssurance();
        } catch (err) {
            console.error('Error in 15-min cron job:', err);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });
}

const server = app.listen(PORT, async () => {
    const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
    const unixServerTimeCheck = moment().unix();
    console.log(`🚀 Server is running on port ${PORT} at ${currentTime} & in unix check: ${unixServerTimeCheck}`);

    await ratioUsdDsc();
    if (process.env.NODE_ENV === "development") {
        const res = await getLivePrice();
        console.log("Live DSC Price fetched successfully:", res);
        // await setLatestBlock();
        // await updateLastRoiDistributedToPaidAssuranceFees();
        // await dscNodeListEvents();
        // await billingListEvents();
        // await generateDefaultAdminDoc();
        // await createDaoAndDelegatorsAdminInBulk();
        // await updateDaoDelegatorForAdmins();
        // await refreshDaoDelegatorUsers();
        // await giveRoiToNodeHolders();
        // await givePaymentRatioForDeployedNode("0x63bD0d5ae4E76AB501E3bD03A03c52Db8D3429CF",3);
    //    await calculateUserRoiAssurance(1722470400,"270000000000000000000"); 
        // await updateNodeValueAssurance();
    } else {

        const res = await getLivePrice();
        console.log("Live DSC Price fetched successfully:", res);
        await generateDefaultAdminDoc();
        await createDaoAndDelegatorsAdminInBulk();
        await dscNodeListEvents();
        await billingListEvents();
    }
});


server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Not connected to Port ${PORT} as this is already in use.`);
    } else {
        console.error("Server error:", error);
    }
});