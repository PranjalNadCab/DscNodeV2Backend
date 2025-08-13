const express = require("express");
const { stakeVrs, getLiveDscPrice } = require("../controllers/userController");


const router = express.Router();

router.post("/stake-vrs", stakeVrs);
router.get("/get-dsc-price",getLiveDscPrice)



module.exports = router