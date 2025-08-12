const dotenv = require("dotenv");
dotenv.config();
const {Web3} = require("web3");
const DSCNODE_ABI = require("../abis/dscNode.json");

console.log("Connecting to web3...",process.env.RPC_URL);
const web3 = new Web3(
    new Web3.providers.HttpProvider(process.env.RPC_URL, {
        reconnect: {
            auto: true,
            delay: 5000, // ms
            maxAttempts: 15,
            onTimeout: false,
        },
    })
);

const dscNodeContract = new web3.eth.Contract(
    DSCNODE_ABI,
    process.env.DSCNODE_CONTRACT_ADDRESS
);

module.exports = {
    web3,
    dscNodeContract
}













