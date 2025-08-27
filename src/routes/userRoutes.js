const express = require("express");
const { stakeVrs, getLiveDscPrice, getUserInfo, getUserStakings, withdrawIncomeUsdt, withdrawIncomeDsc } = require("../controllers/userController");


const router = express.Router();

router.post("/stake-vrs", stakeVrs);
router.get("/get-dsc-price",getLiveDscPrice);
router.post("/get-user-info",getUserInfo);
router.post("/get-user-stakings",getUserStakings);
router.post("/withdraw-usdt",withdrawIncomeUsdt);
router.post("/withdraw-dsc",withdrawIncomeDsc);





module.exports = router