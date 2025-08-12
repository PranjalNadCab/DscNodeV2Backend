const express = require("express");
const { stakeVrs } = require("../controllers/userController");


const router = express.Router();

router.post("/stake-vrs", stakeVrs);



module.exports = router