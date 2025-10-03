const axios = require("axios");
const BigNumber = require("bignumber.js");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const { web3 } = require("../web3/web3");

const url = "https://explorer.pancakeswap.com/api/cached/pools/v2/bsc/list/top?token=0xe0eae74bec76696cc82df119ea35653506d54155";


const routerAbi = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" }
        ],
        "name": "getAmountsOut",
        "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    }
];

const routerAddress = process.env.PANCAKE_ROUTER; // Pancake V2 testnet router
const router = new web3.eth.Contract(routerAbi, routerAddress);

async function getBNBPrice() {
    try{
        const WBNB = process.env.NATIVE_COIN_ADDRESS; // WBNB testnet
        const BUSD = process.env.USDT_TOKEN_ADDRESS; // BUSD testnet
    
        const amountIn = web3.utils.toWei("1", "ether"); // 1 BNB
        const path = [WBNB, BUSD]; // Price of BNB in BUSD
    
        const amountsOut = await router.methods.getAmountsOut(amountIn, path).call();
        // console.log(`1 DSC = ${web3.utils.fromWei(amountsOut[1], "ether")} BUSD`);
        const price = web3.utils.fromWei(amountsOut[1], "ether");
    
        console.log(`1 DSC = ${price} USDT`);
        return {status:true,price:price}; 
    }catch(error){
        return {status:false,price:0};
    }
    
}




const getLivePrice = async () => {
    try {
        const res = await getBNBPrice();
        if (res.status == true) {
            // let currentRate = res.data[0].token0Price;

            // currentRate = parseFloat(currentRate);
            // currentRate = 30 * (currentRate);
            // currentRate = currentRate.toFixed(8);
            let currentRateInNumber = Number(res.price);

            // currentRate = new BigNumber(currentRate).multipliedBy(1e18).toFixed(0);
            if (process.env.NODE_ENV === "development") {
                currentRateInNumber = 5000000
                console.log("currentRateInNumber", currentRateInNumber);
            }

            const updateLiveDscPrice = await LivePriceDsc.findOneAndUpdate({}, { price: currentRateInNumber }, { new: true, upsert: true });

            return currentRateInNumber;
        }

    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getLivePrice
};