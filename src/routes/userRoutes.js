const express = require("express");
const { stakeVrs, getLiveDscPrice, getUserInfo } = require("../controllers/userController");


const router = express.Router();

router.post("/stake-vrs", stakeVrs);
router.get("/get-dsc-price",getLiveDscPrice);
router.post("/get-user-info",getUserInfo);




module.exports = router