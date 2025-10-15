const { default: axios } = require("axios");
const AdminModel = require("../models/AdminModel");
const { ct } = require("./helper");
const BigNumber = require("bignumber.js")

const daoUrl = "https://dao.dsclab.ai/api/getdaoList";
const delegatorsUrl = "https://dao.dsclab.ai/api/delegatorsList";

const getDaoAndDelegator = async()=>{
    try{

        const [daoList,delegatorLilst] = await Promise.all([
            axios.get(daoUrl),
            axios.get(delegatorsUrl)
        ]);

        // console.log("DAO List:", daoList.data.data);
        // console.log("Delegator List:", delegatorLilst.data.data);
        const daos  = daoList.data.data.filter((item,index)=>item.Add);
        const delegators = delegatorLilst.data.data.filter((item,index)=>item.Add);
        return {daos,delegators};
    }catch(error){
        console.error("Error in getDaoAndDelegator:", error);
        throw {daos:[],delegators:[]};
    }
}

const generateDefaultDaoDelegatorDoc = async (role,walletAddress,password) => {
    try {
        const existingAdmin = await AdminModel.findOne({role,walletAddress});
        if (!existingAdmin) {
            // ct({role,walletAddress,password,existingAdmin,message:"Default admin document creation skipped (already exists)."});
            const defaultDoc = new AdminModel({
                withdrawDeductionPercent: 5, // Default deduction percent
                nodeValidators: [
                    { name: "Pioneers", reward: 100, selfStaking: new BigNumber(3000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(90 * 1e18).toFixed(), nodeNum: 1 },
                    { name: "Guardians", reward: 200, selfStaking: new BigNumber(6000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(180 * 1e18).toFixed(), nodeNum: 2 },
                    { name: "Visionaries", reward: 300, selfStaking: new BigNumber(9000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(270 * 1e18).toFixed(), nodeNum: 3 },
                    { name: "Node Omega", reward: 400, selfStaking: new BigNumber(12000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(360 * 1e18).toFixed(), nodeNum: 4 },
                    { name: "Node Core", reward: 600, selfStaking: new BigNumber(18000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(540 * 1e18).toFixed(), nodeNum: 5 },
                    { name: "Node Apex", reward: 800, selfStaking: new BigNumber(24000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(720 * 1e18).toFixed(), nodeNum: 6 },
                    { name: "Node Nexus", reward: 1200, selfStaking: new BigNumber(36000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(1080 * 1e18).toFixed(), nodeNum: 7 },
                    { name: "Node Fusion", reward: 1600, selfStaking: new BigNumber(48000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(1440 * 1e18).toFixed(), nodeNum: 8 },
                    { name: "Node Dominion", reward: 2000, selfStaking: new BigNumber(60000).multipliedBy(1e18).toFixed(0), baseMinAss: new BigNumber(1800 * 1e18).toFixed(), nodeNum: 9 },
                ],
                stakeRatio: {
                    part1: 7,
                    part2: 3
                },
                lastUpdatedMonthForNodeValidators: process.env.START_MONTH || "October",
                role:role,
                walletAddress,
                password
            });
            await defaultDoc.save();
            ct({role,walletAddress,password,message:"Default admin document created successfully."});
        }
         else {
            console.log("Admin document of dao and delegator already exists.");
        }
    } catch (error) {
        console.log("Error creating default admin document:", error);
    }
}

const createDaoAndDelegatorsAdminInBulk=async()=>{
    try{
        const {daos,delegators} = await getDaoAndDelegator();
        for  (const dao of daos){
            let {target_address} = dao;
            if(process.env.NODE_ENV === "development"){
                target_address = "0x2abae3a15E764AFa3948b2Cb04E81f0718d8f846";
            }
            await generateDefaultDaoDelegatorDoc("dao",target_address,process.env.DAO_PASSWORD);
        }

        for  (const delegator of delegators){
            let {target_address} = delegator;
            if(process.env.NODE_ENV === "development"){
                target_address = "0x2abae3a15E764AFa3948b2Cb04E81f0718d8f846";
            }
            
            await generateDefaultDaoDelegatorDoc("delegator",target_address,process.env.DELEGATOR_PASSWORD);
        }

    }catch(error){
        console.log(error);
    }
}


module.exports = {
    createDaoAndDelegatorsAdminInBulk
}

