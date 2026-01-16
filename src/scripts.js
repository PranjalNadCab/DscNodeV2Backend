const { ct } = require("./helpers/helper");
const ManageAssuranceWithdrawalModel = require("./models/ManageAssuranceWithdrawalModel");
const RoiModel = require("./models/RoiModel");

const giveOverWithdrawalAssuranceUsers = async () => {
    try {

        const usersWithdrawn = await ManageAssuranceWithdrawalModel.aggregate([
            {
                $group: {
                    _id: "$userAddress",

                    totalWithdrawDsc: {
                        $sum: {
                            $cond: [
                                { $eq: ["$actionType", "WITHDRAW"] },
                                { $divide: [{ $toDouble: "$amountDsc" }, 1e18] },
                                0
                            ]
                        }
                    },

                    totalTransferDsc: {
                        $sum: {
                            $cond: [
                                { $eq: ["$actionType", "TRANSFER"] },
                                { $divide: [{ $toDouble: "$amountDsc" }, 1e18] },
                                0
                            ]
                        }
                    },

                    totalSwappedDsc: {
                        $sum: {
                            $cond: [
                                { $eq: ["$actionType", "SWAPPED"] },
                                { $divide: [{ $toDouble: "$amountDsc" }, 1e18] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        for (const user of usersWithdrawn) {

            // console.log(`User: ${user._id}, Total Withdrawn DSC: ${user.totalWithdrawDsc}, Total Transferred DSC: ${user.totalTransferDsc}, Total Swapped DSC: ${user.totalSwappedDsc}, Overall Total DSC: ${user.totalWithdrawDsc + user.totalTransferDsc + user.totalSwappedDsc}`);
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
            // const totalWithdrwanDsc = user.totalWithdrawnDsc;
            // ct({ user: user._id, totalRoiEarnings: totalRoiEarnings, totalWithdrawnDsc: totalWithdrwanDsc, loss: totalRoiEarnings - totalWithdrwanDsc, totalEarningsDsc: earningForThisUser.length > 0 ? earningForThisUser[0].totalEarningsDsc : 0, totalEarningsSwap: earningForThisUser.length > 0 ? earningForThisUser[0].totalEarningsSwap : 0, });
            const totalWithdrawnDsc = user.totalWithdrawDsc;
            const totalTransferredDsc = user.totalTransferDsc;
            const totalSwappedDsc = user.totalSwappedDsc;
            const swapEarnings = earningForThisUser.length > 0 ? earningForThisUser[0].totalEarningsSwap : 0;
            const dscEarnings = earningForThisUser.length > 0 ? earningForThisUser[0].totalEarningsDsc : 0;
            // ct({ user: user._id, dscEarnings,totalWithdrawnDsc, totalTransferredDsc,swapEarnings, totalSwappedDsc: totalSwappedDsc, overallTotalDsc:( totalWithdrawnDsc +totalTransferredDsc + totalSwappedDsc),totalRoiEarnings });

            // if(totalTransferredDsc > 0){
            //     console.log(`User ${user._id} has transferred ${totalTransferredDsc} DSC from assurance fund.`);
            // }

            if(user._id === "0x8ea8d183930691a1ba8652a605179dc45a20098b"){
                ct({ user: user._id, dscEarnings,totalWithdrawnDsc, swapEarnings,totalTransferredDsc, totalSwappedDsc, overallUtilisedDsc:( totalWithdrawnDsc +totalTransferredDsc + totalSwappedDsc),totalRoiEarnings });
            }

            // if (dscEarnings < totalWithdrawnDsc || swapEarnings < ( totalSwappedDsc)) {
            //     if (user._id === "0x480Ef3Bd9f3BD33830BF50c2766Bff81fbBA2372") continue;
                // ct({ user: user._id, dscEarnings,totalWithdrawnDsc, swapEarnings,totalTransferredDsc, totalSwappedDsc, overallUtilisedDsc:( totalWithdrawnDsc +totalTransferredDsc + totalSwappedDsc),totalRoiEarnings });

            // }


        }

        console.log("Script execution completed.");

    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    giveOverWithdrawalAssuranceUsers
}