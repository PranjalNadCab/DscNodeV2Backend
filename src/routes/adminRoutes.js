const express = require("express");
const { getAllUsers, getUpgradedNodesHistory, manageNodeStakings, changeRanks, getDisabledStakings, login, getAdminInfo, getDaoDelegators, getDashboardInfo, getDashboardInfo2 } = require("../controllers/adminController");
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






module.exports = router