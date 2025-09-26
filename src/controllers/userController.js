const { hash } = require("crypto");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const { giveVrsForStaking, ct, giveCheckSummedAddress, giveVrsForWithdrawIncomeUsdt, giveVrsForWithdrawIncomeDsc, giveVrsForNodeConversionAndRegistration, giveAdminSettings, giveVrsForNodeConversion, validateStake, giveVrsForMixStaking } = require("../helpers/helper");
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
const { usdDscRatio, ratioUsdDsc } = require("../helpers/constant");



// const stakeVrs = async (req, res, next) => {
//     try {
//         // Extract user data from request body

//         const { amountDsc, amountDscInUsd, amountUsdt } = req.body; //amounts will be in number
//         const {amountInUsd, currency,totalAmountInUsd} = req.body;
//         let { user, sponsorAddress } = req.body;

//         const missingFields = Object.keys(req.body).filter(key => (key === undefined || key === null || key === "" || (typeof req.body[key] === "string" && req.body[key].trim() === "")));
//         if (missingFields.length > 0) {
//             throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
//         }

//         // if (!user || !amountDsc || !amountDscInUsd || !amountUsdt || !priceDscInUsd || !sponsorAddress) throw new Error("Please send all the required fields.");

//         user = giveCheckSummedAddress(user);
//         sponsorAddress = giveCheckSummedAddress(sponsorAddress);

//         const isUserExist = await RegistrationModel.findOne({ userAddress: user });

//         let sponsorDoc = await RegistrationModel.findOne({ userAddress: sponsor });
//         if (!sponsorDoc) throw new Error("Sponsor not found. Please register your sponsor first.");



//         // const totalUsd = Number(amountDscInUsd) + Number(amountUsdt);
//         if (totalAmountInUsd < 100) throw new Error("Total amount must be at least $100.");
//         if (totalAmountInUsd % 100 !== 0) throw new Error("You can only stake multiples of $100.");

//         if(totalAmountInUsd === amountInUsd && currency === "USDT"){

//         }else if( totalAmountInUsd === amountInUsd && currency === "DSC"){

//         }else{

//         }


//         // ✅ Ratio validation
//         const ratioUsdt = (Number(amountUsdt) * 100) / totalUsd;
//         const ratioDsc = (Number(amountDscInUsd) * 100) / totalUsd;

//         const adminDoc = await Admin.findOne({});

//         if (!adminDoc) throw new Error("Admin not found.");
//         const { stakeRatio } = adminDoc;

//         const totalParts = stakeRatio.part1 + stakeRatio.part2;

//         // calculate expected ratios
//         const expectedUsdt = (stakeRatio.part1 / totalParts) * 100;
//         const expectedDsc = (stakeRatio.part2 / totalParts) * 100;

//         ct({ ratioUsdt, ratioDsc, expectedUsdt, expectedDsc });
//         // tolerance margin for floating point errors
//         const tolerance = 0.01;

//         const validUsdtOnly = ratioUsdt === 100 && ratioDsc === 0;
//         const validDscOnly = ratioDsc === 100 && ratioUsdt === 0;
//         const validMix =
//             Math.abs(ratioUsdt - expectedUsdt) < tolerance &&
//             Math.abs(ratioDsc - expectedDsc) < tolerance;

//         if (!(validUsdtOnly || validDscOnly || validMix)) {
//             throw new Error(
//                 `You can only stake 100% USDT, 100% DSC, or ${expectedUsdt}% USDT + ${expectedDsc}% DSC.`
//             );
//         }

//         const { price } = await LivePriceDsc.findOne();

//         if (!price) throw new Error("Live price not found.");

//         const generatedAmountDsc = amountDscInUsd / price;
//         const generatedAmountDscInUsd = price * amountDsc;

//         ct({ generatedAmountDsc, amountDsc, generatedAmountDscInUsd, amountDscInUsd });
//         if (Math.abs(generatedAmountDscInUsd - amountDscInUsd) > 0.02) {
//             throw new Error("DSC amount does not match the calculated amount based on USD value.");
//         }


//         const amountDscInUsdIn1e18 = new BigNumber(amountDscInUsd).multipliedBy(1e18).toFixed(0);
//         const amountDscIn1e18 = new BigNumber(generatedAmountDsc).multipliedBy(1e18).toFixed(0);
//         const amountUsdtIn1e18 = new BigNumber(amountUsdt).multipliedBy(1e18).toFixed(0);
//         const priceDscInUsdIn1e18 = new BigNumber(price).multipliedBy(1e18).toFixed(0);

//         const lastStake = await StakingModel.findOne({ userAddress: user }).sort({ lastUsedNonce: -1 });
//         let prevNonce = 0;
//         if (!lastStake) {
//             prevNonce = -1;
//         } else {
//             prevNonce = Number(lastStake.lastUsedNonce);
//         }
//         const currNonce = await dscNodeContract.methods.userNoncesForStaking(user).call();
//         if ((prevNonce + 1) !== Number(currNonce)) {
//             throw new Error("Your previous stake is not stored yet! Please try again later.");
//         }

//         const hash = await dscNodeContract.methods.getHashForStaking(user, amountDscIn1e18, amountDscInUsdIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18).call();

//         const vrsSign = await giveVrsForStaking(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, Number(currNonce));


//         return res.status(200).json({ success: true, message: "Vrs generated successfully", price: price, generatedAmountDsc, sentAmountDsc: amountDsc, vrsSign: { ...vrsSign, sponsorAddress: sponsorDoc.userAddress } });
//     } catch (error) {
//         console.error("Error in stakeVrs:", error);
//         next(error);
//     }

// }

const stakeVrs = async (req, res, next) => {
    try {
        // Extract user data from request body

        const { amountInUsd, currency, totalAmountInUsd } = req.body;
        let { user, sponsorAddress } = req.body;

        const missingFields = Object.keys(req.body).filter(key => (key === undefined || key === null || key === "" || (typeof req.body[key] === "string" && req.body[key].trim() === "")));
        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        // if (!user || !amountDsc || !amountDscInUsd || !amountUsdt || !priceDscInUsd || !sponsorAddress) throw new Error("Please send all the required fields.");

        user = giveCheckSummedAddress(user);
        sponsorAddress = giveCheckSummedAddress(sponsorAddress);

        const isUserExist = await RegistrationModel.findOne({ userAddress: user });

        let sponsorDoc = await RegistrationModel.findOne({ userAddress: sponsor });
        if (!sponsorDoc) throw new Error("Sponsor not found. Please register your sponsor first.");



        // const totalUsd = Number(amountDscInUsd) + Number(amountUsdt);
        if (totalAmountInUsd < 100) throw new Error("Total amount must be at least $100.");
        if (totalAmountInUsd % 100 !== 0) throw new Error("You can only stake multiples of $100.");

        const { price } = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");
        const rateDollarPerDsc = new BigNumber(price).multipliedBy(1e18).toFixed(0);

        const lastStake = await StakingModel.findOne({ userAddress: user }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastStake) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastStake.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForStaking(user).call();
        const hash = await dscNodeContract.methods.getHashForStaking(user, amountInUsd, currency, rateDollarPerDsc, "NA", totalAmountInUsd).call();
        let mixTxHash="NA";
        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous stake is not stored yet! Please try again later.");
        }

        if (totalAmountInUsd === amountInUsd && currency === "USDT") {

            
        } else if (totalAmountInUsd === amountInUsd && currency === "DSC") {
            const generatedAmountDsc = amountInUsd / price;
            ct({ generatedAmountDsc, totalAmountInUsd, amountInUsd });
        } else {
            //call another helper function
            
        }

        const vrsSign = await giveVrsForStaking(user, amountInUsd, currency, rateDollarPerDsc,mixTxHash,totalAmountInUsd, hash, Number(currNonce));





        return res.status(200).json({ success: true, message: "Vrs generated successfully", price: price,vrsSign,sponsorAddress });
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

const nodeRegistration = async (req, res, next) => {
    try {
        let { userAddress } = req.body;
        const { nodeName } = req.body;
        if (!userAddress) throw new Error("Please provide all the required fields.");

        if (!isAddress(userAddress)) throw new Error("Invalid user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        const userDoc = await RegistrationModel.findOne({ userAddress });

        if (!userDoc) throw new Error("User not found.");

        const isRegistered = await dscNodeContract.methods.isUserRegForNodeConversion(userAddress).call();

        if (isRegistered) throw new Error("You have already registered!");

        const { nodeValidators } = await giveAdminSettings();
        // [0].selfStaking*0.1
        let amountToDeduct = new BigNumber(nodeValidators.find(n => n.nodeNum === 1).selfStaking * 0.1).toFixed() || new BigNumber(300).multipliedBy(1e18).toFixed();

        const currNonce = await dscNodeContract.methods.userNoncesForNodeConversion(userAddress).call();

        if (Number(currNonce) !== 0) throw new Error("You have already registered!");

        const action = "Registration";
        const nodeNum = 0;
        const hash = await dscNodeContract.methods.getHashForNodeRegistration(userAddress, amountToDeduct, action, nodeNum, userDoc.nodePurchasingBalance).call();


        //make VRS

        const vrs = await giveVrsForNodeConversionAndRegistration(userAddress, amountToDeduct, action, nodeNum, userDoc.nodePurchasingBalance, Number(currNonce), hash);



        return res.status(200).json({ success: true, message: "Node registration is in process", vrs });

    } catch (error) {
        next(error);
    }
}

const purchaseNode = async (req, res, next) => {
    try {

        let { userAddress, nodeNum } = req.body;

        if (!userAddress || !nodeNum) throw new Error("Please provide all the required fields.");

        if (!isAddress(userAddress)) throw new Error("Invalid user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        const isRegistered = await dscNodeContract.methods.isUserRegForNodeConversion(userAddress).call();

        if (!isRegistered) throw new Error("You have not registered for node upgradation!");

        const regDoc = await RegistrationModel.findOne({ userAddress });
        if (!regDoc) throw new Error("Please do your first staking for registration");

        const { nodePurchasingBalance = "0" } = regDoc;
        console.log("kldsfgsdfg", nodePurchasingBalance, regDoc);

        const isNodeAlreadyUpgraded = await UpgradedNodes.findOne({ userAddress, nodeNum: Number(nodeNum) });

        if (isNodeAlreadyUpgraded) throw new Error("You have already upgraded this node!");

        const { nodeValidators } = await giveAdminSettings();

        const myNode = nodeValidators.find(n => n.nodeNum === Number(nodeNum));

        if (!myNode) throw new Error("Node not found");

        const baseNodeValue = new BigNumber(myNode.selfStaking);

        // if(new BigNumber(userTotalStakeInUsd).multipliedBy(1e18).isLessThan(baseNodeValue.toFixed())) throw new Error(`You need atleast $${Number(myNode.selfStaking)/1e18} of staking`)

        const percentToAdd = 0.1
        let amountToDeduct = baseNodeValue
            .minus(nodePurchasingBalance)   // subtract balance
            .plus(baseNodeValue.multipliedBy(percentToAdd)); // add 10%
        // if(new BigNumber(nodePurchasingBalance).isLessThan(baseNodeValue)) {
        //     amountToDeduct = BigNumber.max(baseNodeValue.multipliedBy(0.1).minus(nodePurchasingBalance), 0);
        //     console.log(amountToDeduct.toFixed())

        // }

        ct({ nodePurchasingBalance, baseNodeValue: baseNodeValue.toFixed() })

        const lastNode = await UpgradedNodes.findOne({ userAddress: userAddress }).sort({ lastUsedNonce: -1 });

        let prevNonce = 0;
        if (!lastNode) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastNode.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForNodePurchasing(userAddress).call();



        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous withdrawal is not stored yet! Please try again later.");
        }

        ct({ uid: "kdgsdrg", type: typeof amountToDeduct });
        const hash = await dscNodeContract.methods.getHashForNodeRegistration(userAddress, amountToDeduct.toFixed(), myNode.name, myNode.nodeNum, nodePurchasingBalance).call();

        const vrs = await giveVrsForNodeConversionAndRegistration(userAddress, amountToDeduct.toFixed(0), myNode.name, myNode.nodeNum, nodePurchasingBalance, Number(currNonce), hash);



        return res.status(200).json({ success: true, message: "Node Upgradation is in process!", vrs });

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
    purchaseNode,
    getLiveDscPrice,
    getUserInfo,
    getUserStakings,
    withdrawIncomeUsdt,
    withdrawIncomeDsc,
    convertToNode,
    getGapIncomeHistory,
    getWithdrawIncomeHistory,
    nodeRegistration,
    stakeMix
};

