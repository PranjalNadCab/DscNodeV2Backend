const Admin = require("../models/AdminModel");
const RegistrationModel = require("../models/RegistrationModel");
const UpgradedNodes = require("../models/UpgradeNodeModel");


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

const getUpgradedNodesHistory = async (req, res, next) => {
    try {
        let { page = 1, limit = 10, query = "", fromTime, toTime } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        const skip = (page - 1) * limit;

        // Base filter
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

        // Aggregation to join RegistrationModel and fetch uniqueRandomId
        const history = await UpgradedNodes.aggregate([
            { $match: filter },
            { $sort: { time: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "registration", // collection name in MongoDB
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
                },
            },
        ]);

        // Count total records (without pagination)
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
            throw new Error("Invalid action type")
        }

        if (typeof status !== "boolean") {
           throw new Error("Invalid status type")
        }

        // Fetch the admin document (assuming only one admin document exists)
        let admin = await Admin.findOne();
        if (!admin) {
            // If no admin document exists, create a default one
           throw new Error("Admin document not found");
        }

        // Update disabledStakings
        const index = admin.disabledStakings.indexOf(action);

        if (status === false && index === -1) {
            // Disable the staking type → add to disabledStakings
            admin.disabledStakings.push(action);
        } else if (status === true && index !== -1) {
            // Enable the staking type → remove from disabledStakings
            admin.disabledStakings.splice(index, 1);
        }

        await admin.save();

        res.status(200).json({
            success: true,
            message: `Staking ${action} has been ${status ? "enabled" : "disabled"} successfully.`,
            disabledStakings: admin.disabledStakings
        });
    } catch (error) {
        next(error);
    }
};
module.exports = {
    getAllUsers,
    getUpgradedNodesHistory,
    manageNodeStakings
}