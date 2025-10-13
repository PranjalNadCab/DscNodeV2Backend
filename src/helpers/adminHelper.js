const { default: axios } = require("axios");

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
        throw error;
    }
}

module.exports = {
    getDaoAndDelegator
}

