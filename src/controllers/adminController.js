const { ranks } = require("../helpers/constant");
const { giveAdminSettings, ct, createJwtToken } = require("../helpers/helper");
const Admin = require("../models/AdminModel");
const RegistrationModel = require("../models/RegistrationModel");
const UpgradedNodes = require("../models/UpgradeNodeModel");
const bcrypt = require("bcrypt");


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

const changeRanks = async(req,res,next)=>{
    try{

        const {userAddress, rank} = req.body;
        // const {nodeValidators} = await giveAdminSettings();
        // if(!nodeValidators) throw new Error("Didn't found node prices!");
        const onlyRanks = ranks.map((thisRank)=>thisRank.rank);
        if(!onlyRanks.includes(rank)) throw new Error("Invalid rank!");

        const userDoc = await RegistrationModel.findOne({userAddress});
        if(!userDoc) throw new Error("User not found!");

        userDoc.currentRank = rank;

        await userDoc.save();


        return res.status(200).json({success:true, message:`Rank changed to ${rank} successfully.`});
    }catch(error){
        next(error);
    }
}

const getDisabledStakings = async(req,res,next)=>{
    try{

        const {disabledStakings} = await giveAdminSettings();


        return res.status(200).json({success:true, disabledStakings:disabledStakings})
    }catch(error){
        next(error);
    }
}

const login  = async(req,res,next)=>{
    try{
        const {walletAddress,role,password} = req.body;
        if(!walletAddress || !role || !password) throw new Error("All fields are required!");
        if(!["admin","dao","delegator"].includes(role)) throw new Error("Invalid role!");

        const admin = await Admin.findOne({ walletAddress,role });
        if (!admin) {
            throw new Error("Admin not found with the provided wallet address and role");
        }
        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            throw new Error("Invalid password");
        }


        const jwt = await createJwtToken({ role, walletAddress,password });
        if (isValidPassword) {
            console.log("Login success")
            return res.status(200).json({ success:true,token: jwt, message: "Login success" });
        } else {
            throw new Error("Invalid credentials");

        }
    }catch(error){
        next(error);
    }
}

module.exports = {
    getAllUsers,
    login,
    getUpgradedNodesHistory,
    manageNodeStakings,
    changeRanks,
    getDisabledStakings
}