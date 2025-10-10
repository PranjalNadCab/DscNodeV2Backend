const express = require("express");
const { getAllUsers, getUpgradedNodesHistory, manageNodeStakings } = require("../controllers/adminController");


const router = express.Router();

router.get("/all-users", getAllUsers);
router.get("/get-upgraded-nodes-history", getUpgradedNodesHistory);
router.post("/manage-node-stakings", manageNodeStakings);



module.exports = router