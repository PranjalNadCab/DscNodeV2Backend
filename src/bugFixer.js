const { ct } = require("./helpers/helper");
const AssuranceFeeModel = require("./models/AssuranceFeeModel");
const NodeDeployedModel = require("./models/NodeDeployedModel");
const RegistrationModel = require("./models/RegistrationModel");
const moment = require("moment");


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

module.exports = {
    giveUserTeam,
    updateLastRoiDistributedToPaidAssuranceFees
}