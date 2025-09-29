const { hash } = require("crypto");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const { giveVrsForStaking, ct, giveCheckSummedAddress, giveVrsForWithdrawIncomeUsdt, giveVrsForWithdrawIncomeDsc, giveVrsForNodeConversionAndRegistration, giveAdminSettings, giveVrsForNodeConversion, validateStake, giveVrsForMixStaking, validateUpgradeNodeConditions, giveUsdDscRatioParts, getRemainingDscToPayInUsd, getRemainingDscUsdToPayForStaking, giveVrsForNodeUpgradation } = require("../helpers/helper");
const StakingModel = require("../models/StakingModel");
const BigNumber = require("bignumber.js");
const { dscNodeContract, web3 } = require("../web3/web3");
const RegistrationModel = require("../models/RegistrationModel");
const WithdrawIncomeModel = require("../models/WithdrawIncomeModel");
const { isAddress } = require("web3-validator");
const Admin = require("../models/AdminModel");
const NodeConverted = require("../models/NodeConvertedModel");
const GapIncomeModel = require("../models/GapIncomeModel");
const UpgradedNodes = require("../models/UpgradeNodeModel");
const RoiModel = require("../models/RoiModel");
const { usdDscRatio, ratioUsdDsc, nbdAmounts, zeroAddressTxhash } = require("../helpers/constant");


const stakeVrs = async (req, res, next) => {
    try {
        // Extract user data from request body

        const { amountInUsd, currency, totalAmountInUsd } = req.body;
        let { user, sponsorAddress } = req.body;
        if (!["USDT", "DSC"].includes(currency)) throw new Error("Invalid currency");

        const missingFields = Object.keys(req.body).filter(key => (key === undefined || key === null || key === "" || (typeof req.body[key] === "string" && req.body[key].trim() === "")));
        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        // if (!user || !amountDsc || !amountDscInUsd || !amountUsdt || !priceDscInUsd || !sponsorAddress) throw new Error("Please send all the required fields.");

        user = giveCheckSummedAddress(user);
        sponsorAddress = giveCheckSummedAddress(sponsorAddress);

        const isUserExist = await RegistrationModel.findOne({ userAddress: user });

        let sponsorDoc = await RegistrationModel.findOne({ userAddress: sponsorAddress });
        if (!sponsorDoc) throw new Error("Sponsor not found. Please register your sponsor first.");



        // const totalUsd = Number(amountDscInUsd) + Number(amountUsdt);
        if (totalAmountInUsd < 100) throw new Error("Total amount must be at least $100.");
        if (totalAmountInUsd % 100 !== 0) throw new Error("You can only stake multiples of $100.");

        const totalAmountInUsdIn1e18 = new BigNumber(totalAmountInUsd).multipliedBy(1e18);
        const amountInUsdIn1e18 = new BigNumber(amountInUsd).multipliedBy(1e18);


        const { price } = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");
        const rateDollarPerDsc = new BigNumber(price).multipliedBy(1e18).toFixed(0);

        const lastStake = await StakingModel.findOne({ userAddress: user }).sort({ lastUsedNonce: -1 });

        ct({ user, amountInUsdIn1e18: amountInUsdIn1e18.toFixed(), currency, rateDollarPerDsc, })
        let mixTxHash = "NA";
        let amountToDeduct = new BigNumber(0);
        let generatedDsc = new BigNumber(0);


        const { nodeValidators } = await giveAdminSettings();
        if (!nodeValidators) throw new Error("Didn't found node prices!");

        if (totalAmountInUsd === amountInUsd && (currency === "USDT" || currency === "DSC")) {
            //100% USDT or 100% DSC
            generatedDsc = amountInUsdIn1e18.dividedBy(price);
            amountToDeduct = totalAmountInUsdIn1e18;
            mixTxHash = "NA";

        } else if ((totalAmountInUsd !== amountInUsd)) {
            //only for mix tx

            const userLastPendingStake = await StakingModel.find({ userAddress: user, isPendingStake: true, mixTxHash: { $ne: "NA" } }).sort({ time: -1 });
            const isAnyPendingStake = userLastPendingStake.length > 0 ? true : false;
            console.log("---->>", isAnyPendingStake)
            if (isAnyPendingStake && currency == "DSC") {
                const userUsdtPartStake = userLastPendingStake.find((stake) => stake.currency === "USDT");
                const remainingDscInUsdToPay = getRemainingDscUsdToPayForStaking(userUsdtPartStake.totalAmountInUsd, userLastPendingStake);
                if (amountInUsdIn1e18.isGreaterThan(remainingDscInUsdToPay)) throw new Error(`You have to only pay $${remainingDscInUsdToPay.dividedBy(1e18).toFixed()} of DSC`);
                amountToDeduct = amountInUsdIn1e18;
                mixTxHash = userUsdtPartStake.transactionHash;
                generatedDsc = amountToDeduct.dividedBy(price);
                ct({ uid: 'dfgasdgfdg', amountToDeduct: amountToDeduct.toFixed() });
                if (!totalAmountInUsdIn1e18.isEqualTo(userUsdtPartStake.totalAmountInUsd)) throw new Error(`Your stake target is $${new BigNumber(userUsdtPartStake.totalAmountInUsd).dividedBy(1e18).toFixed()} & $${remainingDscInUsdToPay.dividedBy(1e18).toFixed()} of DSC is pending!`)
                if (!amountInUsdIn1e18.isEqualTo(amountToDeduct)) throw new Error(`You have to stake $${remainingDscInUsdToPay.dividedBy(1e18).toFixed()} of DSC`)

            } else if (isAnyPendingStake && currency === "USDT") {
                throw new Error("You have a pending DSC to pay!");
            } else if (!isAnyPendingStake && currency === "DSC") {
                throw new Error("USDT is required to initiate mix ratio transactions!");
            } else if (!isAnyPendingStake && currency === "USDT") {
                const currRatio = ratioUsdDsc();
                const reqUsdAmount = totalAmountInUsdIn1e18.multipliedBy(currRatio.usd).dividedBy(100);
                if (!amountInUsdIn1e18.isEqualTo(reqUsdAmount)) {
                    throw new Error(`You need to stake in usd dsc ratio of ${currRatio.usd}:${currRatio.dsc},you need $${reqUsdAmount.dividedBy(1e18).toFixed(3)}!`);
                }
                amountToDeduct = reqUsdAmount;
                mixTxHash = zeroAddressTxhash;
                generatedDsc = reqUsdAmount.dividedBy(price);

            } else {

            }

        }

        let prevNonce = 0;
        if (!lastStake) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastStake.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForStaking(user).call();
        const hash = await dscNodeContract.methods.getHashForStaking(user, amountToDeduct.toFixed(), currency, rateDollarPerDsc, mixTxHash, totalAmountInUsdIn1e18.toFixed()).call();
        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous stake is not stored yet! Please try again later.");
        }

        const vrsSign = await giveVrsForStaking(user, amountToDeduct.toFixed(), currency, rateDollarPerDsc, mixTxHash, totalAmountInUsdIn1e18.toFixed(), hash, Number(currNonce));





        return res.status(200).json({ success: true, message: "Vrs generated successfully", price: price, vrsSign, sponsorAddress, generatedDsc: generatedDsc.toFixed() });
    } catch (error) {
        console.error("Error in stakeVrs:", error);
        next(error);
    }

}

const stakeMix = async (req, res, next) => {
    try {
        const { amountDsc, amountDscInUsd, amountUsdt, totalUsdStake } = req.body;
        let { user, sponsorAddress } = req.body;

        const missingFields = Object.keys(req.body).filter(key => (key === undefined || key === null || key === "" || (typeof req.body[key] === "string" && req.body[key].trim() === "")));
        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        user = giveCheckSummedAddress(user);
        sponsorAddress = giveCheckSummedAddress(sponsorAddress);

        const isUserExist = await RegistrationModel.findOne({ userAddress: user });
        let sponsorDoc = null;
        if (!isUserExist) {
            sponsorDoc = await RegistrationModel.findOne({ userAddress: sponsor });
            if (!sponsorDoc) throw new Error("Sponsor not found. Please register your sponsor first.");
        }

        let userPendingStake = null;
        const anyPendingStake = await dscNodeContract.methods.anyPendingStake(user).call();
        let pendingDscInUsd = new BigNumber(0);
        let pendingDsc = new BigNumber(0);
        const { price } = await LivePriceDsc.findOne();
        if (!price) throw new Error("Live price not found.");
        const currRatio = ratioUsdDsc();

        if (anyPendingStake) {
            if (amountUsdt !== 0) {
                throw new Error("You have a pending mix 70:30 stake! Please send only remaining 0.5 DSC stake to complete it.");
            }
            userPendingStake = await StakingModel.findOne({ userAddress: user, isPendingStake: true });
            if (!userPendingStake) throw new Error("Pending stake not found in database! Please contact support.");
            const { totalAmountInUsd, amountInUsdt } = userPendingStake;
            pendingDscInUsd = new BigNumber(totalAmountInUsd).minus(amountInUsdt).minus(amountDscInUsd);
            if (pendingDscInUsd.isLessThanOrEqualTo(0)) throw new Error("You don't need to send any DSC! Please check your pending stake details.");
            // cosnt ratioUsdToDsc = amountInUsdt/(totalAmountInUsd - amountInUsdt);
            //manage above ratio in bigNumbers as amounts are in 1e18 string
            const ratioUsdToDsc = new BigNumber(amountInUsdt).dividedBy(new BigNumber(totalAmountInUsd).minus(amountInUsdt));
            console.log("ratio------->>>>>", ratioUsdToDsc.toFixed());
            if (!pendingDscInUsd.isEqualTo(new BigNumber(amountDscInUsd))) {
                throw new Error(`You need to send exactly ${pendingDscInUsd.dividedBy(1e18).toFixed()} USD worth of DSC to complete your pending stake.`);
            }
            pendingDsc = pendingDscInUsd.dividedBy(price);


        } else {
            if (amountUsdt === 0) {
                throw new Error("For mix staking, USDT amount must be greater than 0.");
            }

            let generatedDsc = amountDscInUsd / price;
            generatedDsc = new BigNumber(generatedDsc).multipliedBy(1e18);

            const totalUsd = Number(amountDscInUsd) + Number(amountUsdt);
            if (totalUsdStake < 100) throw new Error("Total amount must be at least $100.");
            if (totalUsdStake % 100 !== 0) throw new Error("You can only stake multiples of $100.");

            const { status, message } = validateStake(amountUsdt, amountDscInUsd, totalUsdStake, currRatio);
            if (!status) throw new Error(message);

        }

        const amountDscInUsdIn1e18 = new BigNumber(amountDscInUsd).multipliedBy(1e18).toFixed(0);
        const amountDscIn1e18 = pendingDsc.isGreaterThan(0) ? pendingDsc.multipliedBy(1e18).toFixed(0) : new BigNumber(amountDsc).multipliedBy(1e18).toFixed(0);
        const amountUsdtIn1e18 = new BigNumber(amountUsdt).multipliedBy(1e18).toFixed(0);
        const priceDscInUsdIn1e18 = new BigNumber(price).multipliedBy(1e18).toFixed(0);
        const hash = null;
        const nonce = null;
        const vrs = giveVrsForMixStaking(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, nonce);


        return res.status(200).json({ success: true, message: "Vrs generated successfully", price: price, generatedAmountDsc: pendingDsc.isGreaterThan(0) ? pendingDsc.dividedBy(1e18).toNumber() : amountDsc, sentAmountDsc: pendingDsc.isGreaterThan(0) ? pendingDsc.dividedBy(1e18).toNumber() : amountDsc, vrsSign: { ...vrs, sponsorAddress: sponsorDoc ? sponsorDoc.userAddress : null } });

    } catch (error) {
        next(error);
    }
}

const getLiveDscPrice = async (req, res, next) => {
    try {

        const { price } = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");



        return res.status(200).json({ success: true, message: "Live DSC Price fetched successfully", price });
    } catch (error) {
        next(error);
    }
}

const getUserInfo = async (req, res, next) => {
    try {
        let { userAddress } = req.body;
        if (!userAddress) throw new Error("Please provide user address.");

        userAddress = giveCheckSummedAddress(userAddress);

        const userDoc = await RegistrationModel.findOne({ userAddress: userAddress });

        return res.status(200).json({ success: true, message: "User info fetched successfully", userInfo: userDoc ? userDoc : null });
    } catch (error) {
        console.error("Error in getUserInfo:", error);
        next(error);
    }
}

const getUserStakings = async (req, res, next) => {
    try {
        let { userAddress, page = 1, limit = 10 } = req.body;
        // page starts from 1, limit defaults to 10

        if (!userAddress) throw new Error("Please provide user address.");

        userAddress = giveCheckSummedAddress(userAddress);

        // Ensure numbers
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await StakingModel.countDocuments({ userAddress });

        // Fetch paginated data
        const userStakings = await StakingModel.find({ userAddress })
            .sort({ lastUsedNonce: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            message: "User stakings fetched successfully",
            userStakings,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};


const withdrawIncomeUsdt = async (req, res, next) => {
    try {
        let { userAddress, amountUsdt } = req.body;

        // ✅ Validate required fields
        const missingFields = Object.entries(req.body)
            .filter(([key, val]) => val === undefined || val === null || val === "" || (typeof val === "string" && val.trim() === ""))
            .map(([key]) => key);

        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        // ✅ Checksum user address
        userAddress = giveCheckSummedAddress(userAddress);

        // ✅ Fetch user document
        const userRegDoc = await RegistrationModel.findOne({ userAddress });
        if (!userRegDoc) throw new Error("User not found. Please register first.");

        let { usdtIncomeWallet } = userRegDoc;

        // Convert stored string balances to BigNumber
        usdtIncomeWallet = new BigNumber(usdtIncomeWallet); // already in 1e18

        // Convert request amounts to 1e18
        const amountUsdtIn1e18 = new BigNumber(amountUsdt).multipliedBy(1e18);


        const amountUsdtIn1e18AfterDeduction = amountUsdtIn1e18.multipliedBy(0.95).toFixed(0);

        // ✅ Validate amounts
        if (amountUsdtIn1e18.isZero()) {
            throw new Error("Withdrawal amount must be greater than zero.");
        }

        // ✅ Case 1: Withdraw only USDT

        if (usdtIncomeWallet.lt(amountUsdtIn1e18)) {
            throw new Error("Insufficient USDT balance in wallet.");
        }



        const lastWithdraw = await WithdrawIncomeModel.findOne({ userAddress: userAddress }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastWithdraw) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastWithdraw.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForWithdrawIncome(userAddress).call();
        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous withdrawal is not stored yet! Please try again later.");
        }


        const hash = await dscNodeContract.methods.getHashForWithdrawIncomeUsdt(userAddress, amountUsdtIn1e18.toFixed(0), amountUsdtIn1e18AfterDeduction).call();
        // If validation passed, continue with withdrawal (not implemented yet)

        const vrsSign = await giveVrsForWithdrawIncomeUsdt(amountUsdtIn1e18, userAddress, hash, Number(currNonce), amountUsdtIn1e18AfterDeduction);

        return res.status(200).json({
            success: true,
            message: "Withdraw income request validated successfully. (Transfer logic not implemented yet.)",
            vrsSign
        });

    } catch (error) {
        next(error);
    }
};

const withdrawIncomeDsc = async (req, res, next) => {
    try {
        let { userAddress, amountDsc, amountDscInUsd, priceDscInUsd } = req.body;

        // ✅ Validate required fields
        const missingFields = Object.entries(req.body)
            .filter(([key, val]) => val === undefined || val === null || val === "" || (typeof val === "string" && val.trim() === ""))
            .map(([key]) => key);

        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        // ✅ Checksum user address
        userAddress = giveCheckSummedAddress(userAddress);

        // ✅ Fetch user document
        const userRegDoc = await RegistrationModel.findOne({ userAddress });
        if (!userRegDoc) throw new Error("User not found. Please register first.");

        let { dscIncomeWallet } = userRegDoc;

        // Convert stored string balances to BigNumber
        dscIncomeWallet = new BigNumber(dscIncomeWallet);   // already in 1e18

        // Convert request amounts to 1e18
        const amountDscIn1e18 = new BigNumber(amountDsc).multipliedBy(1e18);

        const amountDscInUsdIn1e18 = new BigNumber(amountDscInUsd).multipliedBy(1e18).toFixed();
        const priceDscInUsdIn1e18 = new BigNumber(priceDscInUsd).multipliedBy(1e18).toFixed();

        const amountDscIn1e18AfterDeduction = amountDscIn1e18.multipliedBy(0.95).toFixed(0);
        const amountDscInUsdIn1e18AfterDeduction = new BigNumber(amountDscInUsdIn1e18).multipliedBy(0.95).toFixed(0);

        // ✅ Validate amounts
        if (amountDscIn1e18.isZero()) {
            throw new Error("Withdrawal amount must be greater than zero.");
        }



        // ✅ Case 2: Withdraw only DSC

        if (dscIncomeWallet.lt(amountDscIn1e18)) {
            throw new Error("Insufficient DSC balance in wallet.");
        }



        const lastWithdraw = await WithdrawIncomeModel.findOne({ userAddress: userAddress }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastWithdraw) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastWithdraw.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForWithdrawIncome(userAddress).call();
        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous withdrawal is not stored yet! Please try again later.");
        }


        const hash = await dscNodeContract.methods.getHashForWithdrawIncomeDsc(userAddress, amountDscIn1e18.toFixed(0), amountDscInUsdIn1e18, amountDscInUsdIn1e18AfterDeduction, amountDscIn1e18AfterDeduction, priceDscInUsdIn1e18).call();
        // If validation passed, continue with withdrawal (not implemented yet)

        const vrsSign = await giveVrsForWithdrawIncomeDsc(amountDscInUsdIn1e18, amountDscIn1e18, priceDscInUsdIn1e18, userAddress, hash, Number(currNonce), amountDscInUsdIn1e18AfterDeduction, amountDscIn1e18AfterDeduction);

        return res.status(200).json({
            success: true,
            message: "Withdraw income request validated successfully. (Transfer logic not implemented yet.)",
            vrsSign
        });

    } catch (error) {
        next(error);
    }
};

const convertToNode = async (req, res, next) => {
    try {

        let { userAddress, nodeNum } = req.body;
        if (!userAddress || !nodeNum) throw new Error("Please provide all the required fields.");
        if (typeof nodeNum !== "number") throw new Error("Node number must be a number");

        if (!isAddress(userAddress)) throw new Error("Invalid user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        const isRegistered = await dscNodeContract.methods.isUserRegForNodeConversion(userAddress).call();

        if (!isRegistered) throw new Error("You have not registered for node upgradation!");
        //generate vrs

        const myNode = await UpgradedNodes.findOne({ userAddress, nodeNum: Number(nodeNum) });
        if (!myNode) throw new Error("You have not purchased this node yet!");

        if (myNode.nodeConversionTime) throw new Error("You have already converted this node!");


        const lastConversion = await NodeConverted.findOne({ userAddress: userAddress }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastConversion) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastConversion.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForNodeConversion(userAddress).call();
        console.log({ prevNonce, currNonce: Number(currNonce) });
        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous Node conversion not stored yet! Please try again later.");
        }


        const hash = await dscNodeContract.methods.getHashForNodeConversion(userAddress, nodeNum).call();

        const vrsSign = await giveVrsForNodeConversion(userAddress, nodeNum, Number(currNonce), hash);


        return res.status(200).json({ success: true, message: "Node conversion request fullfilled", vrsSign });
    } catch (error) {
        next(error);
    }
}

const getGapIncomeHistory = async (req, res, next) => {
    try {
        let { userAddress, page = 1, limit = 10 } = req.body;
        // page starts from 1, limit defaults to 10

        if (!userAddress) throw new Error("Please provide user address.");

        userAddress = giveCheckSummedAddress(userAddress);

        // Ensure numbers
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await GapIncomeModel.countDocuments({ receiverAddress: userAddress });

        // Fetch paginated data
        const gapIncomes = await GapIncomeModel.find({ receiverAddress: userAddress })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            message: "Gap income history fetched successfully",
            gapIncomes,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
}

const getWithdrawIncomeHistory = async (req, res, next) => {
    try {
        let { userAddress, page = 1, limit = 10 } = req.body;
        // page starts from 1, limit defaults to 10

        if (!userAddress) throw new Error("Please provide user address.");

        userAddress = giveCheckSummedAddress(userAddress);

        // Ensure numbers
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await WithdrawIncomeModel.countDocuments({ userAddress });

        // Fetch paginated data
        const withdrawIncomes = await WithdrawIncomeModel.find({ userAddress })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            message: "Withdraw income history fetched successfully",
            withdrawIncomes,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        next(error);
    }
}


// const upgradeNode = async (req, res, next) => {
//     try {

//         let { userAddress } = req.body;
//         const { nodeNum, amountInUsd, totalAmountInUsd, currency } = req.body;


//         if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(Number(nodeNum))) throw new Error("Invalid node number");

//         if (!["USDT", "DSC"].includes(currency)) throw new Error("Invalid currency");

//         const missingFields = Object.keys(req.body).filter(key => (key === undefined || key === null || key === "" || (typeof req.body[key] === "string" && req.body[key].trim() === "")));
//         if (missingFields.length > 0) {
//             throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
//         }

//         if (!isAddress(userAddress)) throw new Error("Invalid user address.");
//         userAddress = giveCheckSummedAddress(userAddress);

//         const amountInUsdIn1e18 = new BigNumber(amountInUsd).multipliedBy(1e18);
//         const totalAmountInUsdIn1e18 = new BigNumber(totalAmountInUsd).multipliedBy(1e18);

//         const regDoc = await RegistrationModel.findOne({ userAddress });
//         if (!regDoc) throw new Error("You have not registered yet! Stake for registration!");
//         const { nodePurchasingBalance = "0" } = regDoc;

//         const isRegisteredForNode = await dscNodeContract.methods.isUserRegForNodeConversion(userAddress).call();

//         if (!isRegisteredForNode) throw new Error("You have not registered for node upgradation!");

//         const isUserNodeDeployed = await dscNodeContract.methods.isUserNodeDeployed(userAddress).call();
//         if (isUserNodeDeployed) throw new Error("You have already deployed your node.");

//         const { price } = await LivePriceDsc.findOne();

//         if (!price) throw new Error("Live price not found.");
//         let mixTxHash = "NA"
//         const nbdAmount = nbdAmounts[nodeNum - 1];
//         const nbdAmountIn1e18 = new BigNumber(nbdAmount).multipliedBy(1e18);
//         let amountToDeduct = new BigNumber(0).plus(nbdAmountIn1e18);

//         const rateDollarPerDsc = new BigNumber(price).multipliedBy(1e18).toFixed(0);

//         const { nodeValidators } = await giveAdminSettings();
//         let generatedDsc = "0";
//         const nodeToUpgrade = nodeValidators.find(n => n.nodeNum === Number(nodeNum));
//         const userNodes = await UpgradedNodes.find({ userAddress }).sort({ time: -1 });
//         let lastNode = userNodes.length > 0 ? userNodes[0] : null;
//         if (lastNode && lastNode.isPaymentCompleted) {
//             //Only 100% USDT or 100% DSC or x% USDT is allowed
//             const lastNode = userNodes[0];
//               const userUsdtPartTx = userNodes.filter((item)=>{
//                     item.currency === "USDT"
//                 });

//             if (Number(nodeNum) > Number(lastNode.nodeNum) && lastNode.isPaymentCompleted) {

//                 const { status, message, amountToDeductInBn = null, mixTxHash = "NA" } = validateUpgradeNodeConditions(totalAmountInUsd, amountInUsd, currency, amountToDeduct)
//                 if (!status) throw new Error(message);

//                 if ((totalAmountInUsd === amountInUsd) && (currency === "USDT" || currency === "DSC")) {
//                     //all good initiate 100% usdt or dsc tx
//                     amountToDeduct = amountToDeduct.plus(amountInUsdIn1e18).minus(nodePurchasingBalance);
//                     mixTxHash = "NA";



//                 } else if (currency === "USDT" && (amountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {
//                     amountToDeduct = amountToDeduct.plus(amountInUsdIn1e18).minus(nodePurchasingBalance);
//                     mixTxHash = zeroAddressTxhash;
//                 }

//             }else if(lastNode && !lastNode.isPaymentCompleted && currency === "DSC" && totalAmountInUsdIn1e18.isEqualTo(userUsdtPartTx.totalAmountInUsd) && nodeNum==userUsdtPartTx.nodeNum){


//                 const remainingUsd = getRemainingDscToPayInUsd(totalAmountInUsdIn1e18, userNodes, nodeNum, rateDollarPerDsc);

//                 if(amountInUsdIn1e18.isGreaterThan(remainingUsd)) throw new Error(`You have to pay $${remainingUsd} of DSC only`)
//                 amountToDeduct = amountInUsdIn1e18; 
//                 mixTxHash = userUsdtPartTx.transactionHash;


//             }
//             //  else if (Number(nodeNum) === Number(lastNode.nodeNum) && !lastNode.isPaymentCompleted && (mixTransactionHash !== "NA")) {
//             //     // const userThisNodes = userNodes.map((nodeItem)=> (nodeItem.nodeNum==nodeNum));
//             //     // const paidDscAmounts = userThisNodes.filter
//             //     // ((item)=>item.currency==="DSC").reduce((sum,item)=>{

//             //     // },new BigNumber(0));
//             //     // all good , this is mix transaction
//             //     const remainingUsd = getRemainingDscToPayInUsd(totalAmountInUsdIn1e18, userNodes, nodeNum, rateDollarPerDsc);
//             //     amountToDeduct = remainingUsd;



//             // }
//             // else if (Number(nodeNum) < Number(lastNode.nodeNum)) { throw new Error("You cannot upgrade to a lower node than your last upgraded node.") }
//             // else if (Number(nodeNum) === Number(lastNode.nodeNum) && lastNode.isPaymentCompleted) { throw new Error("You have already upgraded this node!") }
//             // else if (Number(nodeNum) > Number(lastNode.nodeNum) && !lastNode.isPaymentCompleted) { throw new Error(`You have not completed your payments for ${nodeToUpgrade.name} node!`) }
//             // else {
//             //     throw new Error("Invalid Node upgrade");
//             // }

//         } else if(lastNode && !lastNode.isPaymentCompleted){
//             if(currency === "USDT") throw new Error("You have a pending DSC to pay for your last node upgradation!");
//         }

//         else {

//             // const { status, message } = validateUpgradeNodeConditions(totalAmountInUsdIn1e18, amountInUsdIn1e18, currency, amountToDeduct,nodePurchasingBalance,lastNode,nodeValidators)
//             // if (!status) throw new Error(message);

//             if ((totalAmountInUsd === amountInUsd) && (currency === "USDT" || currency === "DSC") && (amountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {
//                 //all good initiate 100% usdt or dsc tx
//                 amountToDeduct = amountToDeduct.plus(amountInUsdIn1e18).minus(nodePurchasingBalance);
//                 mixTxHash = "NA";
//                 generatedDsc = amountToDeduct.dividedBy(price).toFixed();



//             } else if ((totalAmountInUsd !== amountInUsd) && (currency === "USDT") && (totalAmountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {
//                 //for doing x% usdt and later dsc will be paid
//                 const { usd, dsc } = giveUsdDscRatioParts(totalAmountInUsdIn1e18.toFixed());
//                 if (!amountInUsdIn1e18.isEqualTo(usd)) throw new Error(`For upgrading node by mix ratio, you need to send $${new BigNumber(usd).dividedBy(1e18).toFixed()}`);
//                 amountToDeduct = amountToDeduct.plus(usd).minus(nodePurchasingBalance);
//                 mixTxHash = zeroAddressTxhash;
//             }
//             else if ((totalAmountInUsd !== amountInUsd) && (currency === "DSC") && (totalAmountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {
//                 const { usd, dsc } = giveUsdDscRatioParts(totalAmountInUsdIn1e18.toFixed());
//                 throw new Error(`For upgrading node by mix ratio, you need to send ${new BigNumber(usd).dividedBy(1e18).toFixed()} USDT.`);

//             }else{
//                 throw new Error("Invalid Transaction! please verify you are sending correct node and amounts!");
//             }
//             // else if (currency === "USDT" && (!amountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {

//             //     const { usdtRatioAmount, dscRatioAmount } = giveUsdDscRatioParts(totalAmountInUsdIn1e18.toFixed());

//             //     if (!(new BigNumber(usdtRatioAmount).isEqualTo(amountInUsdIn1e18))) {
//             //         throw new Error(`Only 100% USDT or 100% DSC or only $${usdtRatioAmount} is allowed!`);
//             //     }

//             //     amountToDeduct = amountToDeduct.plus(amountInUsdIn1e18).minus(nodePurchasingBalance);
//             //     mixTxHash = zeroAddressTxhash;
//             // }
//         }


//         let prevNonce = 0;
//         if (!lastNode) {
//             prevNonce = -1;
//         } else {
//             prevNonce = Number(lastNode.lastUsedNonce);
//         }
//         const currNonce = await dscNodeContract.methods.userNoncesForNodeUpgrade(userAddress).call();



//         if ((prevNonce + 1) !== Number(currNonce)) throw new Error("Your previous withdrawal is not stored yet! Please try again later.");


//         const hash = await dscNodeContract.methods.getHashForUpgradeNode(userAddress, amountInUsdIn1e18.toFixed(), Number(nodeNum), mixTxHash, rateDollarPerDsc, totalAmountInUsdIn1e18.toFixed()).call();

//         const vrs = await giveVrsForNodeUpgradation(userAddress, amountToDeduct.toFixed(0), Number(nodeNum), totalAmountInUsdIn1e18.toFixed(), mixTxHash, rateDollarPerDsc, Number(currNonce), hash);



//         return res.status(200).json({ success: true, message: "Node Upgradation is in process!", vrs:{...vrs,currency},generatedDsc });

//     } catch (error) {
//         next(error);
//     }
// }

const upgradeNode = async (req, res, next) => {
    try {

        let { userAddress } = req.body;
        const { nodeNum, amountInUsd, totalAmountInUsd, currency } = req.body;


        if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(Number(nodeNum))) throw new Error("Invalid node number");

        if (!["USDT", "DSC"].includes(currency)) throw new Error("Invalid currency");

        const missingFields = Object.keys(req.body).filter(key => (key === undefined || key === null || key === "" || (typeof req.body[key] === "string" && req.body[key].trim() === "")));
        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        if (!isAddress(userAddress)) throw new Error("Invalid user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        const amountInUsdIn1e18 = new BigNumber(amountInUsd).multipliedBy(1e18);
        const totalAmountInUsdIn1e18 = new BigNumber(totalAmountInUsd).multipliedBy(1e18);

        const regDoc = await RegistrationModel.findOne({ userAddress });
        if (!regDoc) throw new Error("You have not registered yet! Stake for registration!");
        const { nodePurchasingBalance = "0" } = regDoc;

        const isRegisteredForNode = await dscNodeContract.methods.isUserRegForNodeConversion(userAddress).call();

        if (!isRegisteredForNode) throw new Error("You have not registered for node upgradation!");

        const isUserNodeDeployed = await dscNodeContract.methods.isUserNodeDeployed(userAddress).call();
        if (isUserNodeDeployed) throw new Error("You have already deployed your node.");

        const { price } = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");
        let mixTxHash = "NA"
        const nbdAmount = nbdAmounts[nodeNum - 1];
        const nbdAmountIn1e18 = new BigNumber(nbdAmount).multipliedBy(1e18);
        let amountToDeduct = new BigNumber(0).plus(nbdAmountIn1e18);

        const rateDollarPerDsc = new BigNumber(price).multipliedBy(1e18).toFixed(0);

        const { nodeValidators } = await giveAdminSettings();
        let generatedDsc = "0";
        const nodeToUpgrade = nodeValidators.find(n => n.nodeNum === Number(nodeNum));
        const userNodes = await UpgradedNodes.find({ userAddress }).sort({ time: -1 });
        let lastNode = userNodes.length > 0 ? userNodes[0] : null;

        // const userUsdtPartTx = userNodes.filter((item) => {
        //    return item.currency === "USDT"
        // });

        if (lastNode && lastNode.isPaymentCompleted) {

            if (Number(nodeNum) <= lastNode.nodeNum) throw new Error("You can only upgrade to a higher node than your last upgraded node.");

            const { status, message, amountToDeductInBn = null, mixTxHash = "NA" } = validateUpgradeNodeConditions(totalAmountInUsd, amountInUsd, currency, amountToDeduct)
            if (!status) throw new Error(message);

            if ((totalAmountInUsd === amountInUsd) && (currency === "USDT" || currency === "DSC")) {
                //all good initiate 100% usdt or dsc tx
                amountToDeduct = amountToDeduct.plus(amountInUsdIn1e18).minus(nodePurchasingBalance);
                mixTxHash = "NA";



            } else if (currency === "USDT" && (amountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {
                amountToDeduct = amountToDeduct.plus(amountInUsdIn1e18).minus(nodePurchasingBalance);
                mixTxHash = zeroAddressTxhash;
            }

        } else if (lastNode && !lastNode.isPaymentCompleted) {

            if (nodeNum !== lastNode.nodeNum) throw new Error("You can only pay DSC for your last pending node upgradation!");
            if (currency === "USDT") throw new Error("You have a pending DSC to pay for your last node upgradation!");
            if (currency === "DSC" && totalAmountInUsdIn1e18.isGreaterThan(lastNode.totalAmountInUsd)) throw new Error("You have already paid some amount for this node! Pay remaining DSC amount only!");

            const userNodes = await UpgradedNodes.find({ userAddress, nodeNum }).sort({ time: -1 });
            const userUsdtPartTx = userNodes.find((item) => {
                return item.currency === "USDT"
            });
            console.log("sdfasdf", userNodes);
            const targetTotalAmount = userUsdtPartTx.totalAmountInUsd;
            const userUsdtPaymentAlreadyPaid = userUsdtPartTx.amountUsdPaid;
            const userRemainingUsdToPay = new BigNumber(targetTotalAmount).minus(userUsdtPaymentAlreadyPaid);
            if ((amountInUsd === 0) || amountInUsdIn1e18.isGreaterThan(userRemainingUsdToPay)) throw new Error(`You have to pay $${new BigNumber(userRemainingUsdToPay).dividedBy(1e18).toFixed()} of DSC only!`);
            if (!totalAmountInUsdIn1e18.isEqualTo(targetTotalAmount)) throw new Error("You cannot change total amount in mix transaction!");



            amountToDeduct = amountInUsdIn1e18;
            mixTxHash = userUsdtPartTx.transactionHash;
            generatedDsc = amountToDeduct.dividedBy(price).toFixed();


        } 
        else {



            if ((totalAmountInUsd === amountInUsd) && (currency === "USDT" || currency === "DSC") && (amountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {
                //all good initiate 100% usdt or dsc tx
                amountToDeduct = amountToDeduct.plus(amountInUsdIn1e18).minus(nodePurchasingBalance);
                mixTxHash = "NA";
                generatedDsc = amountToDeduct.dividedBy(price).toFixed();



            } else if ((totalAmountInUsd !== amountInUsd) && (currency === "USDT") && (totalAmountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {
                //for doing x% usdt and later dsc will be paid
                const { usd, dsc } = giveUsdDscRatioParts(totalAmountInUsdIn1e18.toFixed());
                if (!amountInUsdIn1e18.isEqualTo(usd)) throw new Error(`For upgrading node by mix ratio, you need to send $${new BigNumber(usd).dividedBy(1e18).toFixed()}`);
                amountToDeduct = amountToDeduct.plus(usd).minus(nodePurchasingBalance);
                mixTxHash = zeroAddressTxhash;
            }
            else if ((totalAmountInUsd !== amountInUsd) && (currency === "DSC") && (totalAmountInUsdIn1e18.isEqualTo(nodeToUpgrade.selfStaking))) {
                const { usd, dsc } = giveUsdDscRatioParts(totalAmountInUsdIn1e18.toFixed());
                throw new Error(`For upgrading node by mix ratio, you need to send ${new BigNumber(usd).dividedBy(1e18).toFixed()} USDT.`);

            } else {
                throw new Error("Invalid Transaction! please verify you are sending correct node and amounts!");
            }

        }


        let prevNonce = 0;
        if (!lastNode) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastNode.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForNodeUpgrade(userAddress).call();



        if ((prevNonce + 1) !== Number(currNonce)) throw new Error("Your previous withdrawal is not stored yet! Please try again later.");


        const hash = await dscNodeContract.methods.getHashForUpgradeNode(userAddress, amountInUsdIn1e18.toFixed(), Number(nodeNum), mixTxHash, rateDollarPerDsc, totalAmountInUsdIn1e18.toFixed()).call();

        const vrs = await giveVrsForNodeUpgradation(userAddress, amountToDeduct.toFixed(0), Number(nodeNum), totalAmountInUsdIn1e18.toFixed(), mixTxHash, rateDollarPerDsc, Number(currNonce), hash);



        return res.status(200).json({ success: true, message: "Node Upgradation is in process!", vrs: { ...vrs, currency }, generatedDsc });

    } catch (error) {
        next(error);
    }
}


const getRoiHistory = async (req, res, next) => {
    try {
        let { userAddress, page = 1, limit = 10 } = req.body;

        if (!userAddress) throw new Error("Please provide user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        // Ensure numbers
        page = parseInt(page);
        limit = parseInt(limit);

        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1) limit = 10;

        const skip = (page - 1) * limit;

        // Fetch total count for pagination
        const totalRecords = await RoiModel.countDocuments({ userAddress });

        // Fetch paginated data, sorted by most recent first
        const roiHistory = await RoiModel.find({ userAddress })
            .sort({ time: -1 }) // most recent first
            .skip(skip)
            .limit(limit)
            .lean(); // lean() gives plain JS objects

        const totalPages = Math.ceil(totalRecords / limit);

        res.json({
            success: true,
            data: roiHistory,
            pagination: {
                page,
                limit,
                totalRecords,
                totalPages
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    stakeVrs,
    getRoiHistory,
    upgradeNode,
    getLiveDscPrice,
    getUserInfo,
    getUserStakings,
    withdrawIncomeUsdt,
    withdrawIncomeDsc,
    convertToNode,
    getGapIncomeHistory,
    getWithdrawIncomeHistory,
    stakeMix
};

