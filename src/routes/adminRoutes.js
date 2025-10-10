const express = require("express");
const { getAllUsers, getUpgradedNodesHistory, manageNodeStakings, changeRanks } = require("../controllers/adminController");


const router = express.Router();

router.get("/all-users", getAllUsers);
router.get("/get-upgraded-nodes-history", getUpgradedNodesHistory);
router.post("/manage-node-stakings", manageNodeStakings);
router.post("/change-ranks", changeRanks);




module.exports = router