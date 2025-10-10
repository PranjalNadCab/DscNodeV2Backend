const express = require("express");
const { getAllUsers, getUpgradedNodesHistory, manageNodeStakings, changeRanks, getDisabledStakings } = require("../controllers/adminController");


const router = express.Router();

router.get("/all-users", getAllUsers);
router.get("/get-upgraded-nodes-history", getUpgradedNodesHistory);
router.post("/manage-node-stakings", manageNodeStakings);
router.post("/change-ranks", changeRanks);
router.get("/get-disabled-stakings",getDisabledStakings)




module.exports = router