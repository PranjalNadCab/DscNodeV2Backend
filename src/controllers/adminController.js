const RegistrationModel = require("../models/RegistrationModel");


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
module.exports = {
    getAllUsers
}