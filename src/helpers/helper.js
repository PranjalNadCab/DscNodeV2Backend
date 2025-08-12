const RegistrationModel = require("../models/RegistrationModel");
const {web3} = require("../web3/web3")
const ct = (payload) => {
    console.table(payload);
};


function giveVrsForStaking(dscAmountInUsdIn1e18, dscAmountIn1e18, usdtAmountIn1e18, priceDscInUsdIn1e18, user, hash, nonce) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce
            ct({dscAmountInUsdIn1e18, dscAmountIn1e18, usdtAmountIn1e18, priceDscInUsdIn1e18, user, hash, nonce})

            const data = {
                hash: hash,
                nonce: nonce,
                user: user,
                dscAmountInUsdIn1e18,
                dscAmountIn1e18,
                usdtAmountIn1e18,
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

const registerUser = async (userAddress, time) => {
    try {
        const user = await RegistrationModel.findOne({ userAddress });
        if (!user) {
            const newUser = await RegistrationModel.create({
                userAddress,
                time: time || Math.floor(Date.now() / 1000)
            });
        }
    } catch (error) {
        console.error("Error registering user:", error);
        throw error;
    }
}

module.exports = { ct, giveVrsForStaking,registerUser }