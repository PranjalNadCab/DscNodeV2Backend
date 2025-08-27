const RegistrationModel = require("../models/RegistrationModel");
const { web3 } = require("../web3/web3")
const BigNumber = require("bignumber.js");
const { ranks, gapIncome } = require("./constant");
const GapIncomeModel = require("../models/GapIncomeModel");
const moment = require("moment");
const LivePriceDsc = require("../models/LiveDscPriceModel");

const ct = (payload) => {
    console.table(payload);
};

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

function giveVrsForWithdrawIncome(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, nonce,amountDscInUsdIn1e18AfterDeduction,amountUsdtIn1e18AfterDeduction,amountDscIn1e18AfterDeduction) {
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
                priceDscInUsdIn1e18,
                amountDscInUsdIn1e18AfterDeduction,
                amountUsdtIn1e18AfterDeduction,
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
            const newUser = await RegistrationModel.create({
                userAddress,
                sponsorAddress,
                time: time || Math.floor(Date.now() / 1000)
            });

            await updateTeamCount(userAddress);
            await updateDirectCount(sponsorAddress);
            await updateDirectBusiness(0, userAddress); // Assuming initial stake amount is 0
        }
    } catch (error) {
        console.error("Error registering user:", error);
        throw error;
    }
}

const createDefaultOwnerDoc = async () => {
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
            }
        ])

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
        for (let user of uniqueRankUsers) {
            assignedPercent = gapIncome[user.currentRank];
            if (percentDistributed >= lastPackagePercent) { ct({ status: "Limit reached", lastPackagePercent, percentDistributed, userId: uplineUser.userId }); break; }
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
                time: moment().unix(),
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
    ct({ total, ratioUsdt, ratioDscInUsd, part: part.toFixed(0), usdt, tokenUsd, tokenUnits });
    return { usdt, tokenUsd, tokenUnits };
}

module.exports = { ct,giveVrsForWithdrawIncome, giveVrsForStaking, splitByRatio, giveGapIncome, registerUser, updateUserTotalSelfStakeUsdt, createDefaultOwnerDoc, giveCheckSummedAddress, manageRank }