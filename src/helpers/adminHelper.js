const { default: axios } = require("axios");
const AdminModel = require("../models/AdminModel");
const { ct, giveAdminSettings } = require("./helper");
const BigNumber = require("bignumber.js");
const UpgradedNodes = require("../models/UpgradeNodeModel");
const GapIncomeModel = require("../models/GapIncomeModel");
const NodeRegIncomeModel = require("../models/NodeRegIncomeModel");
const NodeDeployedModel = require("../models/NodeDeployedModel");
const Admin = require("../models/AdminModel");

const daoUrl = "https://dao.dsclab.ai/api/getdaoList";
const delegatorsUrl = "https://dao.dsclab.ai/api/delegatorsList";

const getDaoAndDelegator = async () => {
    try {

        const [daoList, delegatorLilst] = await Promise.all([
            axios.get(daoUrl),
            axios.get(delegatorsUrl)
        ]);

        // console.log("DAO List:", daoList.data.data);
        // console.log("Delegator List:", delegatorLilst.data.data);
        const daos = daoList.data.data.filter((item, index) => item.Add);
        const delegators = delegatorLilst.data.data.filter((item, index) => item.Add);
        return { daos, delegators };
    } catch (error) {
        console.error("Error in getDaoAndDelegator:", error);
        throw { daos: [], delegators: [] };
    }
}

const generateDefaultDaoDelegatorDoc = async (role, walletAddress, password) => {
    try {
        const existingAdmin = await AdminModel.findOne({ role, walletAddress });
        if (!existingAdmin) {
            // ct({role,walletAddress,password,existingAdmin,message:"Default admin document creation skipped (already exists)."});
            const defaultDoc = new AdminModel({
                withdrawDeductionPercent: 5, // Default deduction percent
                nodeValidators: [
                    { name: "Pioneers", reward: 100, selfStaking: new BigNumber(3000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(90 * 1e18).toFixed(), nodeNum: 1 },
                    { name: "Guardians", reward: 200, selfStaking: new BigNumber(6000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(180 * 1e18).toFixed(), nodeNum: 2 },
                    { name: "Visionaries", reward: 300, selfStaking: new BigNumber(9000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(270 * 1e18).toFixed(), nodeNum: 3 },
                    { name: "Node Omega", reward: 400, selfStaking: new BigNumber(12000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(360 * 1e18).toFixed(), nodeNum: 4 },
                    { name: "Node Core", reward: 600, selfStaking: new BigNumber(18000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(540 * 1e18).toFixed(), nodeNum: 5 },
                    { name: "Node Apex", reward: 800, selfStaking: new BigNumber(24000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(720 * 1e18).toFixed(), nodeNum: 6 },
                    { name: "Node Nexus", reward: 1200, selfStaking: new BigNumber(36000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(1080 * 1e18).toFixed(), nodeNum: 7 },
                    { name: "Node Fusion", reward: 1600, selfStaking: new BigNumber(48000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(1440 * 1e18).toFixed(), nodeNum: 8 },
                    { name: "Node Dominion", reward: 2000, selfStaking: new BigNumber(60000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(1800 * 1e18).toFixed(), nodeNum: 9 },
                ],
                stakeRatio: {
                    part1: 7,
                    part2: 3
                },
                lastUpdatedMonthForNodeValidators: process.env.START_MONTH || "October",
                role: role,
                walletAddress,
                password
            });
            await defaultDoc.save();
            ct({ role, walletAddress, password, message: "Default admin document created successfully." });
        }
        else {
            console.log("Admin document of dao and delegator already exists.");
        }
    } catch (error) {
        console.log("Error creating default admin document:", error);
    }
}

const createDaoAndDelegatorsAdminInBulk = async () => {
    try {
        const { daos, delegators } = await getDaoAndDelegator();
        for (const dao of daos) {
            let { target_address } = dao;
            if (process.env.NODE_ENV === "development") {
                target_address = "0x2abae3a15E764AFa3948b2Cb04E81f0718d8f846";
            }
            await generateDefaultDaoDelegatorDoc("dao", target_address, process.env.DAO_PASSWORD);
        }

        for (const delegator of delegators) {
            let { target_address } = delegator;
            if (process.env.NODE_ENV === "development") {
                target_address = "0x2abae3a15E764AFa3948b2Cb04E81f0718d8f846";
            }

            await generateDefaultDaoDelegatorDoc("delegator", target_address, process.env.DELEGATOR_PASSWORD);
        }

    } catch (error) {
        console.log(error);
    }
}


/**
 * Calculates sum of amountUsdPaid by currency for a given time range,
 * and counts payments by DAO/Delegator, and incomplete payments.
 * @param {number | null} startTime - Unix timestamp for the start of the range (or null for all time).
 * @returns {object} Aggregated metrics for the time range.
 */
const getMetricsForTimeRange = async (startTime) => {
    const matchFilter = startTime ? { time: { $gte: startTime } } : {};

    const rawData = await UpgradedNodes.find(matchFilter, 'amountUsdPaid currency isPaymentCompleted paidBy.userType');

    let usdtSum = new BigNumber(0);
    let dscSum = new BigNumber(0);
    let incompleteCount = 0;
    // Updated to track DAO and Delegator counts separately
    let daoCount = 0;
    let delegatorCount = 0;

    const E_18 = new BigNumber("1e18");

    rawData.forEach(doc => {
        // 1. Sum by Currency (Amount is 1e18 string)
        const amountUsd = new BigNumber(doc.amountUsdPaid).dividedBy(E_18);
        if (doc.currency === 'USDT') {
            usdtSum = usdtSum.plus(amountUsd);
        } else if (doc.currency === 'DSC') {
            dscSum = dscSum.plus(amountUsd);
        }

        // 2. Count Incomplete Payments
        if (doc.isPaymentCompleted === false) {
            incompleteCount++;
        }

        // 4. Count DAO/Delegator Payments - Updated logic
        if (doc.paidBy) {
            if (doc.paidBy.userType === "dao") {
                daoCount++;
            } else if (doc.paidBy.userType === "delegator") {
                delegatorCount++;
            }
        }
    });

    return {
        usdtSum: usdtSum.toString(),
        dscSum: dscSum.toString(),
        incompleteCount,
        // Return separate counts
        daoCount,
        delegatorCount
    };
};

/**
 * Calculates the last (highest) node number holding count per user.
 * @returns {object} An object where keys are nodeNum (1-9) and values are counts.
 */
const getNodeHoldingCounts = async () => {
    const nodeHoldings = await UpgradedNodes.aggregate([
        // Sort to get the highest nodeNum first for each user
        { $sort: { userAddress: 1, nodeNum: -1, time: -1 } },
        // Group by userAddress to get the last (highest) nodeNum purchased
        {
            $group: {
                _id: "$userAddress",
                lastNodeNum: { $first: "$nodeNum" }
            }
        },
        // Group by the lastNodeNum to count the holdings
        {
            $group: {
                _id: "$lastNodeNum",
                count: { $sum: 1 }
            }
        }
    ]);

    const holdingsMap = {};
    // Initialize all 1-9 nodes to 0
    for (let i = 1; i <= 9; i++) {
        holdingsMap[i] = 0;
    }

    // Populate with actual counts
    nodeHoldings.forEach(item => {
        if (item._id >= 1 && item._id <= 9) {
            holdingsMap[item._id] = item.count;
        }
    });

    return holdingsMap;
};



const getIncomeMetrics = async (startTime) => {
    const filter = startTime ? { time: { $gte: startTime } } : {};
    const E_18 = new BigNumber("1e18");

    // 1. Gap Income Aggregation
    const gapIncomeDocs = await GapIncomeModel.find(filter, 'totalGapIncomeInUsd gapIncomeInUsd gapIncomeInDscInUsd');
    let totalGapIncomeInUsdSum = new BigNumber(0);
    let gapIncomeInUsdSum = new BigNumber(0);
    let gapIncomeInDscInUsdSum = new BigNumber(0);

    gapIncomeDocs.forEach(doc => {
        // Sums are calculated after converting from 1e18 to normal number
        totalGapIncomeInUsdSum = totalGapIncomeInUsdSum.plus(new BigNumber(doc.totalGapIncomeInUsd).dividedBy(E_18));
        gapIncomeInUsdSum = gapIncomeInUsdSum.plus(new BigNumber(doc.gapIncomeInUsd).dividedBy(E_18));
        gapIncomeInDscInUsdSum = gapIncomeInDscInUsdSum.plus(new BigNumber(doc.gapIncomeInDscInUsd).dividedBy(E_18));
    });

    // 2. Node Registration Income Aggregation
    const nodeRegIncomeDocs = await NodeRegIncomeModel.find(filter, 'amount');
    let nodeRegIncomeSum = new BigNumber(0);

    nodeRegIncomeDocs.forEach(doc => {
        // Sum is calculated after converting from 1e18 to normal number
        nodeRegIncomeSum = nodeRegIncomeSum.plus(new BigNumber(doc.amount).dividedBy(E_18));
    });

    return {
        gap: {
            totalGapIncomeInUsd: totalGapIncomeInUsdSum.toString(),
            gapIncomeInUsd: gapIncomeInUsdSum.toString(),
            gapIncomeInDscInUsd: gapIncomeInDscInUsdSum.toString(),
        },
        nodeReg: {
            amount: nodeRegIncomeSum.toString(),
        },
    };
};

/**
 * Calculates the count of deployed nodes grouped by name for a given time range.
 * @param {number | null} startTime - Unix timestamp for the start of the range (or null for all time).
 * @returns {object} An object where keys are node names and values are counts.
 */
const getNodeDeploymentCounts = async (startTime, nodeValidators) => {
    const filter = startTime ? { time: { $gte: startTime } } : {};

    const rawCounts = await NodeDeployedModel.aggregate([
        { $match: filter },
        {
            $group: {
                _id: "$nodeNum",
                count: { $sum: 1 }
            }
        }
    ]);

    const countsMap = {};
    rawCounts.forEach(item => {
        countsMap[item._id] = item.count;
    });

    // Convert nodeNums to nodeNames and initialize missing counts to 0
    const namedCounts = {};
    for (let i = 1; i <= 9; i++) {
        const name = nodeValidators.find(nv => nv.nodeNum === i)?.name || `Node ${i}`;
        namedCounts[name] = countsMap[i] || 0;
    }

    return namedCounts;
};


const updateDaoDelegatorForAdmins = async () => {
    try {
        const { daos, delegators } = await getDaoAndDelegator();

        // Extract lowercase addresses for comparison
        const daoAddresses = daos.map(obj => obj.target_address?.toLowerCase());
        const delegatorAddresses = delegators.map(obj => obj.target_address?.toLowerCase());

        const allValidAddresses = [...daoAddresses, ...delegatorAddresses];

        const existingAdmins = await Admin.find({ role: { $ne: "admin" } });
        // console.log('existing admins', existingAdmins);
        console.table({ existingAdminsLength: existingAdmins.length,allValidAddresses:allValidAddresses.length, message: "Existing DAO/Delegator admins fetched." });

        const bulkOps = [];

        // 1️⃣ Delete those not in DAO or Delegator list
        const toDelete = existingAdmins.filter(
            admin => !allValidAddresses.includes(admin.walletAddress.toLowerCase())
        );

        if (toDelete.length > 0) {
            ct({ toDeleteLength: toDelete.length, message: "Admins to be deleted:" });
            bulkOps.push(
                ...toDelete.map(admin => ({
                    deleteOne: { filter: { walletAddress: admin.walletAddress } }
                }))
            );
        }

        // 2️⃣ Insert missing DAOs
        for (const dao of daoAddresses) {
            const exists = existingAdmins.some(
                admin => admin.walletAddress.toLowerCase() === dao
            );
            if (!exists) {
                bulkOps.push({
                    insertOne: {
                        document: {
                            walletAddress: dao,
                            role: "dao",
                            withdrawDeductionPercent: 5, // ✅ provide defaults
                            nodeValidators: [],
                            stakeRatio: { part1: 0, part2: 0 },
                            disabledStakings: []
                        }
                    }
                });
            }
        }

        // 3️⃣ Insert missing Delegators
        for (const delegator of delegatorAddresses) {
            const exists = existingAdmins.some(
                admin => admin.walletAddress.toLowerCase() === delegator
            );
            if (!exists) {
                bulkOps.push({
                    insertOne: {
                        document: {
                            walletAddress: delegator,
                            role: "delegator",
                            withdrawDeductionPercent: 5,
                            nodeValidators: [],
                            stakeRatio: { part1: 0, part2: 0 },
                            disabledStakings: []
                        }
                    }
                });
            }
        }

        // 4️⃣ Execute all bulk operations
        if (bulkOps.length > 0) {
            await Admin.bulkWrite(bulkOps);
            console.log("✅ DAO and Delegator records synced successfully.");
        } else {
            console.log("ℹ️ No changes required — already in sync.");
        }
    } catch (error) {
        console.error("❌ Error updating DAO/Delegator admins:", error);
    }
};



module.exports = {
    createDaoAndDelegatorsAdminInBulk,
    getDaoAndDelegator,
    getNodeHoldingCounts,
    getMetricsForTimeRange,
    getIncomeMetrics,
    getNodeDeploymentCounts,
    updateDaoDelegatorForAdmins
}

