const { BigNumber } = require("bignumber.js");
const AssuranceFeeModel = require("./src/models/AssuranceFeeModel");
const RegistrationModel = require("./src/models/RegistrationModel");
const ManageAssuranceWithdrawalModel = require("./src/models/ManageAssuranceWithdrawalModel");
const ActivateFsrModel = require("./src/models/ActivateFsrModel");
const UpgradedNodes = require("./src/models/UpgradeNodeModel");
const WithdrawIncomeModel = require("./src/models/WithdrawIncomeModel");
const { web3, dscNodeContract } = require("./src/web3/web3");
const { ct } = require("./src/helpers/helper");
const NbdFundModel = require("./src/models/NbdFundsModel");


const migrateDscNodeContract = async () => {
    try {
        const users = await RegistrationModel.find();
        const BATCH_SIZE = 20;

        let batch = [];

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const userAddress = user.userAddress;

            // if(userAddress !== "0x8b8a9C1E01a44e1e5c7E7771F61812b3Dea06f94")continue;

            // ---- NBD PAID ----
            const paidAgg = await NbdFundModel.aggregate([
                { $match: { userAddress } },
                { $group: { _id: null, totalAmount: { $sum: {$toDouble:"$amountNbdPaid"} } } },
            ]);

            const nbdPaid = paidAgg.length
                ? new BigNumber(paidAgg[0].totalAmount).toFixed(0)
                : "0";

            // ---- NONCES (increment by +1) ----
            const withdrawNonce =
                (await WithdrawIncomeModel.findOne({ userAddress }).sort({ lastUsedNonce: -1 }))?.lastUsedNonce ?? -1;

            const upgradeNonce =
                (await UpgradedNodes.findOne({ userAddress }).sort({ lastUsedNonce: -1 }))?.lastUsedNonce ?? -1;

            const stakingNonce =
                (await ActivateFsrModel.findOne({ userAddress }).sort({ lastUsedNonce: -1 }))?.lastUsedNonce ?? -1;

            const assuranceNonce =
                (await ManageAssuranceWithdrawalModel.findOne({ userAddress }).sort({ lastUsedNonce: -1 }))?.lastUsedNonce ?? -1;

            // ---- STRUCT MAPPING (MATCH CONTRACT EXACTLY) ----
            ct({
                user: userAddress,
                registered: true,
                nodeDeployed: Boolean(user.myNode),
                nbdPaid: nbdPaid,
                withdrawNonce: withdrawNonce + 1,
                upgradeNonce: upgradeNonce + 1,
                stakingNonce: stakingNonce + 1,
                assuranceNonce: assuranceNonce + 1,
            })
            batch.push({
                user: userAddress,
                registered: true,
                nodeDeployed: Boolean(user.myNode),
                nbdPaid: nbdPaid,
                withdrawNonce: withdrawNonce + 1,
                upgradeNonce: upgradeNonce + 1,
                stakingNonce: stakingNonce + 1,
                assuranceNonce: assuranceNonce + 1,
            });

            // ---- FLUSH BATCH ----
            if (batch.length === BATCH_SIZE || i === users.length - 1) {
                console.log(`⏳ Migrating batch of ${batch.length} users`);

                const data = dscNodeContract.methods
                    .storeUsersBatch(batch)
                    .encodeABI();

                const gas = await web3.eth.estimateGas({
                    from: process.env.PRICE_OPERATOR_ADDRESS,
                    to: process.env.DSCNODE_CONTRACT_ADDRESS,
                    data,
                });

                const gasPrice = await web3.eth.getGasPrice();

                const tx = {
                    from: process.env.PRICE_OPERATOR_ADDRESS,
                    to: process.env.DSCNODE_CONTRACT_ADDRESS,
                    gas,
                    gasPrice,
                    data,
                };

                const signedTx = await web3.eth.accounts.signTransaction(
                    tx,
                    process.env.PRICE_OPERATOR_ADDRESS_PRIVATE_KEY
                );

                const receipt = await web3.eth.sendSignedTransaction(
                    signedTx.rawTransaction
                );

                console.log("✅ Batch migrated:", receipt.transactionHash);

                batch = []; // RESET
            }
        }

        console.log("🎉 Migration completed successfully");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    }
};

module.exports = {
    migrateDscNodeContract
}