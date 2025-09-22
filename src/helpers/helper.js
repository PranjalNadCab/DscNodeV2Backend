const RegistrationModel = require("../models/RegistrationModel");
const { web3 } = require("../web3/web3")
const BigNumber = require("bignumber.js");
const { ranks, gapIncome } = require("./constant");
const GapIncomeModel = require("../models/GapIncomeModel");
const moment = require("moment");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const AdminModel = require("../models/AdminModel");
const Admin = require("../models/AdminModel");
const DscNodeBlockConfig = require("../models/DscNodeBlockConfig");
const UpgradedNodes = require("../models/UpgradeNodeModel");
const NodeConverted = require("../models/NodeConvertedModel");
const { default: mongoose } = require("mongoose");
const RoiModel = require("../models/RoiModel");


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
        const existingAdmin = await AdminModel.findOne({});
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
                lastUpdatedMonthForNodeValidators: process.env.START_MONTH || "October"
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

function giveVrsForStaking(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, nonce) {
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

function giveVrsForNodeConversionAndRegistration(userAddress, amountToDeduct, action, nodeNum, nodePurchasingBalance, currNonce, hash) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce

            const data = {
                hash: hash,
                nonce: currNonce,
                userAddress: userAddress,
                action: action,
                amountToDeduct,
                nodeNum,
                oldBalance: nodePurchasingBalance
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

const registerUser = async (userAddress, time, sponsorAddress) => {
    try {
        const user = await RegistrationModel.findOne({ userAddress });
        if (!user) {
            const uniqueRandomId = await generateRandomId();
            const newUser = await RegistrationModel.create({
                uniqueRandomId: uniqueRandomId,
                userAddress,
                sponsorAddress,
                time: time || Math.floor(Date.now() / 1000)
            });

            await updateTeamCount(userAddress);
            await updateDirectCount(sponsorAddress);
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

const manageRank = async (userAddress) => {
    try {
        if (!userAddress) return;
        let rankDuringStaking = null;
        const fUserAddress = giveCheckSummedAddress(userAddress);
        const userInfo = await RegistrationModel.findOne({ userAddress: fUserAddress });
        if (!userInfo) return { rankDuringStaking };

        const userDirectPlusSelfStakeInUsdNormal = userInfo.userDirectPlusSelfStakeInUsd;
        const matchedRank = ranks.find(r => userDirectPlusSelfStakeInUsdNormal >= r.lowerBound && userDirectPlusSelfStakeInUsdNormal <= r.upperBound);
        console.log("matchedRank", matchedRank);
        ct({ userAddress, userDirectPlusSelfStakeInUsdNormal, rank: matchedRank.rank });

        const currTimeInUnix = moment().unix();

        if (matchedRank && (matchedRank.rank !== userInfo.currentRank)) {
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
const giveGapIncome = async (senderAddress, stakingAmountIn1e18, rankDuringStaking = null, usdtStakedIn1e18, dscStakedInUsdtIn1e18) => {
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
            return userGrade > senderGrade;
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
                senderAddress: senderAddress,
                senderRank: rankDuringStaking,
                totalGapIncomeInUsd: gapIncomeGenerated,
                senderTotalStakedUsd: senderDoc.userTotalStakeInUsd || 0,
                gapIncomeInUsd: usdt,
                gapIncomeInDsc: tokenUnits,
                gapIncomeInDscInUsd: tokenUsd,
                dscPrice: dscPrice.price ? dscPrice.price : 0,
                percentReceived: percentToDistribute,
                time: currTime,
                stakingAmountInUsd: new BigNumber(stakingAmountIn1e18)
                    .dividedBy(1e18)
                    .toFixed(),
                transactionHash: null,
                blockNumber: null
            });

            const regDoc = await RegistrationModel.findOne({ userAddress: user.userAddress });

            const newDscIncomeWallet = new BigNumber(regDoc.dscIncomeWallet || "0").plus(tokenUnits).toFixed(0);
            const newUsdtIncomeWallet = new BigNumber(regDoc.usdtIncomeWallet || "0").plus(usdt).toFixed(0);
            const newTotalIncomeDsc = new BigNumber(regDoc.totalIncomeDscReceived || "0").plus(tokenUnits).toFixed(0);
            const newTotalIncomeUsdt = new BigNumber(regDoc.totalIncomeUsdtReceived || "0").plus(usdt).toFixed(0);

            bulkRegOps.push({
                updateOne: {
                    filter: { userAddress: user.userAddress },
                    update: {
                        $set: {
                            dscIncomeWallet: newDscIncomeWallet,
                            usdtIncomeWallet: newUsdtIncomeWallet,
                            totalIncomeDscReceived: newTotalIncomeDsc,
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

        const alreadyAchieved = purchasedNodes.find(n => n.nodeNum === nodeNum);

        if (alreadyAchieved) {
            console.log(`User ${user} has already achieved node ${nodeNum}`);
            return;
        }
        const adminDoc = await AdminModel.findOne({});
        if (!adminDoc) {
            console.log("Admin doc not found");
            return;
        }
        const nodeInfo = adminDoc.nodeValidators.find(n => n.nodeNum === nodeNum);
        if (!nodeInfo) {
            console.log(`Invalid node name ${nodeName}`);
            return;
        }
        purchasedNodes.push({
            nodeName: nodeInfo.nodeName,
            purchasedAt: time,
            reward: nodeInfo.reward,
            nodeConversionTime: moment().unix()
        });

        const updatedUser = await RegistrationModel.findOneAndUpdate(
            { userAddress: user },
            { $set: { purchasedNodes: purchasedNodes, currentNodeName: nodeInfo.nodeName } },
            { new: true }
        );
        const updateNode = await UpgradedNodes.updateOne(
            { userAddress: user, nodeNum },
            { $set: { nodeConversionTime: moment().unix() } },
            { upsert: true }
        );
        const currentMonthName = moment().format("MMMM");
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

        const { withdrawDeductionPercent = null, nodeValidators = null, stakeRatio = null } = await Admin.findOne({});



        return { withdrawDeductionPercent, nodeValidators, stakeRatio }

    } catch (error) {
        console.log(error);
        return { withdrawDeductionPercent: null, nodeValidators: null, stakeRatio: null }
    }
}

const giveRoiToNodeHolders = async () => {
    let session;
    try {
        // Start a session
        session = await mongoose.startSession();
        session.startTransaction();

        // Use cursor with session
        const cursor = NodeConverted.find({}).cursor({ session });
        const currTime = moment().unix();

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            const { nodeNum, userAddress, baseMinValue, baseMinAss, conversionMonth, time,lastRoiDistributed } = doc;

            const daysPassed = (currTime - lastRoiDistributed)/(24*60*60);
            if(daysPassed<1){
                console.log(`Skipping user ${userAddress} for node ${nodeNum} as ROI already distributed today.`);
                continue;
            }


            const x = new BigNumber(baseMinAss || "0"); // baseMinAss as BigNumber

            // Convert `time` (seconds) → moment object
            const start = moment.unix(time);
            const now = moment();

            // Days since node conversion
            const diffInDays = now.diff(start, "days");

            // 30 days = 1 month (fixed)
            const monthIndex = Math.floor(diffInDays / 30) + 1; // 1-based

            // Monthly ROI based on slab
            let monthlyROI = new BigNumber(0);

            if (monthIndex >= 1 && monthIndex <= 6) {
                monthlyROI = x;
            } else if (monthIndex >= 7 && monthIndex <= 12) {
                monthlyROI = x.div(2);
            } else if (monthIndex >= 13 && monthIndex <= 18) {
                monthlyROI = x.div(4);
            } else {
                monthlyROI = new BigNumber(0);
            }

            // Daily ROI = monthly / 30
            const dailyROI = monthlyROI.div(30).multipliedBy(daysPassed); // still in 1e18 precision

            // Example output
            console.log({
                userAddress,
                nodeNum,
                baseMinValue,
                baseMinAss,
                conversionMonth, // e.g. "September"
                monthIndex,
                dailyROI: dailyROI.toFixed(0), // still in 1e18 precision
            });

            await RoiModel.create({
                userAddress,
                nodeNum,
                baseMinAss,
                roiDscAssurance: dailyROI.toFixed(0), // still in 1e18 precision
                time:moment().unix()
            })

            // If you need to save/update currGenratedRoi back to Mongo:
            await NodeConverted.updateOne(
                { _id: doc._id },
                { $set: { currGenratedRoi: dailyROI.toFixed(0) } },
                { session }
            );
        }

        // Commit transaction
        await session.commitTransaction();
        console.log("Transaction committed ✅");
    } catch (error) {
        if (session) await session.abortTransaction();
        console.error("Error in giveRoiToNodeHolders:", error);
    } finally {
        if (session) session.endSession();
    }
};

module.exports = { setLatestBlock, giveRoiToNodeHolders, giveAdminSettings, manageUserWallet, generateRandomId, giveVrsForNodeConversionAndRegistration, updateUserNodeInfo, updateUserNodeInfo, generateDefaultAdminDoc, ct, giveVrsForWithdrawIncomeDsc, giveVrsForWithdrawIncomeUsdt, giveVrsForStaking, splitByRatio, giveGapIncome, registerUser, updateUserTotalSelfStakeUsdt, createDefaultOwnerRegDoc, giveCheckSummedAddress, manageRank, updateDirectBusiness, giveVrsForNodeConversion }