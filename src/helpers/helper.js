 const ct = (payload) => {
    console.table(payload);
  };


  function giveVrsForStaking(dscAmountInUsdIn1e18, dscAmountIn1e18, usdtAmountIn1e18, priceDscInUsdIn1e18, user, hash,nonce) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce


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

  module.exports = {ct,giveVrsForStaking}