const express = require("express");
const { stakeVrs, getLiveDscPrice, getUserInfo, getUserStakings, withdrawIncomeUsdt, withdrawIncomeDsc, convertToNode, getGapIncomeHistory, getWithdrawIncomeHistory, upgradeNode, getRoiHistory, stakeMix, deployNode, getUserPendingStake } = require("../controllers/userController");


const router = express.Router();

router.post("/stake-vrs", stakeVrs);
router.post("/stake-mix",stakeMix);
router.get("/get-dsc-price",getLiveDscPrice);
router.post("/get-user-info",getUserInfo);
router.post("/get-user-stakings",getUserStakings);
router.post("/withdraw-usdt",withdrawIncomeUsdt);
router.post("/withdraw-dsc",withdrawIncomeDsc);
router.post("/get-gap-income-history",getGapIncomeHistory);
router.post("/withdraw-income-history",getWithdrawIncomeHistory);
router.post("/upgrade-node",upgradeNode);
router.post("/deploy-node",deployNode);
router.post("/user-pending-stake",getUserPendingStake);
router.post("/convert-to-node",convertToNode);
router.post("/roi-history",getRoiHistory);






module.exports = router