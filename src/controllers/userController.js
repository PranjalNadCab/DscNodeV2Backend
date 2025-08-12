const { hash } = require("crypto");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const { giveVrsForStaking } = require("../helpers/helper");



const stakeVrs = async(req,res,next)=> {
    try {
        // Extract user data from request body

        const {user, dscAmount,dscAmountInUsd, usdtAmount, priceDscInUsd} = req.body; //amounts will be in number

        if (!user || !dscAmount || !dscAmountInUsd || !usdtAmount || !priceDscInUsd) throw new Error("Please send all the required fields.");

        const totalUsd = Number(dscAmountInUsd) + Number(usdtAmount);
        if(totalUsd < 100) throw new Error("Total amount must be at least $100.");
        if(totalUsd % 100 !== 0) throw new Error("You can only stake multiples of $100.");

        const {price} = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");

        const generatedDscAmount = dscAmountInUsd/price;

        if (Math.abs(dscAmount - generatedDscAmount) > 0.2) {
            throw new Error("DSC amount does not match the calculated amount based on USD value.");
        }

        const dscAmountInUsdIn1e18 = new BigNumber(dscAmountInUsd).multipliedBy(1e18).toFixed(0);
        const dscAmountIn1e18 = new BigNumber(generatedDscAmount).multipliedBy(1e18).toFixed(0);
        const usdtAmountIn1e18 = new BigNumber(usdtAmount).multipliedBy(1e18).toFixed(0);
        const priceDscInUsdIn1e18 = new BigNumber(price).multipliedBy(1e18).toFixed(0);

        // const lastWithdrawFund = await WithDrawFundModel.findOne({ userAddress }).sort({ nonce: -1 });
        // let prevNonce = 0;
        // if (!lastWithdrawFund) {
        //     prevNonce = -1;
        // } else {
        //     prevNonce = Number(lastWithdrawFund.nonce);
        // }
        // const currNonce = await et_contract.methods.userNoncesForWithdrawl(userAddress).call();
        // if ((prevNonce + 1) !== Number(currNonce)) {
        //     throw new Error("Your previous withdrawl is not stored yet! Please import your withdrawl!")
        // }

        // const hashForWithdrawal = await et_contract.methods.getHashForWithdrawlSch(userAddress, withDrawAmountSchAfterDeductionIn1e8, withDrawAmountSchIn1e18, withDrawAmountUsdtIn1e18, currentDollarRatePerSchIn1e18).call();

        const hash = null;
        const nonce = null;
        const vrsSign = await giveVrsForStaking(dscAmountInUsdIn1e18, dscAmountIn1e18, usdtAmountIn1e18, priceDscInUsdIn1e18, user,hash,nonce);


        return res.status(200).json({success:true, message:"Vrs generated successfully",price:price,generatedDscAmount,sentDscAmount:dscAmount,vrsSign});
    } catch (error) {
        console.error("Error in stakeVrs:", error);
        next(error);
    }

}

module.exports = {
    stakeVrs
};

