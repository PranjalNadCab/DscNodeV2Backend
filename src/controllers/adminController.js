const { BigNumber } = require("bignumber.js");
const { ranks, ratioUsdDsc } = require("../helpers/constant");
// const { giveAdminSettings, createJwtToken, ct } = require("../helpers/helper");
const { ct, createJwtToken, giveAdminSettings, giveCheckSummedAddress } = require("../helpers/helper");

const Admin = require("../models/AdminModel");
const RegistrationModel = require("../models/RegistrationModel");
const UpgradedNodes = require("../models/UpgradeNodeModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const { getMetricsForTimeRange, getNodeHoldingCounts, getIncomeMetrics, getNodeDeploymentCounts } = require("../helpers/adminHelper");
const NodeDeployedModel = require("../models/NodeDeployedModel");
const AdminRechargeFsrDelegator = require("../models/AdminRechargeFsrDelegator");
const mongoose = require("mongoose");






const getAllUsers = async (req, res, next) => {
    try {
        let { page = 1, limit = 10, query = "", fromTime, toTime } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        const skip = (page - 1) * limit;

        // Dynamic filter
        const filter = {};

        // 🔍 Search filter
        if (query) {
            const regex = new RegExp(query, "i");
            filter.$or = [
                { userAddress: regex },
                { sponsorAddress: regex },
                { uniqueRandomId: regex },
            ];
        }

        // ⏰ Date filter (with safe type checks)
        const gte = fromTime && !isNaN(Number(fromTime)) ? Number(fromTime) : null;
        const lte = toTime && !isNaN(Number(toTime)) ? Number(toTime) : null;

        if (gte !== null && lte !== null) filter.time = { $gte: gte, $lte: lte };
        else if (gte !== null) filter.time = { $gte: gte };
        else if (lte !== null) filter.time = { $lte: lte };

        // 🧩 Projection
        const projection = {
            uniqueRandomId: 1,
            userAddress: 1,
            sponsorAddress: 1,
            teamCount: 1,
            directCount: 1,
            directStaking: 1,
            userTotalStakeInUsd: 1,
            userDirectPlusSelfStakeInUsd: 1,
            currentRank: 1,
            rankAchievedAt: 1,
            totalIncomeUsdtReceived: 1,
            totalIncomeDscReceived: 1,
            time: 1,
            nodePurchasingBalance: 1,
            transactionHash: 1,
            myNode: 1,
            isNodeRegDone: 1,
            createdAt: 1,
            totalIncomeDscInUsdReceived: 1
        };

        // Fetch users
        const allUsers = await RegistrationModel.find(filter, projection)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalUsers = await RegistrationModel.countDocuments(filter);

        return res.status(200).json({
            success: true,
            message: "All users fetched successfully!",
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers,
            count: allUsers.length,
            allUsers,
        });
    } catch (error) {
        next(error);
    }
};

// const getUpgradedNodesHistory = async (req, res, next) => {
//     try {
//         let { page = 1, limit = 10, query = "", fromTime, toTime } = req.query;

//         page = parseInt(page);
//         limit = parseInt(limit);
//         if (page < 1) page = 1;
//         if (limit < 1) limit = 10;
//         const skip = (page - 1) * limit;

//         // Base filter
//         const filter = {};

//         // 🔍 Search filter
//         if (query) {
//             const regex = new RegExp(query, "i");
//             filter.$or = [
//                 { transactionHash: regex },
//                 { mixTransactionHash: regex },
//                 { currency: regex },
//             ];
//         }

//         // ⏰ Date filter
//         const gte = fromTime && !isNaN(Number(fromTime)) ? Number(fromTime) : null;
//         const lte = toTime && !isNaN(Number(toTime)) ? Number(toTime) : null;

//         if (gte !== null && lte !== null) filter.time = { $gte: gte, $lte: lte };
//         else if (gte !== null) filter.time = { $gte: gte };
//         else if (lte !== null) filter.time = { $lte: lte };

//         // Aggregation to join RegistrationModel and fetch uniqueRandomId
//         const history = await UpgradedNodes.aggregate([
//             { $match: filter },
//             { $sort: { time: -1 } },
//             { $skip: skip },
//             { $limit: limit },
//             {
//                 $lookup: {
//                     from: "registration", // collection name in MongoDB
//                     localField: "userAddress",
//                     foreignField: "userAddress",
//                     as: "userInfo",
//                 },
//             },
//             {
//                 $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true },
//             },
//             {
//                 $project: {
//                     nodeNum: 1,
//                     lastUsedNonce: 1,
//                     totalAmountInUsd: 1,
//                     amountUsdPaid: 1,
//                     time: 1,
//                     currency: 1,
//                     isPaymentCompleted: 1,
//                     rateDollarPerDsc: 1,
//                     block: 1,
//                     transactionHash: 1,
//                     mixTransactionHash: 1,
//                     createdAt: 1,
//                     updatedAt: 1,
//                     userAddress: 1,
//                     uniqueRandomId: "$userInfo.uniqueRandomId",
//                 },
//             },
//         ]);

//         // Count total records (without pagination)
//         const totalRecords = await UpgradedNodes.countDocuments(filter);

//         res.json({
//             success: true,
//             totalRecords,
//             page,
//             limit,
//             totalPages: Math.ceil(totalRecords / limit),
//             count: history.length,
//             history,
//         });
//     } catch (err) {
//         console.error(err);
//         next(err);
//     }
// };

const getUpgradedNodesHistory = async (req, res, next) => {
    try {
        let { page = 1, limit = 10, query = "", fromTime, toTime } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        const skip = (page - 1) * limit;

        const filter = {};

        // 🔍 Search filter
        if (query) {
            const regex = new RegExp(query, "i");
            filter.$or = [
                { transactionHash: regex },
                { mixTransactionHash: regex },
                { currency: regex },
            ];
        }

        // ⏰ Date filter
        const gte = fromTime && !isNaN(Number(fromTime)) ? Number(fromTime) : null;
        const lte = toTime && !isNaN(Number(toTime)) ? Number(toTime) : null;

        if (gte !== null && lte !== null) filter.time = { $gte: gte, $lte: lte };
        else if (gte !== null) filter.time = { $gte: gte };
        else if (lte !== null) filter.time = { $lte: lte };

        const history = await UpgradedNodes.aggregate([
            { $match: filter },

            // 1️⃣ Group by mixTransactionHash (but treat "NA" as its own unique doc)
            {
                $group: {
                    _id: {
                        $cond: [
                            { $ne: ["$mixTransactionHash", "NA"] },
                            "$mixTransactionHash",
                            "$_id",
                        ],
                    },
                    docs: { $push: "$$ROOT" },
                    latestTime: { $max: "$time" },
                },
            },

            // 2️⃣ Sort groups by their latest time (latest first)
            { $sort: { latestTime: -1 } },

            // 3️⃣ Flatten back to normal documents (preserving group order)
            { $unwind: "$docs" },

            // 4️⃣ Replace root with actual doc
            { $replaceRoot: { newRoot: "$docs" } },

            // 5️⃣ Pagination
            { $skip: skip },
            { $limit: limit },

            // 6️⃣ Lookup user info
            {
                $lookup: {
                    from: "registration",
                    localField: "userAddress",
                    foreignField: "userAddress",
                    as: "userInfo",
                },
            },
            {
                $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true },
            },
            {
                $project: {
                    nodeNum: 1,
                    lastUsedNonce: 1,
                    totalAmountInUsd: 1,
                    amountUsdPaid: 1,
                    time: 1,
                    currency: 1,
                    isPaymentCompleted: 1,
                    rateDollarPerDsc: 1,
                    block: 1,
                    transactionHash: 1,
                    mixTransactionHash: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    userAddress: 1,
                    uniqueRandomId: "$userInfo.uniqueRandomId",
                    paidBy: 1
                },
            },
        ]);

        const totalRecords = await UpgradedNodes.countDocuments(filter);

        res.json({
            success: true,
            totalRecords,
            page,
            limit,
            totalPages: Math.ceil(totalRecords / limit),
            count: history.length,
            history,
        });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

const manageNodeStakings = async (req, res, next) => {
    try {
        const { action, status } = req.body;

        // Validate input
        const allowedActions = ["DSC", "USDT", "Mix"];
        if (!action || !allowedActions.includes(action)) {
            throw new Error("Invalid action type");
        }

        if (typeof status !== "boolean") {
            throw new Error("Invalid status type");
        }

        // Fetch admin document (assuming one admin document)
        let admin = await Admin.findOne();
        if (!admin) {
            throw new Error("Admin document not found");
        }

        // Update disabledStakings
        const index = admin.disabledStakings.indexOf(action);

        if (status === true && index === -1) {
            // Disable staking → add to disabledStakings
            admin.disabledStakings.push(action);
        } else if (status === false && index !== -1) {
            // Enable staking → remove from disabledStakings
            admin.disabledStakings.splice(index, 1);
        }

        await admin.save();

        // Fetch updated version
        const updatedAdmin = await Admin.findOne();

        res.status(200).json({
            success: true,
            message: `Node Staking ${action} has been ${status ? "disabled" : "enabled"} successfully.`,
            disabledStakings: updatedAdmin.disabledStakings
        });

    } catch (error) {
        console.error("Error in manageNodeStakings:", error);
        next(error);
    }
};

const changeRanks = async (req, res, next) => {
    try {

        const { userAddress, rank } = req.body;
        // const {nodeValidators} = await giveAdminSettings();
        // if(!nodeValidators) throw new Error("Didn't found node prices!");
        const onlyRanks = ranks.map((thisRank) => thisRank.rank);
        if (!onlyRanks.includes(rank)) throw new Error("Invalid rank!");

        const userDoc = await RegistrationModel.findOne({ userAddress });
        if (!userDoc) throw new Error("User not found!");

        userDoc.currentRank = rank;

        await userDoc.save();


        return res.status(200).json({ success: true, message: `Rank changed to ${rank} successfully.` });
    } catch (error) {
        next(error);
    }
}

const getDisabledStakings = async (req, res, next) => {
    try {

        const { disabledStakings } = await giveAdminSettings();


        return res.status(200).json({ success: true, disabledStakings: disabledStakings })
    } catch (error) {
        next(error);
    }
}

const login = async (req, res, next) => {
    try {
        let { walletAddress, role, password } = req.body;
        role = role?.toLowerCase()?.trim();
        if (!walletAddress || !role || !password) throw new Error("All fields are required!");
        if (!["admin", "dao", "delegator"].includes(role)) throw new Error("Invalid role!");


        const admin = await Admin.findOne({ walletAddress, role });
        if (!admin) {
            throw new Error("Admin not found with the provided wallet address and role");
        }
        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            throw new Error("Invalid password");
        }

        console.log("reached here 1111");



        const jwt = await createJwtToken({ role, walletAddress, password });

        console.log("reached here 22222");

        await Admin.findOneAndUpdate({ walletAddress, role }, { $set: { token: jwt } });
        if (isValidPassword) {
            return res.status(200).json({ success: true, token: jwt, message: "Login success", role, walletAddress });
        } else {
            throw new Error("Invalid credentials");

        }
    } catch (error) {
        next(error);
    }
}

const getAdminInfo = async (req, res, next) => {
    try {

        const { role, walletAddress } = req.adminDecodedData;

        const adminInfo = await Admin.findOne({ role, walletAddress }, { role: 1, walletAddress: 1 });
        if (!adminInfo) throw new Error("Admin info not found!");

        return res.status(200).json({ success: true, adminInfo });

    } catch (error) {
        next(error);
    }
}

const getDaoDelegators = async (req, res, next) => {
    try {
        const [daos, delegators] = await Promise.all([
            Admin.find({ role: "dao" }, { role: 1, walletAddress: 1 }),
            Admin.find({ role: "delegator" }, { role: 1, walletAddress: 1 })
        ]);
        return res.status(200).json({ success: true, daos, delegators });

    } catch (error) {
        next(error);
    }
}

const getDashboardInfo = async (req, res, next) => {
    try {
        // --- 1. Define Time Boundaries in Unix Seconds ---
        const todayStart = moment().startOf('day').unix();
        const weekStart = moment().startOf('week').unix();
        const monthStart = moment().startOf('month').unix();

        // --- 2. User Counts (Total, Today, Week, Month) ---
        const [
            totalUsers,
            todayUsers,
            weekUsers,
            monthUsers
        ] = await Promise.all([
            RegistrationModel.countDocuments({}),
            RegistrationModel.countDocuments({ time: { $gte: todayStart } }),
            RegistrationModel.countDocuments({ time: { $gte: weekStart } }),
            RegistrationModel.countDocuments({ time: { $gte: monthStart } })
        ]);

        // --- 3. Business Totals and FSR Totals (Combined Aggregation) ---
        const businessAndFsrData = await RegistrationModel.aggregate([
            {
                $group: {
                    _id: null,
                    // Business (Raw Data)
                    totalUserStake: { $sum: "$userTotalStakeInUsd" },
                    // Collect all strings for precise BigNumber calculation in JavaScript
                    allNodePurchasingBalances: { $push: "$nodePurchasingBalance" },
                    // FSR Totals
                    totalActivatedFsr: { $sum: "$activatedFsr" },
                    totalUtilizedFsr: { $sum: "$utilizedFsr" },
                }
            }
        ]);

        let totalBusinessUsd = new BigNumber(0);
        let businessFromNodePurchasingUsd = new BigNumber(0);
        let businessFromStakeUsd = new BigNumber(0);
        let totalActivatedFsr = 0;
        let totalUtilizedFsr = 0;

        if (businessAndFsrData.length > 0) {
            const data = businessAndFsrData[0];

            // 4. Business from Stake
            businessFromStakeUsd = new BigNumber(data.totalUserStake || 0);

            // 3. Business from Node Purchasing (Handling 1e18 string)
            data.allNodePurchasingBalances.forEach(balanceStr => {
                if (balanceStr && balanceStr !== "0") {
                    // Convert 1e18 string to USD by dividing by 10^18
                    const nodeBalanceUsd = new BigNumber(balanceStr).dividedBy(new BigNumber("1e18"));
                    businessFromNodePurchasingUsd = businessFromNodePurchasingUsd.plus(nodeBalanceUsd);
                }
            });

            // 2. Total Business
            totalBusinessUsd = businessFromStakeUsd.plus(businessFromNodePurchasingUsd);

            // 6. FSR Totals
            totalActivatedFsr = data.totalActivatedFsr || 0;
            totalUtilizedFsr = data.totalUtilizedFsr || 0;
        }

        // --- 5. Rankwise User Counts ---

        // Helper function for rank count aggregation with time filter
        const getRankCounts = async (matchTime) => {
            // const matchStage = matchTime ? { $match: { time: { $gte: matchTime } } } : { $match: {} }; //try toggling for fix data
            const matchStage = matchTime ? { $match: { rankAchievedAt: { $gte: matchTime } } } : { $match: {} };


            const result = await RegistrationModel.aggregate([
                matchStage,
                { $group: { _id: "$currentRank", count: { $sum: 1 } } }
            ]);

            // Convert array of objects to a single object: { "RankName": count, ... }
            return result.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {});
        };

        const [
            rankCountsTotal,
            rankCountsToday,
            rankCountsWeek,
            rankCountsMonth
        ] = await Promise.all([
            getRankCounts(null), // All time
            getRankCounts(todayStart),
            getRankCounts(weekStart),
            getRankCounts(monthStart)
        ]);

        // Format rank data for detailed breakdown and overall count
        const rankData = ranks.map(rankInfo => ({
            rank: rankInfo.rank,
            totalCount: rankCountsTotal[rankInfo.rank] || 0,
            todayCount: rankCountsToday[rankInfo.rank] || 0,
            weekCount: rankCountsWeek[rankInfo.rank] || 0,
            monthCount: rankCountsMonth[rankInfo.rank] || 0,
        }));

        // Format the overall rank counts as requested (e.g., Mentor: 4, Master: 30)
        const totalRankCountsFormatted = rankData.reduce((acc, r) => {
            acc[r.rank] = r.totalCount;
            return acc;
        }, {});

        // Final response structure
        const dashboardInfo = {
            // 1. User Counts
            totalUsers: totalUsers,
            todayRegisteredUsers: todayUsers,
            weekRegisteredUsers: weekUsers,
            monthRegisteredUsers: monthUsers,

            // 2. Total Business (String representation for BigNumber precision)
            totalBusinessUsd: totalBusinessUsd.toString(),

            // 3. Business from Node Purchasing (String representation for BigNumber precision)
            businessFromNodePurchasingUsd: businessFromNodePurchasingUsd.toString(),

            // 4. Business from Stake (String representation for BigNumber precision)
            businessFromStakeUsd: businessFromStakeUsd.toString(),

            // 5. Rankwise Counts
            rankwiseUsers: {
                // Overall rank counts in the requested format
                total: totalRankCountsFormatted,
                // Detailed breakdown including time-filtered counts
                details: rankData,
            },

            // 6. FSR Totals
            totalActivatedFsr: totalActivatedFsr,
            totalUtilizedFsr: totalUtilizedFsr,
        };

        //Here also give data for deployed nodes using myNode field from registratio schema



        return res.status(200).json({
            success: true,
            message: "Admin dashboard info fetched successfully!",
            data: dashboardInfo
        });

    } catch (error) {
        // Log the error for internal debugging
        console.error("Error fetching dashboard info:", error);
        next(error);
    }
};







const getDashboardInfo2 = async (req, res, next) => {
    try {

        // --- 1. Define Time Boundaries in Unix Seconds ---
        const todayStart = moment().startOf('day').unix();
        const weekStart = moment().startOf('week').unix();
        const monthStart = moment().startOf('month').unix();

        const { nodeValidators } = await giveAdminSettings();
        // --- 2. Fetch All Concurrent Metrics ---
        // Fetch sums/counts for All-Time, Today, Week, and Month concurrently
        const [
            allTimeMetrics,
            todayMetrics,
            weekMetrics,
            monthMetrics,
            nodeHoldingsData // 3. Node Holdings (only requires one all-time aggregation)
        ] = await Promise.all([
            getMetricsForTimeRange(null),
            getMetricsForTimeRange(todayStart),
            getMetricsForTimeRange(weekStart),
            getMetricsForTimeRange(monthStart),
            getNodeHoldingCounts()
        ]);

        // --- 3. Consolidate Data ---

        // Map Node Numbers to Node Names for the final output
        const nodeHoldingsByName = {};
        for (const nodeNum in nodeHoldingsData) {
            const nodeName = nodeValidators.find(nv => nv.nodeNum === parseInt(nodeNum))?.name;
            if (nodeName) {
                nodeHoldingsByName[nodeName] = nodeHoldingsData[nodeNum];
            }
        }

        const dashboardInfo = {
            // 1. Sum of amountUsdPaid w.r.t currency
            businessByCurrency: {
                total: { usdt: allTimeMetrics.usdtSum, dsc: allTimeMetrics.dscSum },
                today: { usdt: todayMetrics.usdtSum, dsc: todayMetrics.dscSum },
                week: { usdt: weekMetrics.usdtSum, dsc: weekMetrics.dscSum },
                month: { usdt: monthMetrics.usdtSum, dsc: monthMetrics.dscSum },
            },

            // 2. Count of incomplete payments (isPaymentCompleted: false)
            incompletePaymentCount: {
                total: allTimeMetrics.incompleteCount,
                today: todayMetrics.incompleteCount,
                week: weekMetrics.incompleteCount,
                month: monthMetrics.incompleteCount,
            },

            // 3. Last Node Holdings Count (Now using names)
            nodeHoldings: nodeHoldingsByName,

            // 4. Count of docs whose paidBy.userType is dao or delegator
            // Updated structure to show DAO and Delegator counts separately
            daoDelegatorPayments: {
                total: {
                    dao: allTimeMetrics.daoCount,
                    delegator: allTimeMetrics.delegatorCount,
                },
                today: {
                    dao: todayMetrics.daoCount,
                    delegator: todayMetrics.delegatorCount,
                },
                week: {
                    dao: weekMetrics.daoCount,
                    delegator: weekMetrics.delegatorCount,
                },
                month: {
                    dao: monthMetrics.daoCount,
                    delegator: monthMetrics.delegatorCount,
                },
            },
        };

        return res.status(200).json({
            success: true,
            message: "Admin dashboard info fetched successfully!",
            data: dashboardInfo
        });

    } catch (error) {
        // Log the error for internal debugging
        console.error("Error fetching admin node dashboard info:", error);
        next(error);
    }
}

const getDashboardInfo3 = async (req, res, next) => {
    try {

        // --- 1. Define Time Boundaries in Unix Seconds ---
        const todayStart = moment().startOf('day').unix();
        const weekStart = moment().startOf('week').unix();
        const monthStart = moment().startOf('month').unix();

        const { nodeValidators } = await giveAdminSettings();


        // --- 2. Fetch All Concurrent Metrics ---
        // Fetch all income and deployment metrics concurrently
        const [
            allTimeIncome,
            todayIncome,
            weekIncome,
            monthIncome,
            allTimeDeployments,
            todayDeployments,
            weekDeployments,
            monthDeployments
        ] = await Promise.all([
            getIncomeMetrics(null),
            getIncomeMetrics(todayStart),
            getIncomeMetrics(weekStart),
            getIncomeMetrics(monthStart),
            getNodeDeploymentCounts(null, nodeValidators),
            getNodeDeploymentCounts(todayStart, nodeValidators),
            getNodeDeploymentCounts(weekStart, nodeValidators),
            getNodeDeploymentCounts(monthStart, nodeValidators)
        ]);

        // --- 3. Consolidate Data ---
        const dashboardInfo = {
            // 1. Gap Income Sums
            gapIncome: {
                totalGapIncomeInUsd: {
                    total: allTimeIncome.gap.totalGapIncomeInUsd,
                    today: todayIncome.gap.totalGapIncomeInUsd,
                    week: weekIncome.gap.totalGapIncomeInUsd,
                    month: monthIncome.gap.totalGapIncomeInUsd,
                },
                gapIncomeInUsd: {
                    total: allTimeIncome.gap.gapIncomeInUsd,
                    today: todayIncome.gap.gapIncomeInUsd,
                    week: weekIncome.gap.gapIncomeInUsd,
                    month: monthIncome.gap.gapIncomeInUsd,
                },
                gapIncomeInDscInUsd: {
                    total: allTimeIncome.gap.gapIncomeInDscInUsd,
                    today: todayIncome.gap.gapIncomeInDscInUsd,
                    week: weekIncome.gap.gapIncomeInDscInUsd,
                    month: monthIncome.gap.gapIncomeInDscInUsd,
                },
            },

            // 2. Node Registration Income Sums
            nodeRegistrationIncome: {

                total: allTimeIncome.nodeReg.amount,
                today: todayIncome.nodeReg.amount,
                week: weekIncome.nodeReg.amount,
                month: monthIncome.nodeReg.amount,

            },

            // 3. Node Deployment Counts (by Name)
            nodeDeploymentCounts: {
                total: allTimeDeployments,
                today: todayDeployments,
                week: weekDeployments,
                month: monthDeployments,
            }
        };


        return res.status(200).json({
            success: true,
            message: "Admin dashboard info 3 fetched successfully!",
            data: dashboardInfo
        });
    } catch (error) {
        console.error("Error fetching admin dashboard info 3:", error);
        next(error);
    }
}

const getNodeDeployers = async (req, res, next) => {
    try {
        let { page = 1, limit = 10 } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;

        const skip = (page - 1) * limit;

        // Fetch paginated data
        const nodeDeployers = await NodeDeployedModel.find(
            {},
            { _id: 0, createdAt: 0, updatedAt: 0, __v: 0, block: 0 }
        )
            .skip(skip)
            .limit(limit)
            .sort({ time: -1 }) // optional: latest first
            .lean();

        // Count total documents for pagination info
        const totalRecords = await NodeDeployedModel.countDocuments();

        const result = await NodeDeployedModel.aggregate([
            {
                $group: {
                    _id: "$nodeNum",              // group by nodeNum
                    totalDeployed: { $sum: 1 }    // count how many docs per nodeNum
                }
            },
            {
                $project: {
                    _id: 0,                       // remove MongoDB's _id
                    nodeNum: "$_id",
                    totalDeployed: 1
                }
            },
            {
                $sort: { nodeNum: 1 }           // sort ascending from 1 → 9
            }
        ]);

        return res.status(200).json({
            success: true,
            message: "Data fetched for Node deployers!",
            nodeDeployers,
            totalRecords,
            page,
            limit,
            totalPages: Math.ceil(totalRecords / limit),
            count: nodeDeployers.length,
            nodeOverview: result,

        });

    } catch (error) {
        next(error);
    }
}

const getNodePricesAndRatios = async (req, res, next) => {
    try {

        const { nodeValidators } = await giveAdminSettings();
        const usdDscRatio = ratioUsdDsc();



        return res.status(200).json({ success: true, message: "Node Prices & Ratios fetched successfully!", nodeValidators, usdDscRatio });
    } catch (error) {
        next(error);
    }
}

const fsrRechargeHistory = async (req, res, next) => {
    try {
        let { page = 1, limit = 10 } = req.body; // default values
        page = parseInt(page);
        limit = parseInt(limit);

        const skip = (page - 1) * limit;

        // Get total count for pagination info
        const totalCount = await AdminRechargeFsrDelegator.countDocuments({});

        // Fetch paginated results
        const history = await AdminRechargeFsrDelegator.find({})
            .sort({ time: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Send response
        return res.status(200).json({
            success: true,
            message: "FSR recharge history fetched successfully!",
            data: history,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

const rechargeFsr = async (req, res, next) => {
    const session = await mongoose.startSession();

    try {
        let { userAddress, amount, userType = "delegator" } = req.body;

        if (!userAddress || !amount) throw new Error("All fields are required!");

        userAddress = giveCheckSummedAddress(userAddress);

        // Start transaction
        session.startTransaction();

        // 1️⃣ Update user's FSR
        const updateUserDoc = await RegistrationModel.findOneAndUpdate(
            { userAddress },
            { $inc: { currentFsr: amount } },
            { new: true, session }
        );

        if (!updateUserDoc) throw new Error("User not found!");

        // 2️⃣ Create recharge record
        const newRechargeRecord = await AdminRechargeFsrDelegator.create(
            [
                {
                    userAddress,
                    amount,
                    userType,
                    status: "completed",
                    time: moment().unix(),
                },
            ],
            { session }
        );

        // 3️⃣ Commit transaction
        await session.commitTransaction();
        session.endSession();

        console.log("--->>> New Recharge done", newRechargeRecord[0]);

        return res.status(200).json({
            success: true,
            message: `FSR recharge of ${amount} for user ${userAddress} processed successfully!`,
        });
    } catch (error) {
        // Rollback if anything fails
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

module.exports = {
    getAllUsers,
    getNodeDeployers,
    rechargeFsr,
    getNodePricesAndRatios,
    fsrRechargeHistory,
    getDashboardInfo2,
    getDaoDelegators,
    login,
    getUpgradedNodesHistory,
    manageNodeStakings,
    changeRanks,
    getDisabledStakings,
    getAdminInfo,
    getDashboardInfo,
    getDashboardInfo3
}