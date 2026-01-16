const { ct } = require("./helpers/helper");
const ManageAssuranceWithdrawalModel = require("./models/ManageAssuranceWithdrawalModel");
const RoiModel = require("./models/RoiModel");

const giveOverWithdrawalAssuranceUsers = async () => {
    try {

        const usersWithdrawn = await ManageAssuranceWithdrawalModel.aggregate([
            {
                $group: {
                    _id: "$userAddress",
                    totalWithdrawnDsc: {
                        $sum: {
                            $divide: [{ $toDouble: "$amountDsc" }, 1e18]
                        }
                    },
                    totalWithdrawnUsdt: {
                        $sum: {
                            $divide: [{ $toDouble: "$amountUsdt" }, 1e18]
                        }
                    }
                }
            }
        ]);

        for (const user of usersWithdrawn) {

            const earningForThisUser = await RoiModel.aggregate([
                {
                    $match: {
                        userAddress: user._id
                    }
                },
                {
                    $group: {
                        _id: "$userAddress",
                        totalEarningsDscWei: {
                            $sum: { $toDouble: "$dscAllocation" }
                        },
                        totalEarningsSwapWei: {
                            $sum: { $toDouble: "$swapAllocation" }
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        totalEarningsDsc: {
                            $divide: ["$totalEarningsDscWei", 1e18]
                        },
                        totalEarningsSwap: {
                            $divide: ["$totalEarningsSwapWei", 1e18]
                        }
                    }
                }
            ]);

            const totalRoiEarnings = (earningForThisUser.length > 0 ? (earningForThisUser[0].totalEarningsDsc + earningForThisUser[0].totalEarningsSwap) : 0)
            const totalWithdrwanDsc = user.totalWithdrawnDsc;
            // ct({ user: user._id, totalWithdrawnDsc: user.totalWithdrawnDsc, totalWithdrawnUsdt: user.totalWithdrawnUsdt, totalEarningsDsc: earningForThisUser.length > 0 ? earningForThisUser[0].totalEarningsDsc : 0, totalEarningsSwap: earningForThisUser.length > 0 ? earningForThisUser[0].totalEarningsSwap : 0,totalRoiEarnings:(earningForThisUser.length > 0 ? (earningForThisUser[0].totalEarningsDsc + earningForThisUser[0].totalEarningsSwap) : 0) });

            if (totalWithdrwanDsc > totalRoiEarnings) {
                if (user._id === "0x480Ef3Bd9f3BD33830BF50c2766Bff81fbBA2372") continue;
                ct({ user: user._id, totalRoiEarnings: totalRoiEarnings, totalWithdrawnDsc: totalWithdrwanDsc, loss: totalRoiEarnings - totalWithdrwanDsc, totalEarningsDsc: earningForThisUser.length > 0 ? earningForThisUser[0].totalEarningsDsc : 0, totalEarningsSwap: earningForThisUser.length > 0 ? earningForThisUser[0].totalEarningsSwap : 0, });

            }


        }


    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    giveOverWithdrawalAssuranceUsers
}