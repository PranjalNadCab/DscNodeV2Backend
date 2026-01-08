const express = require("express");
const { stakeVrs, getLiveDscPrice, getUserInfo, getUserStakings, withdrawIncomeUsdt, withdrawIncomeDsc, getGapIncomeHistory, getWithdrawIncomeHistory, upgradeNode, getRoiHistory, stakeMix, deployNode, getUserPendingStake, getUsdDscRatio, getUserPendingNodeUpgrades, getNodeUpgradeHistory, getIdToAddress, getLevelIncome, nbdPaidHistory, activateFsr, pendingTxsToSponsor, completeSponsoredTx, fsrActivationHistory, userDeployedNode, assuranceFeeHistory, getUserAssuranceFeeInfo, assuranceRoiHistory, useAssuranceIncome, assuranceIncomeOutHistory, sponsoredTxHistory, getUserNodeLists, userAlldirects, userTeamList, userTeamBusiness, getValidatorsGroupData, getValidatorsList, loginNodeManager, getNodeOverview } = require("../controllers/userController");


const router = express.Router();

router.post("/stake-vrs", stakeVrs);
router.post("/get-id-to-address",getIdToAddress);
// router.post("/stake-mix",stakeMix);
router.get("/get-usd-dsc-ratio",getUsdDscRatio);
router.get("/get-dsc-price",getLiveDscPrice);
router.post("/get-user-info",getUserInfo);
router.post("/get-user-stakings",getUserStakings);
router.post("/withdraw-usdt",withdrawIncomeUsdt);
router.post("/withdraw-dsc",withdrawIncomeDsc);
router.post("/get-gap-income-history",getGapIncomeHistory);
router.post("/withdraw-income-history",getWithdrawIncomeHistory);
router.post("/upgrade-node",upgradeNode);
router.post("/deploy-node",deployNode);
router.post("/node-upgrade-history",getNodeUpgradeHistory)
router.post("/user-pending-stake",getUserPendingStake);
router.post("/user-pending-node-upgrades",getUserPendingNodeUpgrades);
router.post("/get-level-income",getLevelIncome);
// router.post("/convert-to-node",convertToNode);
router.post("/roi-history",getRoiHistory);
router.post("/get-nbd-history",nbdPaidHistory);
router.post("/activate-fsr",activateFsr);
router.post("/fsr-activation-history",fsrActivationHistory);
router.post("/pending-tx-sponsor",pendingTxsToSponsor);
router.post("/complete-sponsored-tx",completeSponsoredTx);
router.post("/user-deployed-node",userDeployedNode);
router.post("/assurance-fee-history",assuranceFeeHistory);
router.post("/assurance-roi-history",assuranceRoiHistory);
router.post("/get-assurance-fee-info",getUserAssuranceFeeInfo)
router.post("/use-assurance-income",useAssuranceIncome);
router.post("/assurance-withdrawal-history",assuranceIncomeOutHistory);
router.post("/sponsored-tx-history",sponsoredTxHistory);
router.post("/get-user-node-lists",getUserNodeLists);
router.post("/user-directs-list",userAlldirects);
router.post("/user-team-list",userTeamList);
router.post("get-user-team-business",userTeamBusiness);
router.get("/get-validators-group-data",getValidatorsGroupData);
router.post("/get-validators-list",getValidatorsList);


//Below apis are for node manager panel
router.post("/login-node-manager",loginNodeManager);
router.post("/get-node-overview",getNodeOverview);














module.exports = router