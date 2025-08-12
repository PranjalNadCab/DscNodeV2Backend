const axios = require("axios");
const BigNumber = require("bignumber.js");
const LivePriceDsc = require("../models/LiveDscPriceModel");

const url = "https://explorer.pancakeswap.com/api/cached/pools/v2/bsc/list/top?token=0xe0eae74bec76696cc82df119ea35653506d54155";



 const getLivePrice = async()=>{
    try{
        const res = await axios.get(url);
        if(res.status === 200){
            let currentRate = res.data[0].token0Price;

                currentRate = parseFloat(currentRate);
                currentRate = 30*(currentRate);
                currentRate = currentRate.toFixed(8);
                const currentRateInNumber = Number(currentRate);
                
                currentRate = new BigNumber(currentRate).multipliedBy(1e18).toFixed(0);
                console.log("currentRate",currentRate);

                const updateLiveDscPrice = await LivePriceDsc.findOneAndUpdate({},{price:currentRateInNumber},{new:true, upsert:true});

            return currentRate;
        }

    }catch(error){
        console.log(error)
    }
}

module.exports = {
    getLivePrice
};