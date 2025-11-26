const RegistrationModel = require("../models/RegistrationModel");
const { web3 } = require("../web3/web3")
const BigNumber = require("bignumber.js");
const { ranks, gapIncome, ratioUsdDsc } = require("./constant");
const GapIncomeModel = require("../models/GapIncomeModel");
const moment = require("moment");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const AdminModel = require("../models/AdminModel");
const Admin = require("../models/AdminModel");
const DscNodeBlockConfig = require("../models/DscNodeBlockConfig");
const UpgradedNodes = require("../models/UpgradeNodeModel");
const NodeConverted = require("../models/NodeDeployedModel");
const { default: mongoose } = require("mongoose");
const RoiModel = require("../models/RoiModel");
const NodeRegIncomeModel = require("../models/NodeRegIncomeModel");
const jwt = require("jsonwebtoken");
const { getDaoAndDelegator } = require("./adminHelper");
const { default: axios } = require("axios");
const NbdFundModel = require("../models/NbdFundsModel");
const AssuranceFeeModel = require("../models/AssuranceFeeModel");


const createJwtToken = async (data) => {
    console.log(data)
    const payload = {
        accountDetail: { ...data }
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "25d"
    });
    // console.log("token in middlewart isss", token)
    return token;
}


const setLatestBlock = async () => {
    try {
        let latestBlock = await web3.eth.getBlockNumber();
        latestBlock = Number(latestBlock);

        const updated = await DscNodeBlockConfig.updateOne(
            {}, // match condition (empty = match first/any)
            { $set: { lastSyncBlock: latestBlock.toString() } },
            { upsert: true } // ensures doc is created if not exists
        );

        console.log("----->> updated to latest block ------", updated);
    } catch (error) {
        console.log(error);
    }
};

const ct = (payload) => {
    console.table(payload);
};

const generateDefaultAdminDoc = async () => {
    try {
        const existingAdmin = await AdminModel.findOne({ role: "admin" });
        if (!existingAdmin) {
            const defaultAdmin = new AdminModel({
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
                role: "admin",
                walletAddress: process.env.ADMIN_ADDRESS,
                password: process.env.ADMIN_PASSWORD
            });
            await defaultAdmin.save();
            console.log("Default admin document created.");
        } else {
            console.log("Admin document already exists.");
        }
    } catch (error) {
        console.log("Error creating default admin document:", error);
    }
}




const giveCheckSummedAddress = (address) => {

    return web3.utils.toChecksumAddress(address);
}



function giveVrsForStaking(user, amountInUsdIn1e18, currency, rateDollarPerDsc, mixTxHash, totalAmountInUsdIn1e18, hash, currNonce) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: currNonce,
                user: user,
                amountInUsdIn1e18,
                currency,
                mixTxHash,
                rateDollarPerDsc,
                totalAmountInUsdIn1e18
            };
            console.log({ data })


            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function giveVrsForMixStaking(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, nonce) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce
            ct({ amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, nonce })

            const data = {
                hash: hash,
                nonce: nonce,
                user: user,
                amountDscInUsdIn1e18,
                amountDscIn1e18,
                amountUsdtIn1e18,
                priceDscInUsdIn1e18
            };
            console.log({ data })


            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function giveVrsForWithdrawIncomeUsdt(amountUsdtIn1e18, user, hash, nonce, amountUsdtIn1e18AfterDeduction) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: nonce,
                user: user,
                amountUsdtIn1e18,
                amountUsdtIn1e18AfterDeduction,
            };



            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function giveVrsForWithdrawIncomeDsc(amountDscInUsdIn1e18, amountDscIn1e18, priceDscInUsdIn1e18, user, hash, nonce, amountDscInUsdIn1e18AfterDeduction, amountDscIn1e18AfterDeduction) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce
            ct({ amountDscInUsdIn1e18, amountDscIn1e18, priceDscInUsdIn1e18, user, hash, nonce })

            const data = {
                hash: hash,
                nonce: nonce,
                user: user,
                amountDscInUsdIn1e18,
                amountDscIn1e18,
                priceDscInUsdIn1e18,
                amountDscInUsdIn1e18AfterDeduction,
                amountDscIn1e18AfterDeduction
            };



            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function giveVrsForNodeUpgradation(userAddress, amountToDeduct, nodeNum, totalAmountInUsdIn1e18, mixTxHash, rateDollarPerDsc, currNonce, hash) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: currNonce,
                userAddress: userAddress,
                nodeNum,
                totalAmountInUsdIn1e18,
                mixTxHash,
                amountToDeduct,
                rateDollarPerDsc
            };



            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function giveVrsForNodeDeployment(userAddress, nodeNum, currNonce, hash) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: currNonce,
                userAddress: userAddress,
                nodeNum
            };



            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function giveVrsForNodeConversion(userAddress, nodeNum, currNonce, hash) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: currNonce,
                userAddress: userAddress,
                nodeNum,
            };



            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function giveVrsForActivatingFsr(userAddress, dscAmountInUsdIn1e18, activationAmountIn1e18, generatedDscIn1e18, priceInUsdIn1e18, currNonce, hash) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: currNonce,
                userAddress: userAddress,
                activationAmountIn1e18,
                generatedDscIn1e18,
                priceInUsdIn1e18,
                dscAmountInUsdIn1e18
            };

            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function generateVrsForSponsorTx(userAddress, spnosoredTxHash, remainingDscInUsdToPay, rateDollarPerDsc, currNonce, hash, sponsoredUserAddress) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("lkasd-----fgsdf", sponsoredUserAddress)
            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: currNonce,
                userAddress: userAddress,
                spnosoredTxHash,
                remainingDscInUsdToPay,
                rateDollarPerDsc,
                sponsoredUserAddress
            };

            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

function generateVrsForAssuranceIncome(userAddress, amountDscIn1e18, action, currNonce, hash) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: currNonce,
                userAddress: userAddress,
                action,
                amountDscIn1e18
            };



            const account = web3.eth.accounts.privateKeyToAccount(
                process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
            );

            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;
            const signature = await web3.eth.sign(hash, account.address);
            data["signature"] = signature;

            resolve({ ...data });
        } catch (e) {
            console.log(e, "Error in signmessage");
            resolve(false);
        }
    });
}

const updateTeamCount = async (userAddress) => {
    try {


        const pipeline = [
            {
                $match: { userAddress },
            },
            {
                $graphLookup: {
                    from: "registration",
                    startWith: "$userAddress",
                    connectFromField: "sponsorAddress",
                    connectToField: "userAddress",
                    as: "upline",
                    maxDepth: 100000000,
                    depthField: "level",
                },
            },
            {
                $unwind: "$upline",
            },
            {
                $match: { "upline.level": { $gt: 0 } }, // Exclude the root user (level 0)
            },
            {
                $project: {
                    _id: 0,
                    userAddress: "$upline.userAddress",
                    level: "$upline.level",
                },
            },
        ];
        const uplineData = await RegistrationModel.aggregate(pipeline);
        if (uplineData.length > 0) {
            const uplineUsers = uplineData.map((upline) => upline.userAddress);
            await RegistrationModel.updateMany(
                { userAddress: { $in: uplineUsers } },
                { $inc: { teamCount: 1 } }
            );
            console.log("team count updated in register event");
        }
    } catch (error) {
        console.log(error, "in updateTeamCount");
    }
};

const updateDirectCount = async (sponsorAddress) => {
    try {

        const sponsorUpdate = await RegistrationModel.findOneAndUpdate(
            { userAddress: sponsorAddress },
            { $inc: { directCount: 1 } },
            { upsert: true, new: true }
        );

        console.log("sponsorUpdate", sponsorUpdate);
    } catch (error) {
        console.log(error, "in updateDirectCount");
    }
};

const updateDirectBusiness = async (totalStakeAmountInUsd, userAddress) => {
    try {

        const totalStakeAmountInUsdNormal = new BigNumber(totalStakeAmountInUsd).dividedBy(1e18).toNumber();
        const originalUser = await RegistrationModel.findOne({
            userAddress: userAddress,
        });
        if (!originalUser) {
            console.log(error);
            return;
        }

        const sponsorDoc = await RegistrationModel.findOne({
            userAddress: originalUser.sponsorAddress,
        });
        console.log("---------------", sponsorDoc);
        if (!sponsorDoc) {
            return;
        }
        let oldUserDirectPlusSelfStakeInUsd = sponsorDoc.userDirectPlusSelfStakeInUsd;
        let newUserDirectPlusSelfStakeInUsd = oldUserDirectPlusSelfStakeInUsd + totalStakeAmountInUsdNormal;


        let sponsorDirectBusiness = sponsorDoc.directStaking;
        sponsorDirectBusiness = sponsorDirectBusiness + totalStakeAmountInUsdNormal;
        const sponsorUpdate = await RegistrationModel.findOneAndUpdate(
            { userAddress: originalUser.sponsorAddress },
            { $set: { directStaking: sponsorDirectBusiness, userDirectPlusSelfStakeInUsd: newUserDirectPlusSelfStakeInUsd } },
            { upsert: true, new: true }
        );

        console.log("sponsorUpdate", sponsorUpdate);
    } catch (error) {
        console.log(error, "in updateDirectBusiness");
    }
};

const registerUser = async (userAddress, time, sponsorAddress, regAmount, block, transactionHash) => {
    try {
        const user = await RegistrationModel.findOne({ userAddress });
        if (!user) {
            const { userType } = await giveUserType(userAddress);
            let currentFsr = 0;
            if (userType === "delegator") {
                currentFsr = 300000
            }
            const uniqueRandomId = await generateRandomId();
            const newUser = await RegistrationModel.create({
                uniqueRandomId: uniqueRandomId,
                userAddress,
                sponsorAddress,
                time: Number(time),
                currentRank: "Beginner",
                nodePurchasingBalance: regAmount,
                block: Number(block),
                transactionHash,
                userType,
                currentFsr
            });

            await updateTeamCount(userAddress);
            await updateDirectCount(sponsorAddress);
            return newUser;
            // await updateDirectBusiness(0, userAddress); // Assuming initial stake amount is 0
        }
    } catch (error) {
        console.error("Error registering user:", error);
        throw error;
    }
}

const createDefaultOwnerRegDoc = async () => {
    try {
        const defaultOwnerAddress = process.env.DEFAULT_OWNER_ADDRESS;
        if (!defaultOwnerAddress) {
            throw new Error("Default owner address is not set in environment variables.");
        }

        const existingOwner = await RegistrationModel.findOne({ userAddress: defaultOwnerAddress });
        if (!existingOwner) {
            await RegistrationModel.create({
                userAddress: defaultOwnerAddress,
                sponsorAddress: "0x0000000000000000000000000000000000000000",
                uniqueRandomId: "000000",
                teamCount: 0,
                directCount: 0,
                currentRank: ranks[0].rank,
                time: Math.floor(Date.now() / 1000)
            });
            console.log("Default owner document created successfully.");
        } else {
            console.log("Default owner document already exists.");
        }
    } catch (error) {
        console.log(error, "Error creating default owner document");
    }
}

const updateUserTotalSelfStakeUsdt = async (userAddress, totalStakeAmountInUsd) => {
    try {
        let totalStakeAmountInUsdNormal = new BigNumber(totalStakeAmountInUsd).dividedBy(1e18).toNumber();
        const userDoc = await RegistrationModel.findOne({ userAddress: userAddress });
        if (!userDoc) {
            console.log("User not found for address:", userAddress);
            return;
        }
        let oldStakedAmount = userDoc.userTotalStakeInUsd;
        let newStakedAmount = oldStakedAmount + totalStakeAmountInUsdNormal;

        let oldUserDirectPlusSelfStakeInUsd = userDoc.userDirectPlusSelfStakeInUsd;
        let newUserDirectPlusSelfStakeInUsd = oldUserDirectPlusSelfStakeInUsd + totalStakeAmountInUsdNormal;

        const updatedUser = await RegistrationModel.findOneAndUpdate(
            { userAddress: userAddress },
            { $set: { userTotalStakeInUsd: newStakedAmount, userDirectPlusSelfStakeInUsd: newUserDirectPlusSelfStakeInUsd } },
            { new: true }
        );

        if (!updatedUser) {
            console.log("Failed to update user total stake in USD for address:", userAddress);
        } else {
            console.log("User total stake in USD updated successfully for address:", userAddress);
        }

    } catch (error) {
        console.log(error, "Error in updateUserTotalStakeUsdt");
    }


}

const getDirectsNodeBalanceSum = async (fUserAddress) => {
    try {
        // 1️⃣ Get all directs for a user
        const userDirects = await RegistrationModel.find({ sponsorAddress: fUserAddress }, { nodePurchasingBalance: 1 });

        // 2️⃣ Sum balances using BigNumber
        let totalBalance = new BigNumber(0);

        userDirects.forEach((user) => {
            const balanceStr = user.nodePurchasingBalance || "0";
            totalBalance = totalBalance.plus(new BigNumber(balanceStr));
        });

        // 3️⃣ Convert from wei (1e18) to normal number (like ether)
        const totalInNormal = totalBalance.dividedBy(1e18).toNumber();

        console.log(`Total Node Purchasing Balance for ${fUserAddress}:`, totalInNormal);

        return totalInNormal;
    } catch (err) {
        console.error("Error fetching directs' nodePurchasingBalance sum:", err);
        return 0;
    }
};

const manageRank = async (userAddress) => {
    try {
        if (!userAddress) return;
        let rankDuringStaking = null;
        const fUserAddress = giveCheckSummedAddress(userAddress);
        const userInfo = await RegistrationModel.findOne({ userAddress: fUserAddress });
        if (!userInfo) return { rankDuringStaking };
        const directsNodeSums = await getDirectsNodeBalanceSum(fUserAddress);

        let nodePurchasingBalance = new BigNumber(userInfo.nodePurchasingBalance).dividedBy(1e18);

        const userDirectPlusSelfStakeInUsdNormal = userInfo.userDirectPlusSelfStakeInUsd;
        // const userTargetStakeForRankUpgradation = new BigNumber(userDirectPlusSelfStakeInUsdNormal).plus(nodePurchasingBalance).plus(directsNodeSums).toNumber();
        const userTargetStakeForRankUpgradation = new BigNumber(userDirectPlusSelfStakeInUsdNormal).toNumber();

        const matchedRank = ranks.find(r => userTargetStakeForRankUpgradation >= r.lowerBound && userTargetStakeForRankUpgradation <= r.upperBound) || ranks[0];
        console.log("matchedRank", matchedRank);
        // ct({ userAddress, userDirectPlusSelfStakeInUsdNormal, rank: matchedRank.rank });

        const currTimeInUnix = moment().unix();

        const currentRankGrade = ranks.find(r => r.rank === userInfo.currentRank)?.grade || 1;
        const matchedRankGrade = matchedRank ? matchedRank.grade : 1;

        if (matchedRank && (matchedRank.rank !== userInfo.currentRank) && (matchedRankGrade > currentRankGrade)) {
            const updatedUser = await RegistrationModel.findOneAndUpdate(
                { userAddress: fUserAddress },
                { $set: { currentRank: matchedRank.rank, rankAchievedAt: currTimeInUnix } },
                { new: true }
            );
            if (!updatedUser) {
                console.log("Failed to update user rank for address:", fUserAddress);
            } else {
                console.log("User rank updated successfully for address:", fUserAddress);
            }
        }
    } catch (error) {
        console.log(error, "Error in manageRank");
    }
}
const giveGapIncome = async (senderAddress, stakingAmountIn1e18, rankDuringStaking = null, usdtStakedIn1e18, dscStakedInUsdtIn1e18, incomeType, rateDollarPerDscInNum, nodeNum) => {
    try {

        senderAddress = giveCheckSummedAddress(senderAddress);
        if (!senderAddress || !stakingAmountIn1e18) {
            throw new Error("Sender address and staking amount are required.");
        }

        const senderDoc = await RegistrationModel.findOne({ userAddress: senderAddress });
        if (!senderDoc) {
            throw new Error("Sender not found. Please register first.");
        }

        const amountToDistribute = new BigNumber(stakingAmountIn1e18).multipliedBy(0.18).toFixed(0); // 18% of the staking amount
        if (amountToDistribute <= 0) {
            throw new Error("Invalid amount to distribute.");
        }

        const userUpline = await RegistrationModel.aggregate([
            {
                $match: {
                    userAddress: senderAddress
                }
            },
            {
                $graphLookup: {
                    from: "registration",
                    startWith: "$userAddress",
                    connectFromField: "sponsorAddress",
                    connectToField: "userAddress",
                    as: "upline",
                    maxDepth: 100000000,
                    depthField: "level"
                }
            },
            {
                $unwind: "$upline"
            },
            {
                $match: { "upline.level": { $gt: 0 } } // Exclude the root user (level 0)
            },
            {
                $project: {
                    _id: 0,
                    userAddress: "$upline.userAddress",
                    currentRank: "$upline.currentRank",
                    level: "$upline.level"
                }
            }, {
                $sort: { level: 1 } // Sort by level in ascending order
            }
        ]);

        console.log("userUpline", userUpline);

        const senderGrade = rankDuringStaking ? ranks.find(r => r.rank === rankDuringStaking)?.grade : 0;

        let higherRankUsers = userUpline.filter(u => {
            const userGrade = ranks.find(r => r.rank === u.currentRank)?.grade;
            return userGrade >= senderGrade;
        });


        let uniqueRankUsers = [];
        let seenRanks = new Set();


        for (let user of higherRankUsers) {
            if (!seenRanks.has(user.currentRank)) {
                // Check if there are other users with same rank but lower level
                const sameRankUsers = higherRankUsers.filter(
                    u => u.currentRank === user.currentRank
                );
                const minLevelUser = sameRankUsers.reduce((min, curr) =>
                    curr.level < min.level ? curr : min
                );
                uniqueRankUsers.push(minLevelUser);
                seenRanks.add(user.currentRank);
            }
        }

        let assignedPercent = 0;
        let percentDistributed = 0;
        let currentRank = rankDuringStaking;

        const dscPrice = await LivePriceDsc.findOne({}).sort({ time: -1 });

        let docsToInsert = [];
        const bulkRegOps = [];
        const lastPackagePercent = gapIncome["Mentor"]; // 18% of the total amount to distribute
        const currTime = moment().unix();
        let count = 0;
        for (let user of uniqueRankUsers) {
            count++;
            assignedPercent = gapIncome[user.currentRank];
            if (percentDistributed >= lastPackagePercent) { ct({ status: "Limit reached", lastPackagePercent, percentDistributed, userId: user.userAddress }); break; }
            const percentToDistribute = Number(new BigNumber(assignedPercent).minus(new BigNumber(percentDistributed)));
            const gapIncomeGenerated = new BigNumber(stakingAmountIn1e18).multipliedBy(percentToDistribute).toFixed();

            const { usdt, tokenUsd, tokenUnits } = splitByRatio(gapIncomeGenerated, usdtStakedIn1e18, dscStakedInUsdtIn1e18, dscPrice?.price);
            docsToInsert.push({
                receiverAddress: user.userAddress,
                receiverRank: user.currentRank,
                forNodeNum: Number(nodeNum),
                senderAddress: senderAddress,
                senderRank: rankDuringStaking,
                totalGapIncomeInUsd: gapIncomeGenerated,
                senderTotalStakedUsd: Number(
                    new BigNumber(stakingAmountIn1e18).dividedBy(1e18).toFixed(4)
                ) || 0,
                gapIncomeInUsd: usdt,
                gapIncomeInDsc: tokenUnits,
                gapIncomeInDscInUsd: tokenUsd,
                dscPrice: rateDollarPerDscInNum || 0,
                percentReceived: percentToDistribute,
                time: currTime,
                stakingAmountInUsd: new BigNumber(stakingAmountIn1e18)
                    .dividedBy(1e18)
                    .toFixed(),
                transactionHash: null,
                blockNumber: null,
                incomeType: incomeType || "stake",
                isLapsed: false
            });

            const regDoc = await RegistrationModel.findOne({ userAddress: user.userAddress });

            const newDscIncomeWallet = new BigNumber(regDoc.dscIncomeWallet || "0").plus(tokenUnits).toFixed(0);
            const newUsdtIncomeWallet = new BigNumber(regDoc.usdtIncomeWallet || "0").plus(usdt).toFixed(0);
            const newTotalIncomeDsc = new BigNumber(regDoc.totalIncomeDscReceived || "0").plus(tokenUnits).toFixed(0);
            const newTotalIncomeUsdt = new BigNumber(regDoc.totalIncomeUsdtReceived || "0").plus(usdt).toFixed(0);
            const dscIncomeInUsdWallet = new BigNumber(regDoc.dscIncomeInUsdWallet || "0").plus(tokenUsd).toFixed(0);
            const totalIncomeDscInUsdReceived = new BigNumber(regDoc.totalIncomeDscInUsdReceived || "0").plus(tokenUsd).toFixed(0);


            bulkRegOps.push({
                updateOne: {
                    filter: { userAddress: user.userAddress },
                    update: {
                        $set: {
                            dscIncomeWallet: newDscIncomeWallet,
                            dscIncomeInUsdWallet: dscIncomeInUsdWallet,
                            usdtIncomeWallet: newUsdtIncomeWallet,
                            totalIncomeDscReceived: newTotalIncomeDsc,
                            totalIncomeDscInUsdReceived: totalIncomeDscInUsdReceived,
                            totalIncomeUsdtReceived: newTotalIncomeUsdt,
                        }
                    }
                }
            })
            ct({
                uid: "jkr674",
                count,
                status: "Distributing gap income",
                receiverAddress: user.userAddress,
                receiverRank: user.currentRank,
                senderAddress: senderAddress,
                senderRank: rankDuringStaking,
                gapIncomeGenerated,
                percentToDistribute,
                percentDistributed
            });
            currentRank = user.currentRank;
            percentDistributed = percentDistributed + percentToDistribute;

        }
        if (docsToInsert.length > 0) {
            await GapIncomeModel.insertMany(docsToInsert);
            await RegistrationModel.bulkWrite(bulkRegOps);
            ct({ uid: "344sds32q", message: "Gap income distributed successfully", docsCount: docsToInsert.length, senderAddress, currentRank, totalDistributed: percentDistributed });
        }
    } catch (error) {
        console.error("Error in giveGapIncome:", error);
    }
}

function splitByRatio(total, ratioUsdt, ratioDscInUsd, tokenPrice = null) {

    let totalStakesInUsdInBig = new BigNumber(total);
    let ratioUsdtInBig = new BigNumber(ratioUsdt);
    let ratioDscInBig = new BigNumber(ratioDscInUsd);
    let tokenPriceInBig = tokenPrice ? new BigNumber(tokenPrice) : null;
    // const part = total / (ratioUsdt + ratioDsc);
    const part = totalStakesInUsdInBig.dividedBy(ratioUsdtInBig.plus(ratioDscInBig));

    const usdt = ratioUsdtInBig.multipliedBy(part).toFixed(0);
    const tokenUsd = ratioDscInBig.multipliedBy(part).toFixed(0);
    const tokenUnits = tokenPriceInBig ? new BigNumber(tokenUsd).dividedBy(tokenPriceInBig).toFixed() : null;
    ct({ uid: "589jkd34", total, ratioUsdt, ratioDscInUsd, part: part.toFixed(0), usdt, tokenUsd, tokenUnits });
    return { usdt, tokenUsd, tokenUnits };
}

const updateUserNodeInfo = async (user, nodeNum, time) => {
    try {
        if (!user || !nodeNum || !time) return;

        const getUserDoc = await RegistrationModel.findOne({ userAddress: user });
        if (!getUserDoc) { console.log(`Invalid user address ${user}`); return };

        let purchasedNodes = getUserDoc.purchasedNodes || [];



        const adminDoc = await AdminModel.findOne({ role: "admin" });
        if (!adminDoc) {
            console.log("Admin doc not found");
            return;
        }
        const nodeInfo = adminDoc.nodeValidators.find(n => n.nodeNum === nodeNum);
        console.log("----------->>>>>", nodeInfo, adminDoc)
        if (!nodeInfo) {
            console.log(`Invalid node name ${nodeInfo.name}`);
            return;
        }
        // purchasedNodes.push({
        //     nodeName: nodeInfo.name,
        //     purchasedAt: time,
        //     reward: nodeInfo.reward,
        //     nodeConversionTime: moment().unix()
        // });
        const myNode = {
            nodeName: nodeInfo.name,
            deployedAt: time,
            nodeNum: nodeNum,
        }

        const updatedUser = await RegistrationModel.findOneAndUpdate(
            { userAddress: user },
            {
                $set: {
                    myNode: myNode
                }
            }

        );

        const currentMonthName = moment.unix(time).format("MMMM");
        const updateConvertedNode = await NodeConverted.updateOne(
            { userAddress: user, nodeNum },
            { $set: { baseMinValue: nodeInfo.selfStaking, baseMinAss: nodeInfo.baseMinAss, conversionMonth: currentMonthName } },
            { upsert: true }
        )

        if (!updatedUser) {
            console.log(`Failed to update user ${user} node info`);
        }
        else {
            console.log(`User ${user} node info updated successfully`);
        }


    } catch (error) {
        console.log(error);
    }
}

const manageUserWallet = async (user, amountInUsdt = null, amountInDsc = null) => {
    try {



        if (!user) return;
        const fUser = giveCheckSummedAddress(user);
        const userDoc = await RegistrationModel.findOne({ userAddress: fUser });
        if (!userDoc) {
            console.log("User not found for address:", fUser);
            return;
        }

        let newDscIncomeWallet = userDoc.dscIncomeWallet || "0";
        let newUsdtIncomeWallet = userDoc.usdtIncomeWallet || "0";

        if (amountInUsdt && Number(amountInUsdt) > 0) {
            newUsdtIncomeWallet = new BigNumber(newUsdtIncomeWallet).minus(new BigNumber(amountInUsdt)).toFixed(0);
        }

        if (amountInDsc && Number(amountInDsc) > 0) {
            newDscIncomeWallet = new BigNumber(newDscIncomeWallet).minus(new BigNumber(amountInDsc)).toFixed(0);
        }

        const updatedUser = await RegistrationModel.findOneAndUpdate(
            { userAddress: fUser },
            { $set: { dscIncomeWallet: newDscIncomeWallet, usdtIncomeWallet: newUsdtIncomeWallet } },
            { new: true }
        );

        if (!updatedUser) {
            console.log("Failed to update user wallet for address:", fUser);
        } else {
            console.log("User wallet updated successfully for address:", fUser);
        }
    } catch (error) {
        console.log(error);
    }
}

//only for dsc income
const manageUserWalletForDsc = async (user, amountInUsd) => {
    try {



        if (!user) return;
        const fUser = giveCheckSummedAddress(user);
        const userDoc = await RegistrationModel.findOne({ userAddress: fUser });
        if (!userDoc) {
            console.log("User not found for address:", fUser);
            return;
        }

        let newDscIncomeInUsdWallet = userDoc.dscIncomeInUsdWallet || "0";


        if (amountInUsd && Number(amountInUsd) > 0) {
            newDscIncomeInUsdWallet = new BigNumber(newDscIncomeInUsdWallet).minus(new BigNumber(amountInUsd)).toFixed(0);
        }

        ct({ uid: "jkr674", newDscIncomeInUsdWallet, user })
        const updatedUser = await RegistrationModel.findOneAndUpdate(
            { userAddress: fUser },
            { $set: { dscIncomeInUsdWallet: newDscIncomeInUsdWallet } },
            { new: true }
        );

        if (!updatedUser) {
            console.log("Failed to update user wallet for address:", fUser);
        } else {
            console.log("User wallet updated successfully for address:", fUser);
        }
    } catch (error) {
        console.log(error);
    }
}

const generateRandomId = async () => {
    try {
        let newRandomId;
        let isUnique = false;

        while (!isUnique) {
            newRandomId = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit random ID

            // Check if ID exists in the database
            const existingUser = await RegistrationModel.findOne(
                { uniqueRandomId: newRandomId },
                { _id: 1 }
            );

            if (!existingUser) {
                isUnique = true;
            }
        }

        return newRandomId;
    } catch (error) {
        console.error("Error generating unique random ID:", error);
        throw new Error("Failed to generate unique random ID");
    }
};

const giveAdminSettings = async () => {
    try {

        const { withdrawDeductionPercent = null, nodeValidators = null, stakeRatio = null, disabledStakings = [] } = await Admin.findOne({ role: "admin" });



        return { withdrawDeductionPercent, nodeValidators, stakeRatio, disabledStakings }

    } catch (error) {
        console.log(error);
        return { withdrawDeductionPercent: null, nodeValidators: null, stakeRatio: null, disabledStakings: [] }
    }
}

const validateStake = (amountUsdt, amountDscInUsd, totalUsdStake, currRatio) => {
    const total = new BigNumber(totalUsdStake);

    // expected fixed USDT portion
    const requiredUsdt = total.multipliedBy(currRatio.usd).dividedBy(100);
    // max DSC allowed
    const maxDsc = total.multipliedBy(currRatio.dsc).dividedBy(100);

    if (!new BigNumber(amountUsdt).isEqualTo(requiredUsdt)) {
        return { status: false, message: `amountUsdt must be exactly ${requiredUsdt.toString()}` }
    }


    if (new BigNumber(amountDscInUsd).isLessThan(0)) {
        return { status: false, message: `amountDscInUsd cannot be negative` }
    }

    if (new BigNumber(amountDscInUsd).isGreaterThan(maxDsc)) {
        return { status: false, message: `amountDscInUsd cannot be more than ${maxDsc.toString()}` }
    }

    return { status: true, message: "Valid stake amounts" };
};

const validateUpgradeNodeConditions = (totalAmountInUsd, amountInUsd, currency, amountToDeduct, nodePurchasingBalance, lastNode, nodeValidators, nodeNum) => {
    if (!totalAmountInUsd || !amountInUsd || !currency || !amountToDeduct) {
        return { status: false, message: "Invalid parameters" }
    }
    console.log("sdjkl;gl;sdhnrrtgsdry", nodeValidators)
    const selectedNode = nodeValidators.find((item) => item.nodeNum === Number(nodeNum));
    const nodePriceInBn = new BigNumber(selectedNode);

    if (!lastNode) {

        if (currency === "USDT" && (totalAmountInUsd !== amountInUsd)) return { status: false, message: `Please send $${new BigNumber(selectedNode.selfStaking).dividedBy(1e18)} for upgrading this node!` }
    }


    if (currency === "DSC" && amountInUsd !== totalAmountInUsd) {
        return { status: false, message: "For first time node upgrade, if you are paying in DSC, you need to pay full amount in DSC." }
    } else if (currency === "USDT" && amountInUsd !== totalAmountInUsd) {
        return { status: false, message: "For first time node upgrade, if you are paying in USDT, you need to pay full amount in USDT." }
    } else {
        return { staus: true, message: "Proceed" }
    }
}

const giveUsdDscRatioParts = (totalAmountInUsdIn1e18) => {
    const { usd: expectedUsdRatio, dsc: expectedDscRatio } = ratioUsdDsc();

    ct({ usd: expectedUsdRatio, dsc: expectedDscRatio });

    // Convert to BigNumber
    const totalUsd = new BigNumber(totalAmountInUsdIn1e18);

    if (totalUsd.isZero()) {
        throw new Error("Total amount cannot be zero");
    }


    const usdRatioAmount = totalUsd.multipliedBy(expectedUsdRatio).dividedBy(100);
    const dscRatioAmount = totalUsd.multipliedBy(expectedDscRatio).dividedBy(100);

    ct({ usdRatioAmount: usdRatioAmount.toFixed(), dscRatioAmount: dscRatioAmount.toFixed() })


    console.log("Calculated Ratios:", {
        usd: usdRatioAmount.toString(),
        dsc: dscRatioAmount.toString()
    });



    return { usd: usdRatioAmount.toFixed(), dsc: dscRatioAmount.toFixed() };
};

function getRemainingDscToPayInUsd(totalAmountInUsd, userNodes, nodeNum, rateDollarPerDsc) {
    const totalUsd = new BigNumber(totalAmountInUsd); // in 1e18
    const rate = new BigNumber(rateDollarPerDsc);     // in 1e18

    // 1. Find how much was paid in USDT (for this node)
    const usdtPaidUsd = userNodes
        .filter(item => item.nodeNum === nodeNum && item.currency === "USDT")
        .reduce((sum, item) => sum.plus(new BigNumber(item.amountUsdPaid)), new BigNumber(0));

    // 2. Calculate DSC obligation (in USD terms)
    const dscObligationUsd = totalUsd.minus(usdtPaidUsd);

    if (dscObligationUsd.lte(0)) {
        return new BigNumber(0); // nothing owed in DSC
    }

    // 3. Find DSC already paid (in USD terms)
    const dscPaidUsd = userNodes
        .filter(item => item.nodeNum === nodeNum && item.currency === "DSC")
        .reduce((sum, item) => sum.plus(new BigNumber(item.amountUsdPaid)), new BigNumber(0));

    // 4. Remaining DSC in USD
    const remainingUsd = dscObligationUsd.minus(dscPaidUsd);
    if (remainingUsd.lte(0)) {
        return new BigNumber(0); // fully paid
    }

    // 5. Convert USD to DSC tokens
    const remainingDscTokens = remainingUsd.dividedBy(rate).multipliedBy(1e18);

    return remainingUsd; // DSC amount (1e18 precision)
}

const getRemainingDscUsdToPayForStaking = (totalAmountInUsd, userStakes) => {
    const totalUsd = new BigNumber(totalAmountInUsd); // in 1e18

    // 1. USDT paid (USD terms)
    const usdtPaidUsd = userStakes
        .filter(item => item.currency === "USDT")
        .reduce((sum, item) => sum.plus(new BigNumber(item.amountUsdPaid || "0")), new BigNumber(0));

    // 2. DSC obligation = total - USDT paid
    const dscObligationUsd = totalUsd.minus(usdtPaidUsd);

    if (dscObligationUsd.lte(0)) {
        return new BigNumber(0); // nothing owed in DSC
    }

    // 3. Already paid in DSC (USD terms)
    const dscPaidUsd = userStakes
        .filter(item => item.currency === "DSC")
        .reduce((sum, item) => sum.plus(new BigNumber(item.amountUsdPaid || "0")), new BigNumber(0));

    // 4. Remaining DSC obligation in USD terms
    const remainingUsd = dscObligationUsd.minus(dscPaidUsd);

    return remainingUsd.lte(0) ? new BigNumber(0) : remainingUsd;
}

const sendNodeRegIncomeToUpline = async (senderAddress, majorIncome, minor4Income, time, amountNbdPaid, nodeNum) => {
    try {
        if (!senderAddress || (!majorIncome && !minor4Income)) return { status: false, message: "Invalid parameters" };
        senderAddress = giveCheckSummedAddress(senderAddress);
        const senderUpline = await RegistrationModel.aggregate([
            { $match: { userAddress: senderAddress } },
            {
                $graphLookup: {
                    from: "registration",
                    startWith: "$userAddress",
                    connectFromField: "sponsorAddress",
                    connectToField: "userAddress",
                    as: "upline",
                    maxDepth: 5,
                    depthField: "level"
                }
            },
            { $unwind: "$upline" },
            {
                $match: {
                    "upline.level": { $gt: 0 },                // ✅ exclude root
                    "upline.userAddress": { $ne: senderAddress } // ✅ double safety
                }
            },
            {
                $project: {
                    _id: 0,
                    userAddress: "$upline.userAddress",
                    currentRank: "$upline.currentRank",
                    level: "$upline.level"
                }
            },
            { $sort: { level: 1 } }
        ]);
        console.log("senderUpline", senderUpline);

        const major = new BigNumber(majorIncome || "0");
        const minor = new BigNumber(minor4Income || "0");

        // Split minor into 4 equal parts
        const part = minor.dividedBy(4);

        // Map slots → level
        const slots = {
            1: major, // level 1 → majorIncome
            2: part,  // level 2 → 1st part
            3: part,  // level 3 → 2nd part
            4: part,  // level 4 → 3rd part
            5: part   // level 5 → 4th part
        };

        // Prepare payouts (skip missing levels automatically)
        const payouts = senderUpline
            .map(u => {
                const income = slots[u.level] || new BigNumber(0);
                if (income.isZero()) return null;
                return {
                    userAddress: u.userAddress,
                    level: u.level,
                    income: income.toFixed(), // keep as 1e18 string
                    currentRank: u.currentRank
                };
            })
            .filter(Boolean);

        console.log("Final payouts:", payouts);

        // Update user wallets in bulk
        const bulkOps = await Promise.all(
            payouts.map(async p => {
                // Get current values (as strings)
                const user = await RegistrationModel.findOne(
                    { userAddress: p.userAddress },
                    { usdtIncomeWallet: 1, totalIncomeUsdtReceived: 1 }
                ).lean();

                const currentWallet = new BigNumber(user?.usdtIncomeWallet || "0");
                const currentTotal = new BigNumber(user?.totalIncomeUsdtReceived || "0");

                const income = new BigNumber(p.income);

                // Add income
                const newWallet = currentWallet.plus(income).toFixed();
                const newTotal = currentTotal.plus(income).toFixed();

                return {
                    updateOne: {
                        filter: { userAddress: p.userAddress },
                        update: {
                            $set: {
                                usdtIncomeWallet: newWallet,
                                totalIncomeUsdtReceived: newTotal
                            }
                        }
                    }
                };
            })
        );

        const incomeDocs = payouts.map(p => ({
            senderAddress: senderAddress,   // original node purchaser
            receiverAddress: p.userAddress, // upline user
            amount: p.income,
            fromLevel: p.level,
            time: time,
            amountNbdPaid,
            amountNbdPaidforNodeNum: Number(nodeNum)
        }));
        if (incomeDocs.length > 0) {
            await NodeRegIncomeModel.insertMany(incomeDocs);
        }

        // Execute bulkWrite
        if (bulkOps.length > 0) {
            await RegistrationModel.bulkWrite(bulkOps);
        }


    } catch (error) {
        console.log(error);
    }
}

const giveUserType = async (userAddress) => {
    try {
        if (!userAddress) return { userType: "normal" };

        const { daos, delegators } = await getDaoAndDelegator();
        const lowerAddress = userAddress.toLowerCase();

        // Check if user exists in daos array
        const isDao = daos.some(obj => obj.target_address?.toLowerCase() === lowerAddress);
        if (isDao) return { userType: "dao" };

        // Check if user exists in delegators array
        const isDelegator = delegators.some(obj => obj.target_address?.toLowerCase() === lowerAddress);
        if (isDelegator) return { userType: "delegator" };

        // Default case
        return { userType: "normal" };

    } catch (error) {
        return { userType: "normal" };
    }
};

const updateFsrValue = async (userAddress) => {
    try {

        if (!userAddress) return { utilizedFsr: 0, activatedFsr: 0, currentFsr: 0 };

        const fUserAddress = giveCheckSummedAddress(userAddress);

        let oldDoc = await RegistrationModel.findOne({ userAddress: fUserAddress }, { currentFsr: 1, utilizedFsr: 1, activatedFsr: 1, userType: 1 }).lean();
        if (!oldDoc) {
            console.log("User not found for address:", fUserAddress);
            return { utilizedFsr: 0, activatedFsr: 0, currentFsr: 0 };
        }

        if (oldDoc.userType === "delegator") {
            return { utilizedFsr: oldDoc.utilizedFsr, activatedFsr: oldDoc.activatedFsr, currentFsr: oldDoc.currentFsr }
        }
        // console.log("sdfsg----sdfg", oldDoc)

        const { currentFsr, utilizedFsr, activatedFsr } = oldDoc;

        if (process.env.NODE_ENV === "production") {
            const res = await axios.get(`https://api.dsclab.ai/api/getFSRvalue?walletAddress=${userAddress}`);
            if (res.data.success) {
                const fsrValue = res.data.data.fsr_deposit * 2;
                const updatedDoc = await RegistrationModel.findOneAndUpdate(
                    { userAddress: fUserAddress },
                    { $set: { currentFsr: fsrValue } },
                    { new: true }
                );
                return { currentFsr: updatedDoc.currentFsr || currentFsr, utilizedFsr: updatedDoc.utilizedFsr || utilizedFsr, activatedFsr: updatedDoc.activatedFsr || activatedFsr };
            } else {
                console.log("Failed to fetch FSR value from API for address:", fUserAddress);
                return { utilizedFsr: utilizedFsr, activatedFsr: activatedFsr, currentFsr: currentFsr };;
            }
        } else {
            const fsrFromApi = 5000 * 2;
            const newFsr = await RegistrationModel.findOneAndUpdate(
                { userAddress: fUserAddress },
                { $set: { currentFsr: fsrFromApi } },
                { new: true }
            );
            if (newFsr) {
                return { utilizedFsr: newFsr.utilizedFsr || 0, activatedFsr: newFsr.activatedFsr || 0, currentFsr: newFsr.currentFsr || 0 };
            }
        }

        return { utilizedFsr: utilizedFsr, activatedFsr: activatedFsr, currentFsr: currentFsr };

    } catch (error) {
        console.log(error);

        return { utilizedFsr: 0, activatedFsr: 0, currentFsr: 0 };
    }
}

const refreshDaoDelegatorUsers = async () => {
    try {
        const { daos, delegators } = await getDaoAndDelegator();

        const bulkOps = [];

        const cursor = RegistrationModel.find({}).cursor();

        for await (const user of cursor) {
            const lowerAddress = user.userAddress.toLowerCase();
            let newType = "normal";

            const isDao = daos.some(obj => obj.target_address?.toLowerCase() === lowerAddress);
            if (isDao) newType = "dao";
            else {
                const isDelegator = delegators.some(obj => obj.target_address?.toLowerCase() === lowerAddress);
                if (isDelegator) newType = "delegator";
            }

            if (user.userType !== newType) {
                bulkOps.push({
                    updateOne: {
                        filter: { userAddress: user.userAddress },
                        update: { $set: { userType: newType } }
                    }
                });
            }
        }

        if (bulkOps.length > 0) {
            await RegistrationModel.bulkWrite(bulkOps);
            console.log("DAO and Delegator user types refreshed successfully.");
        }

    } catch (error) {
        console.log(error);
    }
}

/**
 * 📆 Get number of target days between 7th of given month and 6th of next month (inclusive)
 * @param {string} calendarMonth - Month in format "MMMM YYYY" (e.g. "November 2025")
 * @returns {number} Number of days between 7th of that month and 6th of next month (inclusive)
 */

function getTargetDaysFromCalendarMonth(calendarMonth) {

    if (!calendarMonth || typeof calendarMonth !== "string") return 31;
    // Parse the input month
    const startDate = moment(calendarMonth, "MMMM YYYY").date(7); // 7th of given month
    const endDate = moment(startDate).add(1, "month").date(6);     // 6th of next month

    // Calculate the difference in days (inclusive)
    const diffDays = endDate.diff(startDate, "days") + 1;

    return diffDays;
}

const givePaymentRatioForDeployedNode = async (userAddress, nodeNum) => {
    try {
        if (!userAddress || !nodeNum) return { status: false, ratio: { usd: 0, dsc: 0 } };

        const fUserAddress = giveCheckSummedAddress(userAddress);

        const userNodeDocs = await UpgradedNodes.find({ userAddress: fUserAddress, nodeNum: Number(nodeNum) }).sort({ time: -1 }).lean();
        if (!userNodeDocs || userNodeDocs.length === 0)
            return { status: false, ratio: { usd: 0, dsc: 0 } };

        // ✅ Get the current node total amount (same across all docs for this node)
        const currentTotal = new BigNumber(userNodeDocs[0].totalAmountInUsd);

        // ✅ Find previous node doc
        const prevNodeDoc = await UpgradedNodes.findOne({
            userAddress: fUserAddress,
            nodeNum: { $lt: Number(nodeNum) },
        })
            .sort({ nodeNum: -1 })
            .lean();

        // ✅ Determine previous total (0 if not found)
        const prevTotal = prevNodeDoc
            ? new BigNumber(prevNodeDoc.totalAmountInUsd)
            : new BigNumber(0);

        // ✅ Target amount for this node
        const targetAmount = currentTotal.minus(prevTotal);

        // ✅ Initialize accumulators
        let totalUsdPaid_USDT = new BigNumber(0);
        let totalUsdPaid_DSC = new BigNumber(0);

        // ✅ Sum payments by currency
        for (const doc of userNodeDocs) {
            const paid = new BigNumber(doc.amountUsdPaid);

            if (doc.currency === "USDT") {
                totalUsdPaid_USDT = totalUsdPaid_USDT.plus(paid);
            } else if (doc.currency === "DSC") {
                totalUsdPaid_DSC = totalUsdPaid_DSC.plus(paid);
            }
        }

        // ✅ Calculate ratios vs. target amount
        const ratioUSDT = totalUsdPaid_USDT
            .dividedBy(targetAmount)
            .multipliedBy(100)
            .toFixed(2);

        const ratioDSC = totalUsdPaid_DSC
            .dividedBy(targetAmount)
            .multipliedBy(100)
            .toFixed(2);

        console.log("----->>>>>", Number(ratioUSDT), Number(ratioDSC))

        return {
            status: true,
            ratio: {
                usdt: Number(ratioUSDT),
                dsc: Number(ratioDSC),
            },
            totals: {
                usdtPaid: totalUsdPaid_USDT.dividedBy(1e18).toString(),
                dscPaid: totalUsdPaid_DSC.dividedBy(1e18).toString(),
                targetAmount: targetAmount.dividedBy(1e18).toString(),
                currentTotal: currentTotal.dividedBy(1e18).toString(),
                prevTotal: prevTotal.dividedBy(1e18).toString(),
            },
        };
    } catch (error) {
        console.log(error);
        return { status: false, ratio: { usd: 0, dsc: 0 } };
    }
}

const manageAssuranceIncome = async (userAddress, amountDsc, action, operation = 'minus') => {
    try {
        if (!userAddress || !amountDsc)
            return { status: false, message: "Invalid parameters" };

        const fUserAddress = giveCheckSummedAddress(userAddress);

        const userDoc = await RegistrationModel.findOne({ userAddress: fUserAddress });
        if (!userDoc)
            return { status: false, message: "User not found!" };

        if (operation !== "minus")
            return { status: false, message: "Only minus operation can be done" };

        const { swapAllocation = "0", dscAllocation = "0" } = userDoc;

        if (action === "SWAPPED") {
            const newSwapAllocation = new BigNumber(swapAllocation).minus(amountDsc).toFixed(0);
            if (new BigNumber(newSwapAllocation).isNegative())
                return { status: false, message: "Insufficient swapped assurance allocation" };

            const updatedUser = await RegistrationModel.findOneAndUpdate(
                { userAddress: fUserAddress },
                { $set: { swapAllocation: newSwapAllocation } },
                { new: true }
            );

            if (!updatedUser)
                return { status: false, message: "Failed to update user assurance allocation" };

            return { status: true, message: "Swapped assurance allocation deducted successfully" };
        }

        else if (action === "WITHDRAW") {
            const newDscAllocation = new BigNumber(dscAllocation).minus(amountDsc).toFixed(0);
            if (new BigNumber(newDscAllocation).isNegative())
                return { status: false, message: "Insufficient DSC assurance allocation" };

            const updatedUser = await RegistrationModel.findOneAndUpdate(
                { userAddress: fUserAddress },
                { $set: { dscAllocation: newDscAllocation } },
                { new: true }
            );

            if (!updatedUser)
                return { status: false, message: "Failed to update user assurance allocation" };

            return { status: true, message: "DSC assurance allocation deducted successfully" };
        }

        else if (action === "TRANSFER") {
            const newDscAllocation = new BigNumber(dscAllocation).plus(amountDsc).toFixed(0);
            const newSwapAllocation = new BigNumber(swapAllocation).minus(amountDsc).toFixed(0);

            if (new BigNumber(newDscAllocation).isNegative() || new BigNumber(newSwapAllocation).isNegative())
                return { status: false, message: "Insufficient DSC or Swap assurance allocation" };

            const updatedUser = await RegistrationModel.findOneAndUpdate(
                { userAddress: fUserAddress },
                {
                    $set: {
                        dscAllocation: newDscAllocation,
                        swapAllocation: newSwapAllocation
                    }
                },
                { new: true }
            );

            if (!updatedUser)
                return { status: false, message: "Failed to update user assurance allocation" };

            return { status: true, message: "DSC assurance allocation deducted successfully for transfer" };
        }

        else {
            return { status: false, message: "Invalid action type" };
        }

    } catch (error) {
        console.error("manageAssuranceIncome error:", error);
        return { status: false, message: "Error deducting assurance income" };
    }
};

const getMonthIndex = (deploymentUnix, currentUnix = moment().unix()) => {
    // both are seconds -> use moment.unix
    const deployment = moment.unix(deploymentUnix).utc();
    const today = moment.unix(currentUnix).utc();

    // debug logs
    ct({
        deployedDate: deployment.format("DD-MM-YYYY HH:mm:ss"),
        todayDate: today.format("DD-MM-YYYY HH:mm:ss"),
    });

    const dDate = deployment.date(); // 1–31

    let firstCycleEnd;
    if (dDate <= 6) {
        // deploy between 1-6 => first cycle ends 6 same month
        firstCycleEnd = deployment.clone().date(6).endOf("day");
    } else {
        // deploy between 7-31 => first cycle ends 6 next month
        firstCycleEnd = deployment.clone().add(1, "month").date(6).endOf("day");
    }

    if (today.isSameOrBefore(firstCycleEnd)) return 0;

    // now count how many full 7->6 cycles have passed after firstCycleEnd
    let cycleStart = firstCycleEnd.clone().add(1, "day").startOf("day");
    let monthIndex = 1;

    while (true) {
        let nextCycleEnd = cycleStart.clone().add(1, "month").date(6).endOf("day");
        if (today.isSameOrBefore(nextCycleEnd)) break;
        cycleStart = nextCycleEnd.clone().add(1, "day").startOf("day");
        monthIndex++;
    }

    ct({
        deploymentUnix,
        currentUnix,
        dDate,
        firstCycleEnd: firstCycleEnd.format("DD-MM-YYYY HH:mm:ss"),
        monthIndex
    });

    return monthIndex;
};

const calculateUserRoiAssurance = async (timeUnixSeconds, orgBaseMinAssIn1e18) => {
    let finalBaseMinAss = "0";
    let status = false;
    let isIncomeExpired = false;
    // let monthIndex = null;
    let activationMonth = null;
    let monthsPassed = null;
    let whichMonth = null;

    const monthIndex = getMonthIndex(timeUnixSeconds, moment().unix());

    try {

        if (!timeUnixSeconds || !orgBaseMinAssIn1e18) {
            return {
                status,
                finalBaseMinAss,
                isIncomeExpired,
                message: "Please send required fields"
            };
        }

        // Activation start month (month 0)
        const activation = moment.unix(timeUnixSeconds).startOf("month");
        activationMonth = activation.format("MMMM YYYY");   // e.g. "October 2025"

        // Current month
        const now = moment().startOf("month");

        // Month difference
        let diffMonths = now.diff(activation, "months");



        ct({ uid: "kjsd874", timeUnixSeconds, orgBaseMinAssIn1e18 });
        // monthIndex = diffMonths;            // 0 → same month
        // monthsPassed = diffMonths;          // readable number

        // Human readable month (1st, 2nd, 3rd...)
        whichMonth = diffMonths === 0
            ? "Same month"
            : `${diffMonths} month${diffMonths > 1 ? "s" : ""} passed`;

        const base = new BigNumber(orgBaseMinAssIn1e18);

        // ----------------------------
        // CONDITIONS
        // ----------------------------




        if (monthIndex === 0) {
            // still in same month → return 0
            finalBaseMinAss = "0";

        } else if (monthIndex >= 1 && monthIndex <= 6) {
            // First 6 months → original value
            finalBaseMinAss = base.toFixed();
            ct({ uid: "kjsd874", finalBaseMinAss });

        } else if (monthIndex >= 7 && monthIndex <= 12) {
            // 7th to 12th month → halved
            finalBaseMinAss = base.dividedBy(2).toFixed(0);

        } else if (monthIndex >= 13 && monthIndex <= 18) {
            // 13th to 18th month → 1/4
            finalBaseMinAss = base.dividedBy(4).toFixed(0);

        } else {
            // After 18 months → expired
            finalBaseMinAss = "0";
            isIncomeExpired = true;
        }

        status = true;

        ct({
            status,
            finalBaseMinAss,
            isIncomeExpired,
            monthIndex,
            activationMonth,   // <── ADDED
            monthsPassed,      // <── ADDED
            whichMonth,        // <── ADDED
            message: "Assurance calculated!",
            diffMonths,
            deployedDate: moment.unix(timeUnixSeconds).format("MMMM Do, YYYY")
        });



        return {
            status,
            finalBaseMinAss,
            isIncomeExpired,
            monthIndex,
            activationMonth,   // <── ADDED
            monthsPassed,      // <── ADDED
            whichMonth,        // <── ADDED
            message: "Assurance calculated!"
        };

    } catch (error) {
        const errorMessage =
            error?.response?.message ||
            error?.message ||
            "Error occurred while calculating base min assurance";

        return {
            status,
            message: errorMessage,
            finalBaseMinAss,
            isIncomeExpired,
            monthIndex,
            activationMonth,
            monthsPassed,
            whichMonth
        };
    }
};

const giveNumFrom1e18 = (amountIn1e18) => {
    try {
        if (!amountIn1e18) return 0;
        const amountBn = new BigNumber(amountIn1e18);
        const result = amountBn.dividedBy(1e18).toNumber();
        return result;
    } catch (error) {
        console.log(error);
        return 0;
    }
}





const giveTeamBusinessForUser = async (userAddress) => {
    let teamBusiness = 0;
    try {
        if (!userAddress) {
            return { status: false, message: "Invalid parameters", teamBusiness: 0 }
        };

        const teamBusinessCalculation = await RegistrationModel.aggregate([
            { $match: { userAddress: userAddress } },
            {
                $graphLookup: {
                    from: "registration",
                    startWith: "$userAddress",
                    connectFromField: "userAddress",
                    connectToField: "sponsorAddress",
                    as: "teamMembers"
                }
            },
            { $unwind: "$teamMembers" },
            {
                $group: {
                    _id: null,
                    totalTeamBusiness: { $sum: { $toDouble: "$teamMembers.userTotalStakeInUsd" } }
                }
            }
        ]);

        if (teamBusinessCalculation.length > 0) {
            teamBusiness = teamBusinessCalculation[0].totalTeamBusiness;
        }

        return { status: true, message: "Team business calculated successfully", teamBusiness: teamBusiness }


    } catch (error) {
        const errorMsg = error?.response?.message || error?.message || "Error occurred while calculating team business for user";
        return { status: false, message: errorMsg, teamBusiness: 0 }
    }
}

// const updateLastRoiDistributedTimeOnFeeDeposit = async (
//     userAddress,
//     depositTimeInUnix,
//     nodeDeployedTime
// ) => {
//     try {
//         const feeTime = moment.unix(depositTimeInUnix).utc();
//         const deployTime = moment.unix(nodeDeployedTime).utc();

//         const feeDate = feeTime.date();
//         const deployDate = deployTime.date();

//         // ---- Fetch DB details (YOU MUST IMPLEMENT THESE) ---- //
//         const addrFilter = { userAddress: { $regex: new RegExp(`^${userAddress}$`, "i") } };
//         const lastRoi = await RoiModel.findOne(addrFilter).sort({ time: -1 });
//         const lastFee = await AssuranceFeeModel.findOne(addrFilter).sort({ time: -1 });
//         console.log("last roi is",lastRoi)

//         const prevMonthPaid = lastFee ? true : false; // Change logic as needed

//         // ---- Utility functions ---- //
//         const startOfDayUnix = (m) => m.clone().startOf("day").unix();
//         const getNext7th = (m) => m.clone().add(1, "month").date(7).startOf("day").unix();

//         // ======================================================
//         // =============== CASE A: FIRST TIME FEE ===============
//         // ======================================================

//         if (!lastFee) {
//             // A.1 Fee in 1–6 of deployment month
//             if (feeDate <= 6 && feeTime.month() === deployTime.month()) {
//                 return deployTime.clone().date(7).startOf("day").unix();
//             }

//             // A.2 Fee in 7–end of deployment month
//             if (feeDate > 6 && feeTime.month() === deployTime.month()) {
//                 return startOfDayUnix(feeTime);
//             }

//             // ==============================
//             // CASE B: FIRST FEE BUT MISSED PREV MONTH
//             // ==============================
//             // This happens when:
//             // deployment month = Nov
//             // user missed Nov fee
//             // and fee now coming in Dec

//             // B.1 Fee 1–6 of next month after missing
//             if (feeDate <= 6 && feeTime.month() === deployTime.month() + 1) {
//                 return feeTime.clone().date(7).startOf("day").unix();
//             }

//             // B.2 Fee 7–end of next month after missing
//             if (feeDate > 6 && feeTime.month() === deployTime.month() + 1) {
//                 return startOfDayUnix(feeTime);
//             }
//         }

//         // ======================================================
//         // =============== CASE C: RE-TOPUP =====================
//         // ======================================================

//         if (lastFee) {
//             const currentMonth = feeTime.month();
//             const prevMonth = currentMonth - 1;

//             // C.1 Re-Topup: Fee in 1–6 & prev month paid
//             if (feeDate <= 6 && prevMonthPaid) {
//                 if (lastRoi) return lastRoi.time;
//             }

//             // C.2 Re-Topup: Fee in 1–6 & prev month NOT paid
//             if (feeDate <= 6 && !prevMonthPaid) {
//                 return feeTime.clone().date(7).startOf("day").unix();
//             }

//             // C.3 Fee 7–end (always return start-of-day)
//             if (feeDate > 6) {
//                 return startOfDayUnix(feeTime);
//             }
//         }

//         // fallback safe
//         return startOfDayUnix(feeTime);

//     } catch (error) {
//         console.log(error);
//         return moment().unix(); // safe fallback
//     }
// };


const returnLastRoiDistributedTimeOnFeeDeposit = async (
    userAddress,
    depositTimeInUnix,
    nodeDeployedTime
) => {
    try {
        // Use SERVER LOCAL TIMEZONE (NO UTC)
        const feeTime = moment.unix(depositTimeInUnix);
        const deployTime = moment.unix(nodeDeployedTime);

        const feeDate = feeTime.date();
        const deployDate = deployTime.date();

        const addrFilter = { userAddress: { $regex: new RegExp(`^${userAddress}$`, "i") } };

        const lastRoi = await RoiModel.findOne(addrFilter).sort({ time: -1 });
        const lastFee = await AssuranceFeeModel.findOne(addrFilter).sort({ time: -1 });

        console.log("Last ROI:", lastRoi);

        const prevMonthPaid = lastFee ? true : false;

        // --- utility ---
        const startOfDayUnix = (m) => m.clone().startOf("day").unix();

        // ======================================================
        // =============== CASE A: FIRST TIME FEE ===============
        // ======================================================

        if (!lastFee) {

            // A.1 Fee 1–6 of same month of deployment
            if (feeDate <= 6 && feeTime.month() === deployTime.month()) {
                return deployTime.clone().date(7).startOf("day").unix();
            }

            // A.2 Fee 7–end of same month
            if (feeDate > 6 && feeTime.month() === deployTime.month()) {
                return startOfDayUnix(feeTime);
            }

            // ======================================================
            // ========== CASE B: PREVIOUS MONTH MISSED ============
            // ======================================================

            // B.1 Fee 1–6 of NEXT month
            if (feeDate <= 6 && feeTime.month() === deployTime.month() + 1) {
                return feeTime.clone().date(7).startOf("day").unix();
            }

            // B.2 Fee 7–end of NEXT month
            if (feeDate > 6 && feeTime.month() === deployTime.month() + 1) {
                return startOfDayUnix(feeTime);
            }
        }

        // ======================================================
        // =============== CASE C: RE-TOPUP =====================
        // ======================================================

        if (lastFee) {

            const currentMonth = feeTime.month();
            const previousMonth = currentMonth - 1;

            // C.1 Re-topup: Fee 1–6 and prev month PAID
            if (feeDate <= 6 && prevMonthPaid) {
                if (lastRoi) return lastRoi.time;
            }

            // C.2 Re-topup: Fee 1–6 and prev month NOT PAID
            if (feeDate <= 6 && !prevMonthPaid) {
                return feeTime.clone().date(7).startOf("day").unix();
            }

            // C.3 Fee 7–30 (always TODAY start-of-day)
            if (feeDate > 6) {
                return startOfDayUnix(feeTime);
            }
        }

        // default fallback
        return startOfDayUnix(feeTime);

    } catch (error) {
        console.log(error);
        return moment().unix(); 
    }
};

function getRealCustomMonthRange() {
    const today = moment();

    let monthStart;
    let monthEnd;

    if (today.date() >= 7) {
        monthStart = today.clone().date(7).startOf("day");
        monthEnd = today.clone().add(1, "month").date(6).endOf("day");
    } else {
        monthStart = today.clone().subtract(1, "month").date(7).startOf("day");
        monthEnd = today.clone().date(6).endOf("day");
    }

    return {
        start: monthStart.unix(),
        end: monthEnd.unix()
    };
}

module.exports = {getRealCustomMonthRange, giveTeamBusinessForUser,returnLastRoiDistributedTimeOnFeeDeposit, generateVrsForAssuranceIncome, giveNumFrom1e18, calculateUserRoiAssurance, manageAssuranceIncome, getTargetDaysFromCalendarMonth, givePaymentRatioForDeployedNode, giveUserType, refreshDaoDelegatorUsers, updateFsrValue, createJwtToken, giveVrsForNodeDeployment, giveVrsForNodeUpgradation, sendNodeRegIncomeToUpline, getRemainingDscUsdToPayForStaking, getRemainingDscToPayInUsd, validateStake, giveUsdDscRatioParts, validateUpgradeNodeConditions, setLatestBlock, giveAdminSettings, manageUserWallet, generateRandomId, updateUserNodeInfo, updateTeamCount, updateUserNodeInfo, generateDefaultAdminDoc, ct, giveVrsForWithdrawIncomeDsc, giveVrsForWithdrawIncomeUsdt, giveVrsForStaking, splitByRatio, giveGapIncome, registerUser, updateUserTotalSelfStakeUsdt, createDefaultOwnerRegDoc, giveCheckSummedAddress, manageRank, updateDirectBusiness, giveVrsForNodeConversion, giveVrsForMixStaking, updateDirectCount, getMonthIndex, giveVrsForActivatingFsr, generateVrsForSponsorTx, manageUserWalletForDsc }