const express = require("express");
const { getAllUsers, getUpgradedNodesHistory, manageNodeStakings, changeRanks, getDisabledStakings, login, getAdminInfo, getDaoDelegators, getDashboardInfo, getDashboardInfo2, getDashboardInfo3, getNodeDeployers, getNodePricesAndRatios, fsrRechargeHistory, rechargeFsr, withdrawalHistory, getDashboardInfo4, adminFsrActivationHistory, adminRoiIncomeHistory, adminGapIncomeHistory, adminLevelIncomeHistory, adminNbdHistory } = require("../controllers/adminController");
const { adminAuthentication } = require("../middlewares/adminAuth");


const router = express.Router();

router.post("/login", login);
router.post("/get-admin-info",adminAuthentication, getAdminInfo);

router.get("/all-users",adminAuthentication, getAllUsers);
router.get("/get-upgraded-nodes-history", adminAuthentication,getUpgradedNodesHistory);
router.post("/manage-node-stakings",adminAuthentication, manageNodeStakings);
router.post("/change-ranks",adminAuthentication, changeRanks);
router.get("/get-disabled-stakings",adminAuthentication,getDisabledStakings);
router.get("/get-dao-delegators",adminAuthentication,getDaoDelegators);
router.get("/get-dashboard-info",getDashboardInfo);
router.get("/get-dashboard-info2",getDashboardInfo2);
router.get("/get-dashboard-info3",getDashboardInfo3);
router.get("/get-dashboard-info4",getDashboardInfo4);

router.get("/node-deployers",adminAuthentication,getNodeDeployers);
router.get("/node-prices-ratios",adminAuthentication,getNodePricesAndRatios);
router.post("/fsr-recharge-history",adminAuthentication,fsrRechargeHistory);
router.post("/recharge-fsr",adminAuthentication,rechargeFsr);
router.post("/withdrawal-history",withdrawalHistory);
router.post("/fsr-activation-history",adminFsrActivationHistory);
router.post("/roi-income-history",adminRoiIncomeHistory);
router.post("/gap-income-history",adminGapIncomeHistory);
router.post("/level-income-history",adminLevelIncomeHistory);
router.post("/nbd-history",adminNbdHistory);

















module.exports = router