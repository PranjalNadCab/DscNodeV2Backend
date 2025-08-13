const { hash } = require("crypto");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const { giveVrsForStaking, ct } = require("../helpers/helper");
const StakingModel = require("../models/StakingModel");
const BigNumber = require("bignumber.js");
const { dscNodeContract } = require("../web3/web3");


const stakeVrs = async(req,res,next)=> {
    try {
        // Extract user data from request body

        const {user, amountDsc,amountDscInUsd, amountUsdt, priceDscInUsd} = req.body; //amounts will be in number

        if (!user || !amountDsc || !amountDscInUsd || !amountUsdt || !priceDscInUsd) throw new Error("Please send all the required fields.");

        const totalUsd = Number(amountDscInUsd) + Number(amountUsdt);
        if(totalUsd < 100) throw new Error("Total amount must be at least $100.");
        if(totalUsd % 100 !== 0) throw new Error("You can only stake multiples of $100.");

        const {price} = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");

        const generatedAmountDsc = amountDscInUsd/price;
        const generatedAmountDscInUsd = price * amountDsc;

        ct({generatedAmountDsc,amountDsc,generatedAmountDscInUsd,amountDscInUsd});
        if (Math.abs(generatedAmountDscInUsd - amountDscInUsd) > 0.02) {
            throw new Error("DSC amount does not match the calculated amount based on USD value.");
        }


        const amountDscInUsdIn1e18 = new BigNumber(amountDscInUsd).multipliedBy(1e18).toFixed(0);
        const amountDscIn1e18 = new BigNumber(generatedAmountDsc).multipliedBy(1e18).toFixed(0);
        const amountUsdtIn1e18 = new BigNumber(amountUsdt).multipliedBy(1e18).toFixed(0);
        const priceDscInUsdIn1e18 = new BigNumber(price).multipliedBy(1e18).toFixed(0);

        const lastStake = await StakingModel.findOne({ userAddress:user }).sort({ lastUsedNonce: -1 });
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

        const vrsSign = await giveVrsForStaking(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user,hash,Number(currNonce));


        return res.status(200).json({success:true, message:"Vrs generated successfully",price:price,generatedAmountDsc,sentAmountDsc:amountDsc,vrsSign});
    } catch (error) {
        console.error("Error in stakeVrs:", error);
        next(error);
    }

}

module.exports = {
    stakeVrs
};

