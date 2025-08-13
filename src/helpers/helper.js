const RegistrationModel = require("../models/RegistrationModel");
const { web3 } = require("../web3/web3")


const ct = (payload) => {
    console.table(payload);
};

const giveCheckSummedAddress = (address)=>{
  
    return web3.utils.toChecksumAddress(address);
}

function giveVrsForStaking(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, nonce) {
    return new Promise(async (resolve, reject) => {
        try {

            //call contract to match nonce
            ct({ amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, nonce })

            const data = {
                hash: hash,
                nonce: nonce,
                user: user,
                amountDscInUsdIn1e18,
                amountDscIn1e18,
                amountUsdtIn1e18,
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

const updateTeamCount = async (userAddress) => {
    try {


        const pipeline = [
            {
                $match: { userAddress },
            },
            {
                $graphLookup: {
                    from: "registration",
                    startWith: "$userAddress",
                    connectFromField: "sponsorAddress",
                    connectToField: "userAddress",
                    as: "upline",
                    maxDepth: 100000000,
                    depthField: "level",
                },
            },
            {
                $unwind: "$upline",
            },
            {
                $match: { "upline.level": { $gt: 0 } }, // Exclude the root user (level 0)
            },
            {
                $project: {
                    _id: 0,
                    userAddress: "$upline.userAddress",
                    level: "$upline.level",
                },
            },
        ];
        const uplineData = await RegistrationModel.aggregate(pipeline);
        if (uplineData.length > 0) {
            const uplineUsers = uplineData.map((upline) => upline.userAddress);
            await RegistrationModel.updateMany(
                { userAddress: { $in: uplineUsers } },
                { $inc: { teamCount: 1 } }
            );
            console.log("team count updated in register event");
        }
    } catch (error) {
        console.log(error, "in updateTeamCount");
    }
};

const updateDirectCount = async (sponsorAddress) => {
    try {

        const sponsorUpdate = await RegistrationModel.findOneAndUpdate(
            { user: sponsorAddress },
            { $inc: { directCount: 1 } },
            { upsert: true, new: true }
        );

        console.log("sponsorUpdate", sponsorUpdate);
    } catch (error) {
        console.log(error, "in updateDirectCount");
    }
};

const updateDirectBusiness = async (totalStakeAmountInUsd, userAddress) => {
    try {
        const originalUser = await RegistrationModel.findOne({
            userAddress: userAddress,
        });
        if (!originalUser) {
            console.log(error);
            return;
        }

        const sponsorDoc = await RegistrationModel.findOne({
            userAddress: originalUser.sponsorAddress,
        });
        console.log("---------------", sponsorDoc);
        if (!sponsorDoc) {
            return;
        }
        let sponsorDirectBusiness = new BigNumber(sponsorDoc.directStaking);
        sponsorDirectBusiness = sponsorDirectBusiness.plus(totalStakeAmountInUsd);
        const sponsorUpdate = await RegistrationModel.findOneAndUpdate(
            { user: originalUser.sponsorAddress },
            { $set: { directStaking: sponsorDirectBusiness.toFixed() } },
            { upsert: true, new: true }
        );

        console.log("sponsorUpdate", sponsorUpdate);
    } catch (error) {
        console.log(error, "in updateDirectBusiness");
    }
};

const registerUser = async (userAddress, time,sponsorAddress) => {
    try {
        const user = await RegistrationModel.findOne({ userAddress });
        if (!user) {
            const newUser = await RegistrationModel.create({
                userAddress,
                sponsorAddress,
                time: time || Math.floor(Date.now() / 1000)
            });
        }
    } catch (error) {
        console.error("Error registering user:", error);
        throw error;
    }
}

const createDefaultOwnerDoc = async () => {
    try {
        const defaultOwnerAddress = process.env.DEFAULT_OWNER_ADDRESS;
        if (!defaultOwnerAddress) {
            throw new Error("Default owner address is not set in environment variables.");
        }

        const existingOwner = await RegistrationModel.findOne({ userAddress: defaultOwnerAddress });
        if (!existingOwner) {
            await RegistrationModel.create({
                userAddress: defaultOwnerAddress,
                sponsorAddress: "0x0000000000000000000000000000000000000000",
                teamCount: 0,
                directCount: 0,
                time: Math.floor(Date.now() / 1000)
            });
            console.log("Default owner document created successfully.");
        } else {
            console.log("Default owner document already exists.");
        }
    } catch (error) {
        console.log(error, "Error creating default owner document");
    }
}

module.exports = { ct, giveVrsForStaking, registerUser, createDefaultOwnerDoc,giveCheckSummedAddress }