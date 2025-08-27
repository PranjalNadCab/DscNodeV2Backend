const { hash } = require("crypto");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const { giveVrsForStaking, ct, giveCheckSummedAddress, giveVrsForWithdrawIncomeUsdt, giveVrsForWithdrawIncomeDsc } = require("../helpers/helper");
const StakingModel = require("../models/StakingModel");
const BigNumber = require("bignumber.js");
const { dscNodeContract } = require("../web3/web3");
const RegistrationModel = require("../models/RegistrationModel");
const WithdrawIncomeModel = require("../models/WithdrawIncomeModel");
const { isAddress } = require("web3-validator");
const Admin = require("../models/AdminModel");


const stakeVrs = async (req, res, next) => {
    try {
        // Extract user data from request body

        const { user, amountDsc, amountDscInUsd, amountUsdt, priceDscInUsd, sponsorAddress } = req.body; //amounts will be in number

        const missingFields = Object.keys(req.body).filter(key => (key === undefined || key === null || key === "" || (typeof req.body[key] === "string" && req.body[key].trim() === "")));
        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        // if (!user || !amountDsc || !amountDscInUsd || !amountUsdt || !priceDscInUsd || !sponsorAddress) throw new Error("Please send all the required fields.");

        let formattedSponsor = giveCheckSummedAddress(sponsorAddress);
        let formattedUser = giveCheckSummedAddress(user);
        const sponsorDoc = await RegistrationModel.findOne({ userAddress: formattedSponsor });
        if (!sponsorDoc) throw new Error("Sponsor not found. Please register your sponsor first.");

        const totalUsd = Number(amountDscInUsd) + Number(amountUsdt);
        if (totalUsd < 100) throw new Error("Total amount must be at least $100.");
        if (totalUsd % 100 !== 0) throw new Error("You can only stake multiples of $100.");

        const { price } = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");

        const generatedAmountDsc = amountDscInUsd / price;
        const generatedAmountDscInUsd = price * amountDsc;

        ct({ generatedAmountDsc, amountDsc, generatedAmountDscInUsd, amountDscInUsd });
        if (Math.abs(generatedAmountDscInUsd - amountDscInUsd) > 0.02) {
            throw new Error("DSC amount does not match the calculated amount based on USD value.");
        }


        const amountDscInUsdIn1e18 = new BigNumber(amountDscInUsd).multipliedBy(1e18).toFixed(0);
        const amountDscIn1e18 = new BigNumber(generatedAmountDsc).multipliedBy(1e18).toFixed(0);
        const amountUsdtIn1e18 = new BigNumber(amountUsdt).multipliedBy(1e18).toFixed(0);
        const priceDscInUsdIn1e18 = new BigNumber(price).multipliedBy(1e18).toFixed(0);

        const lastStake = await StakingModel.findOne({ userAddress: user }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastStake) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastStake.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForStaking(user).call();
        if ((prevNonce + 1) !== Number(currNonce)) {
            // throw new Error("Your previous stake is not stored yet! Please try again later.");
        }

        const hash = await dscNodeContract.methods.getHashForStaking(user, amountDscIn1e18, amountDscInUsdIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18).call();

        const vrsSign = await giveVrsForStaking(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, Number(currNonce));


        return res.status(200).json({ success: true, message: "Vrs generated successfully", price: price, generatedAmountDsc, sentAmountDsc: amountDsc, vrsSign: { ...vrsSign, sponsorAddress: sponsorDoc.userAddress } });
    } catch (error) {
        console.error("Error in stakeVrs:", error);
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
            // throw new Error("Your previous withdrawal is not stored yet! Please try again later.");
        }
        
     
        const hash = await dscNodeContract.methods.getHashForWithdrawIncomeUsdt(userAddress, amountUsdtIn1e18.toFixed(0),amountUsdtIn1e18AfterDeduction).call();
        // If validation passed, continue with withdrawal (not implemented yet)

        const vrsSign = await giveVrsForWithdrawIncomeUsdt( amountUsdtIn1e18, userAddress, hash, Number(currNonce),amountUsdtIn1e18AfterDeduction);

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

        let {  dscIncomeWallet } = userRegDoc;

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
            // throw new Error("Your previous withdrawal is not stored yet! Please try again later.");
        }
        
     
        const hash = await dscNodeContract.methods.getHashForWithdrawIncomeDsc(userAddress, amountDscIn1e18.toFixed(0), amountDscInUsdIn1e18, amountDscInUsdIn1e18AfterDeduction,amountDscIn1e18AfterDeduction,priceDscInUsdIn1e18).call();
        // If validation passed, continue with withdrawal (not implemented yet)

        const vrsSign = await giveVrsForWithdrawIncomeDsc(amountDscInUsdIn1e18, amountDscIn1e18, priceDscInUsdIn1e18, userAddress, hash, Number(currNonce),amountDscInUsdIn1e18AfterDeduction,amountDscIn1e18AfterDeduction);

        return res.status(200).json({
            success: true,
            message: "Withdraw income request validated successfully. (Transfer logic not implemented yet.)",
            vrsSign
        });

    } catch (error) {
        next(error);
    }
};

const convertToNode = async (req,res,next)=>{
    try{

        let {userAddress,nodeName} = req.body;
        if(!userAddress || !nodeName) throw new Error("Please provide all the required fields.");
        if(typeof nodeName !== "string") throw new Error("Node name must be a string.");

        if(!isAddress(userAddress)) throw new Error("Invalid user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        const adminDoc = await Admin.findOne({});

        if(!adminDoc) throw new Error("Admin not found.");

        const {nodeValidators} = adminDoc;

        const nodeIndexRequested = nodeValidators.findIndex(n=>n.nodeName.toLowerCase() === nodeName.toLowerCase());
        if(nodeIndexRequested === -1) throw new Error("Node not found.");

        const userDoc = await RegistrationModel.findOne({userAddress});

        if(!userDoc) throw new Error("User not found.");

        const {userTotalStakeInUsd,currentNodeName} = userDoc;

        const currentNodeIndex = currentNodeName ? nodeValidators.findIndex(n=>n.nodeName.toLowerCase() === currentNodeName.toLowerCase()) : -1;
        if(currentNodeIndex !== -1 && currentNodeIndex >= nodeIndexRequested) throw new Error("You have already achieved this node or a higher one.");

        const userTotalStakeInUsdBN = new BigNumber(userTotalStakeInUsd);







        return res.status(200).json({success:true,message:"Convert to node endpoint"});
    }catch(error){
        next(error);
    }
}


module.exports = {
    stakeVrs,
    getLiveDscPrice,
    getUserInfo,
    getUserStakings,
    withdrawIncomeUsdt,
    withdrawIncomeDsc,
    convertToNode
};

