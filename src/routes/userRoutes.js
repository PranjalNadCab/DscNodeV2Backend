const express = require("express");
const { stakeVrs, getLiveDscPrice, getUserInfo, getUserStakings, withdrawIncomeUsdt, withdrawIncomeDsc, convertToNode, getGapIncomeHistory, getWithdrawIncomeHistory, nodeRegistration, purchaseNode, getRoiHistory } = require("../controllers/userController");


const router = express.Router();

router.post("/stake-vrs", stakeVrs);
router.get("/get-dsc-price",getLiveDscPrice);
router.post("/get-user-info",getUserInfo);
router.post("/get-user-stakings",getUserStakings);
router.post("/withdraw-usdt",withdrawIncomeUsdt);
router.post("/withdraw-dsc",withdrawIncomeDsc);
router.post("/convert-to-node",convertToNode);
router.post("/get-gap-income-history",getGapIncomeHistory);
router.post("/withdraw-income-history",getWithdrawIncomeHistory);
router.post("/node-registration",nodeRegistration);
router.post("/upgrade-node",purchaseNode);
router.get("/roi-history",getRoiHistory)






module.exports = router