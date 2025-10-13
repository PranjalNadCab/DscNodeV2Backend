const express = require("express");
const { getAllUsers, getUpgradedNodesHistory, manageNodeStakings, changeRanks, getDisabledStakings, login, getAdminInfo } = require("../controllers/adminController");
const { adminAuthentication } = require("../middlewares/adminAuth");


const router = express.Router();

router.post("/login", login);
router.post("/get-admin-info",adminAuthentication, getAdminInfo);

router.get("/all-users", getAllUsers);
router.get("/get-upgraded-nodes-history", getUpgradedNodesHistory);
router.post("/manage-node-stakings", manageNodeStakings);
router.post("/change-ranks", changeRanks);
router.get("/get-disabled-stakings",getDisabledStakings);




module.exports = router