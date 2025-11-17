const { ct, giveGapIncome } = require("./helpers/helper");
const AssuranceFeeModel = require("./models/AssuranceFeeModel");
const NodeDeployedModel = require("./models/NodeDeployedModel");
const RegistrationModel = require("./models/RegistrationModel");
const moment = require("moment");
const UpgradedNodes = require("./models/UpgradeNodeModel");
const { BigNumber } = require("bignumber.js");


const giveUserTeam = async (userAddress=null) => {
    try {
        console.log("here")
        const downlineTeam = await RegistrationModel.aggregate([
            {
                $match: {
                    userAddress: "0x384ce8b6122166E7882CD49Ce78F12C3E0bf57Ed"
                }
            },
            {
                $graphLookup: {
                    from: "registration",
                    startWith: "$userAddress",
                    connectFromField: "userAddress",
                    connectToField: "sponsorAddress",
                    as: "downline",
                    maxDepth: 10000,
                    depthField: "level"
                }
            },
            {
                $unwind: {
                    path: "$downline",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project:{
                    level:{$add: ["$downline.level",1]},
                    userAddress: "$downline.userAddress",
                    uniqueRandomId:"$downline.uniqueRandomId",
                    currentRank:"$downline.currentRank",
                    userTotalStakeInUsd:"$downline.userTotalStakeInUsd",
                    userDirectPlusSelfStakeInUsd:"$downline.userDirectPlusSelfStakeInUsd"
                    
                  }
            },
            {
                $sort: { level: 1}
            }
        ]);
        const team = downlineTeam;

        for (const member of team) {
           
            const { userAddress, level, uniqueRandomId, currentRank, userTotalStakeInUsd, userDirectPlusSelfStakeInUsd } = member;

            ct({ userAddress, level, uniqueRandomId, currentRank, userTotalStakeInUsd, userDirectPlusSelfStakeInUsd });
        }

    } catch (error) {
        console.error("Error in giveUserTeam:", error);
    }
}

const updateLastRoiDistributedToPaidAssuranceFees = async()=>{
    try{
        const allFees = await AssuranceFeeModel.find({});

        for(const fee of allFees){
            
            
            const userDeployedNode = await NodeDeployedModel.findOne({userAddress:fee.userAddress,nodeNum:fee.nodeNum}).sort({deployedAt:-1}).limit(1);
            
            if(userDeployedNode){
                ct({userAddress:userDeployedNode.userAddress ,feeId:(fee._id).toString(),amount:fee.amount,time:fee.time,lastRoiDistributed:userDeployedNode.lastRoiDistributed});
                const startOfDayUnix = moment.unix(fee.time).startOf('day').unix();
                userDeployedNode.lastRoiDistributed = startOfDayUnix;
                // await userDeployedNode.save();
            }
            // break;
        }

    }catch(error){
        console.log(error);
    }
}

const distributeGapIncome = async()=>{
    try{

        const sponsoredTxs = await UpgradedNodes.find({"paidBy.userType":{$ne:"self"},userAddress:{$ne:"0x2E7D16145771e74463a9Cac152dF311372166C82"}});

        console.log(`sponsored transactions found: ${sponsoredTxs.length}`);

        let count=0;

        for(const tx of sponsoredTxs){
            // ct({userAddress:tx.paidBy.userAddress,txHash:tx.transactionHash,amountUsdPaid:tx.amountUsdPaid,time:tx.time});
            count++;
            const {userAddress,nodeNum,totalAmountInUsd,amountUsdPaid,time,isPaymentCompleted,rateDollarPerDsc,transactionHash,paidBy,currency}   = tx;

            const userDoc = await RegistrationModel.findOne({ userAddress: userAddress});


                    const rateDollarPerDscInNum = Number(new BigNumber(rateDollarPerDsc).dividedBy(1e18).toFixed(2));

                    const userPrevNode = await UpgradedNodes.findOne({
                        userAddress: userAddress,
                        nodeNum: { $lt: Number(nodeNum) }}).sort({ nodeNum: -1 });
                    let rankDuringStaking = userDoc.currentRank || "Beginner";
                    const netAmountPaidInUsd = new BigNumber(totalAmountInUsd).minus(userPrevNode?.totalAmountInUsd || 0).toFixed(0);

                    let dscInUsdPaid = new BigNumber(0);
                    if(currency === "DSC"){
                         dscInUsdPaid = new BigNumber(amountUsdPaid);
                    }

                    ct({count,userAddress, netAmountPaidInUsd, rankDuringStaking,amountUsdtPaid: "0",dscInUsdPaid: dscInUsdPaid.toFixed(0),type: "node", rateDollarPerDscInNum,nodeNum: Number(nodeNum)})
                    if(count === 1){
                        // await giveGapIncome(userAddress, netAmountPaidInUsd, rankDuringStaking, "0", dscInUsdPaid.toFixed(0), "node", rateDollarPerDscInNum, Number(nodeNum));
                    }else{
                       continue;
                    }
        }


    }catch(error){
        console.log(error);
    }
}

module.exports = {
    giveUserTeam,
    updateLastRoiDistributedToPaidAssuranceFees,
    distributeGapIncome
}