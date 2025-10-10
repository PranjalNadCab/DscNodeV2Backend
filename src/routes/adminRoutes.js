const express = require("express");
const { getAllUsers, getUpgradedNodesHistory } = require("../controllers/adminController");


const router = express.Router();

router.get("/all-users", getAllUsers);
router.get("/get-upgraded-nodes-history", getUpgradedNodesHistory);


module.exports = router