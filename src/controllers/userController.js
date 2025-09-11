const { hash } = require("crypto");
const LivePriceDsc = require("../models/LiveDscPriceModel");
const { giveVrsForStaking, ct, giveCheckSummedAddress, giveVrsForWithdrawIncomeUsdt, giveVrsForWithdrawIncomeDsc, giveVrsForNodeConversionAndRegistration, giveAdminSettings } = require("../helpers/helper");
const StakingModel = require("../models/StakingModel");
const BigNumber = require("bignumber.js");
const { dscNodeContract } = require("../web3/web3");
const RegistrationModel = require("../models/RegistrationModel");
const WithdrawIncomeModel = require("../models/WithdrawIncomeModel");
const { isAddress } = require("web3-validator");
const Admin = require("../models/AdminModel");
const NodeConverted = require("../models/NodeConvertedModel");
const GapIncomeModel = require("../models/GapIncomeModel");


const stakeVrs = async (req, res, next) => {
    try {
        // Extract user data from request body

        const { user, amountDsc, amountDscInUsd, amountUsdt, priceDscInUsd, sponsorAddress } = req.body; //amounts will be in number

        const missingFields = Object.keys(req.body).filter(key => (key === undefined || key === null || key === "" || (typeof req.body[key] === "string" && req.body[key].trim() === "")));
        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        // if (!user || !amountDsc || !amountDscInUsd || !amountUsdt || !priceDscInUsd || !sponsorAddress) throw new Error("Please send all the required fields.");

        let formattedSponsor = giveCheckSummedAddress(sponsorAddress);
        let formattedUser = giveCheckSummedAddress(user);
        const sponsorDoc = await RegistrationModel.findOne({ userAddress: formattedSponsor });
        if (!sponsorDoc) throw new Error("Sponsor not found. Please register your sponsor first.");

        const totalUsd = Number(amountDscInUsd) + Number(amountUsdt);
        if (totalUsd < 100) throw new Error("Total amount must be at least $100.");
        if (totalUsd % 100 !== 0) throw new Error("You can only stake multiples of $100.");


        // ✅ Ratio validation
        const ratioUsdt = (Number(amountUsdt) * 100) / totalUsd;
        const ratioDsc = (Number(amountDscInUsd) * 100) / totalUsd;

        const adminDoc = await Admin.findOne({});

        if (!adminDoc) throw new Error("Admin not found.");
        const { stakeRatio } = adminDoc;

        const totalParts = stakeRatio.part1 + stakeRatio.part2;

        // calculate expected ratios
        const expectedUsdt = (stakeRatio.part1 / totalParts) * 100;
        const expectedDsc = (stakeRatio.part2 / totalParts) * 100;

        ct({ ratioUsdt, ratioDsc, expectedUsdt, expectedDsc });
        // tolerance margin for floating point errors
        const tolerance = 0.01;

        const validUsdtOnly = ratioUsdt === 100 && ratioDsc === 0;
        const validDscOnly = ratioDsc === 100 && ratioUsdt === 0;
        const validMix =
            Math.abs(ratioUsdt - expectedUsdt) < tolerance &&
            Math.abs(ratioDsc - expectedDsc) < tolerance;

        if (!(validUsdtOnly || validDscOnly || validMix)) {
            throw new Error(
                `You can only stake 100% USDT, 100% DSC, or ${expectedUsdt}% USDT + ${expectedDsc}% DSC.`
            );
        }

        const { price } = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");

        const generatedAmountDsc = amountDscInUsd / price;
        const generatedAmountDscInUsd = price * amountDsc;

        ct({ generatedAmountDsc, amountDsc, generatedAmountDscInUsd, amountDscInUsd });
        if (Math.abs(generatedAmountDscInUsd - amountDscInUsd) > 0.02) {
            throw new Error("DSC amount does not match the calculated amount based on USD value.");
        }


        const amountDscInUsdIn1e18 = new BigNumber(amountDscInUsd).multipliedBy(1e18).toFixed(0);
        const amountDscIn1e18 = new BigNumber(generatedAmountDsc).multipliedBy(1e18).toFixed(0);
        const amountUsdtIn1e18 = new BigNumber(amountUsdt).multipliedBy(1e18).toFixed(0);
        const priceDscInUsdIn1e18 = new BigNumber(price).multipliedBy(1e18).toFixed(0);

        const lastStake = await StakingModel.findOne({ userAddress: user }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastStake) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastStake.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForStaking(user).call();
        if ((prevNonce + 1) !== Number(currNonce)) {
            // throw new Error("Your previous stake is not stored yet! Please try again later.");
        }

        const hash = await dscNodeContract.methods.getHashForStaking(user, amountDscIn1e18, amountDscInUsdIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18).call();

        const vrsSign = await giveVrsForStaking(amountDscInUsdIn1e18, amountDscIn1e18, amountUsdtIn1e18, priceDscInUsdIn1e18, user, hash, Number(currNonce));


        return res.status(200).json({ success: true, message: "Vrs generated successfully", price: price, generatedAmountDsc, sentAmountDsc: amountDsc, vrsSign: { ...vrsSign, sponsorAddress: sponsorDoc.userAddress } });
    } catch (error) {
        console.error("Error in stakeVrs:", error);
        next(error);
    }

}

const getLiveDscPrice = async (req, res, next) => {
    try {

        const { price } = await LivePriceDsc.findOne();

        if (!price) throw new Error("Live price not found.");



        return res.status(200).json({ success: true, message: "Live DSC Price fetched successfully", price });
    } catch (error) {
        next(error);
    }
}

const getUserInfo = async (req, res, next) => {
    try {
        let { userAddress } = req.body;
        if (!userAddress) throw new Error("Please provide user address.");

        userAddress = giveCheckSummedAddress(userAddress);

        const userDoc = await RegistrationModel.findOne({ userAddress: userAddress });

        return res.status(200).json({ success: true, message: "User info fetched successfully", userInfo: userDoc ? userDoc : null });
    } catch (error) {
        console.error("Error in getUserInfo:", error);
        next(error);
    }
}

const getUserStakings = async (req, res, next) => {
    try {
        let { userAddress, page = 1, limit = 10 } = req.body;
        // page starts from 1, limit defaults to 10

        if (!userAddress) throw new Error("Please provide user address.");

        userAddress = giveCheckSummedAddress(userAddress);

        // Ensure numbers
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await StakingModel.countDocuments({ userAddress });

        // Fetch paginated data
        const userStakings = await StakingModel.find({ userAddress })
            .sort({ lastUsedNonce: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            message: "User stakings fetched successfully",
            userStakings,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};


const withdrawIncomeUsdt = async (req, res, next) => {
    try {
        let { userAddress, amountUsdt } = req.body;

        // ✅ Validate required fields
        const missingFields = Object.entries(req.body)
            .filter(([key, val]) => val === undefined || val === null || val === "" || (typeof val === "string" && val.trim() === ""))
            .map(([key]) => key);

        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        // ✅ Checksum user address
        userAddress = giveCheckSummedAddress(userAddress);

        // ✅ Fetch user document
        const userRegDoc = await RegistrationModel.findOne({ userAddress });
        if (!userRegDoc) throw new Error("User not found. Please register first.");

        let { usdtIncomeWallet } = userRegDoc;

        // Convert stored string balances to BigNumber
        usdtIncomeWallet = new BigNumber(usdtIncomeWallet); // already in 1e18

        // Convert request amounts to 1e18
        const amountUsdtIn1e18 = new BigNumber(amountUsdt).multipliedBy(1e18);


        const amountUsdtIn1e18AfterDeduction = amountUsdtIn1e18.multipliedBy(0.95).toFixed(0);

        // ✅ Validate amounts
        if (amountUsdtIn1e18.isZero()) {
            throw new Error("Withdrawal amount must be greater than zero.");
        }

        // ✅ Case 1: Withdraw only USDT

        if (usdtIncomeWallet.lt(amountUsdtIn1e18)) {
            throw new Error("Insufficient USDT balance in wallet.");
        }



        const lastWithdraw = await WithdrawIncomeModel.findOne({ userAddress: userAddress }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastWithdraw) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastWithdraw.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForWithdrawIncome(userAddress).call();
        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous withdrawal is not stored yet! Please try again later.");
        }


        const hash = await dscNodeContract.methods.getHashForWithdrawIncomeUsdt(userAddress, amountUsdtIn1e18.toFixed(0), amountUsdtIn1e18AfterDeduction).call();
        // If validation passed, continue with withdrawal (not implemented yet)

        const vrsSign = await giveVrsForWithdrawIncomeUsdt(amountUsdtIn1e18, userAddress, hash, Number(currNonce), amountUsdtIn1e18AfterDeduction);

        return res.status(200).json({
            success: true,
            message: "Withdraw income request validated successfully. (Transfer logic not implemented yet.)",
            vrsSign
        });

    } catch (error) {
        next(error);
    }
};

const withdrawIncomeDsc = async (req, res, next) => {
    try {
        let { userAddress, amountDsc, amountDscInUsd, priceDscInUsd } = req.body;

        // ✅ Validate required fields
        const missingFields = Object.entries(req.body)
            .filter(([key, val]) => val === undefined || val === null || val === "" || (typeof val === "string" && val.trim() === ""))
            .map(([key]) => key);

        if (missingFields.length > 0) {
            throw new Error(`Please send these missing fields: ${missingFields.join(", ")}`);
        }

        // ✅ Checksum user address
        userAddress = giveCheckSummedAddress(userAddress);

        // ✅ Fetch user document
        const userRegDoc = await RegistrationModel.findOne({ userAddress });
        if (!userRegDoc) throw new Error("User not found. Please register first.");

        let { dscIncomeWallet } = userRegDoc;

        // Convert stored string balances to BigNumber
        dscIncomeWallet = new BigNumber(dscIncomeWallet);   // already in 1e18

        // Convert request amounts to 1e18
        const amountDscIn1e18 = new BigNumber(amountDsc).multipliedBy(1e18);

        const amountDscInUsdIn1e18 = new BigNumber(amountDscInUsd).multipliedBy(1e18).toFixed();
        const priceDscInUsdIn1e18 = new BigNumber(priceDscInUsd).multipliedBy(1e18).toFixed();

        const amountDscIn1e18AfterDeduction = amountDscIn1e18.multipliedBy(0.95).toFixed(0);
        const amountDscInUsdIn1e18AfterDeduction = new BigNumber(amountDscInUsdIn1e18).multipliedBy(0.95).toFixed(0);

        // ✅ Validate amounts
        if (amountDscIn1e18.isZero()) {
            throw new Error("Withdrawal amount must be greater than zero.");
        }



        // ✅ Case 2: Withdraw only DSC

        if (dscIncomeWallet.lt(amountDscIn1e18)) {
            throw new Error("Insufficient DSC balance in wallet.");
        }



        const lastWithdraw = await WithdrawIncomeModel.findOne({ userAddress: userAddress }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastWithdraw) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastWithdraw.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForWithdrawIncome(userAddress).call();
        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous withdrawal is not stored yet! Please try again later.");
        }


        const hash = await dscNodeContract.methods.getHashForWithdrawIncomeDsc(userAddress, amountDscIn1e18.toFixed(0), amountDscInUsdIn1e18, amountDscInUsdIn1e18AfterDeduction, amountDscIn1e18AfterDeduction, priceDscInUsdIn1e18).call();
        // If validation passed, continue with withdrawal (not implemented yet)

        const vrsSign = await giveVrsForWithdrawIncomeDsc(amountDscInUsdIn1e18, amountDscIn1e18, priceDscInUsdIn1e18, userAddress, hash, Number(currNonce), amountDscInUsdIn1e18AfterDeduction, amountDscIn1e18AfterDeduction);

        return res.status(200).json({
            success: true,
            message: "Withdraw income request validated successfully. (Transfer logic not implemented yet.)",
            vrsSign
        });

    } catch (error) {
        next(error);
    }
};

const convertToNode = async (req, res, next) => {
    try {

        let { userAddress, nodeName } = req.body;
        if (!userAddress || !nodeName) throw new Error("Please provide all the required fields.");
        if (typeof nodeName !== "string") throw new Error("Node name must be a string.");

        if (!isAddress(userAddress)) throw new Error("Invalid user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        const adminDoc = await Admin.findOne({});

        if (!adminDoc) throw new Error("Admin not found.");

        const { nodeValidators } = adminDoc;

        console.log("klsdrfsdgasdf", nodeValidators)
        const nodeIndexRequested = nodeValidators.findIndex(n => n.name.toLowerCase() === nodeName.toLowerCase());
        if (nodeIndexRequested === -1) throw new Error("Node not found.");

        const userDoc = await RegistrationModel.findOne({ userAddress });

        if (!userDoc) throw new Error("User not found.");

        const { userTotalStakeInUsd, currentNodeName } = userDoc;

        // console.log("ksdfsg",nodeValidators)
        const currentNodeIndex = currentNodeName ? nodeValidators.findIndex(n => n.name.toLowerCase() === currentNodeName.toLowerCase()) : -1;
        if (currentNodeIndex !== -1 && currentNodeIndex >= nodeIndexRequested) throw new Error("You have already achieved this node or a higher one.");

        const userTotalStakeInUsdBN = new BigNumber(userTotalStakeInUsd).multipliedBy(1e18);

        ct({ userTotalStakeInUsdBN: userTotalStakeInUsdBN.toFixed(), requiredStake: nodeValidators[nodeIndexRequested].selfStaking });
        if (userTotalStakeInUsdBN.isLessThan(nodeValidators[nodeIndexRequested].selfStaking)) throw new Error(`You need at least $${new BigNumber(nodeValidators[nodeIndexRequested].selfStaking).dividedBy(1e18).toFixed()} staked to convert to ${nodeName} node.`);


        //generate vrs


        const lastConversion = await NodeConverted.findOne({ userAddress: userAddress }).sort({ lastUsedNonce: -1 });
        let prevNonce = 0;
        if (!lastConversion) {
            prevNonce = -1;
        } else {
            prevNonce = Number(lastConversion.lastUsedNonce);
        }
        const currNonce = await dscNodeContract.methods.userNoncesForNodeConversion(userAddress).call();
        if ((prevNonce + 1) !== Number(currNonce)) {
            throw new Error("Your previous Node conversion not stored yet! Please try again later.");
        }


        const hash = await dscNodeContract.methods.getHashForNodeConversion(userAddress, nodeName).call();

        const vrsSign = await giveVrsForNodeConversionAndRegistration(userAddress, nodeName, Number(currNonce), hash);





        return res.status(200).json({ success: true, message: "Node conversion request fullfilled", vrsSign });
    } catch (error) {
        next(error);
    }
}

const getGapIncomeHistory = async (req, res, next) => {
    try {
        let { userAddress, page = 1, limit = 10 } = req.body;
        // page starts from 1, limit defaults to 10

        if (!userAddress) throw new Error("Please provide user address.");

        userAddress = giveCheckSummedAddress(userAddress);

        // Ensure numbers
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await GapIncomeModel.countDocuments({ receiverAddress: userAddress });

        // Fetch paginated data
        const gapIncomes = await GapIncomeModel.find({ receiverAddress: userAddress })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            message: "Gap income history fetched successfully",
            gapIncomes,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
}

const getWithdrawIncomeHistory = async (req, res, next) => {
    try {
        let { userAddress, page = 1, limit = 10 } = req.body;
        // page starts from 1, limit defaults to 10

        if (!userAddress) throw new Error("Please provide user address.");

        userAddress = giveCheckSummedAddress(userAddress);

        // Ensure numbers
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await WithdrawIncomeModel.countDocuments({ userAddress });

        // Fetch paginated data
        const withdrawIncomes = await WithdrawIncomeModel.find({ userAddress })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            message: "Withdraw income history fetched successfully",
            withdrawIncomes,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        next(error);
    }
}

const nodeRegistration = async (req,res,next)=>{
    try{
        let { userAddress } = req.body;
        const {nodeName} = req.body;
        if (!userAddress || !nodeName) throw new Error("Please provide all the required fields.");
        if (typeof nodeName !== "string") throw new Error("Node name must be a string.");

        if (!isAddress(userAddress)) throw new Error("Invalid user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        const userDoc = await RegistrationModel.findOne({ userAddress });

        if (!userDoc) throw new Error("User not found.");

        const isRegistered = await dscNodeContract.methods.isUserRegForNodeConversion(userAddress).call();

        if(isRegistered) throw new Error("You have already registered!");

        const {nodeValidators} = await giveAdminSettings();

        let amountToDeduct = new BigNumber(nodeValidators[0].selfStaking*0.1 || 300).multipliedBy(1e18).toFixed();

        const currNonce = await dscNodeContract.methods.userNoncesForNodeConversion(userAddress);

        if(Number(currNonce) !== 0)throw new Error("You have already registered!");

        const hash = await dscNodeContract.methods.getHashForNodeRegistration(userAddress, nodeName).call();


        //make VRS

        const vrs = await giveVrsForNodeConversionAndRegistration(userAddress,"Registration",amountToDeduct,Number(currNonce),hash);



        return res.status(200).json({ success: true, message: "Node registered successfully", nodeValidators,vrs });

    }catch(error){
        next(error);
    }
}

const upgradeNode = async(req,res,next)=>{
    try{

        let {userAddress,nodeName} = req.body;

        if (!userAddress || !nodeName) throw new Error("Please provide all the required fields.");
        if (typeof nodeName !== "string") throw new Error("Node name must be a string.");

        if (!isAddress(userAddress)) throw new Error("Invalid user address.");
        userAddress = giveCheckSummedAddress(userAddress);

        

    }catch(error){
        next(error);
    }
}

module.exports = {
    stakeVrs,
    upgradeNode,
    getLiveDscPrice,
    getUserInfo,
    getUserStakings,
    withdrawIncomeUsdt,
    withdrawIncomeDsc,
    convertToNode,
    getGapIncomeHistory,
    getWithdrawIncomeHistory,
    nodeRegistration
};





// SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;

// interface IERC20 {
//     event Transfer(address indexed from, address indexed to, uint256 value);
//     event Approval(
//         address indexed owner,
//         address indexed spender,
//         uint256 value
//     );

//     function totalSupply() external view returns (uint256);

//     function balanceOf(address account) external view returns (uint256);

//     function transfer(address to, uint256 amount) external returns (bool);

//     function allowance(
//         address owner,
//         address spender
//     ) external view returns (uint256);

//     function approve(address spender, uint256 amount) external returns (bool);

//     function transferFrom(
//         address from,
//         address to,
//         uint256 amount
//     ) external returns (bool);
// }

// contract Initializable {
//     bool private _initialized;

//     bool private _initializing;

//     modifier initializer() {
//         require(
//             _initializing || !_initialized,
//             "Initializable: contract is already initialized"
//         );

//         bool isTopLevelCall = !_initializing;
//         if (isTopLevelCall) {
//             _initializing = true;
//             _initialized = true;
//         }

//         _;

//         if (isTopLevelCall) {
//             _initializing = false;
//         }
//     }
// }

// interface IPancakeRouter {
//     function WETH() external pure returns (address);

//     function addLiquidityETH(
//         address token,
//         uint256 amountTokenDesired,
//         uint256 amountTokenMin,
//         uint256 amountETHMin,
//         address to,
//         uint256 deadline
//     )
//         external
//         payable
//         returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

//     function swapExactTokensForTokens(
//         uint256 amountIn,
//         uint256 amountOutMin,
//         address[] calldata path,
//         address to,
//         uint256 deadline
//     ) external returns (uint256[] memory amounts);
// }

// contract dscNodeValidator is Initializable {
//     address public owner;
//     address public operator;
//     uint256 public mixUsdtPart; // default 70% USDT
//     uint256 public mixDscPart;
//     uint256 public incomeStream1;
//     uint256 public incomeStream2;
//     uint256 public incomeStream3;
//     uint256 public incomeStream4;
//     uint256 public incomeStream5;
//     IERC20 public usdt_token;
//     IPancakeRouter public router; // ✅ router added

//     mapping(address => uint32) public userNoncesForStaking;
//     mapping(address => uint32) public userNoncesForWithdrawIncome;
//     mapping(address => uint32) public userNoncesForNodeConversion;
//     mapping(address => bool) public isUserRegForNodeConversion;

//     event Staked(
//         uint256 amountDsc,
//         uint256 amountDscInUsd,
//         uint256 amountUsdt,
//         uint256 rateDollarPerDsc,
//         address userAddress,
//         uint32 lastUsedNonce,
//         address sponsor
//     );

//     event WithdrawIncomeUsdt(
//         uint256 amountUsdt,
//         uint256 amountUsdtAfterDeduction,
//         address userAddress,
//         uint32 lastUsedNonce
//     );

//     event WithdrawIncomeDsc(
//         uint256 amountDsc,
//         uint256 amountDscInUsd,
//         uint256 amountDscAfterDeduction,
//         uint256 amountDscInUsdAfterDeduction,
//         uint256 rateDollarPerDsc,
//         address userAddress,
//         uint32 lastUsedNonce
//     );

//     event NodeRegistered(
//         address user,
//         uint256 amountUsdtPaid,
//         uint256 majorIncome,
//         uint256 minor4Income
//     );

//     event UpgradeNode(
//         address user,
//         string nodeName,
//         uint32 lastUsedNonce,
//         uint256 amountPaid,
//         uint256 majorIncome,
//         uint256 minor4Income
//     );

//     modifier onlyOwner() {
//         require(msg.sender == owner, "Not owner");
//         _;
//     }
//     modifier onlyOperator() {
//         require(msg.sender == operator, "Not operator");
//         _;
//     }

//     receive() external payable {}

//     fallback() external payable {}

//     function initialize(
//         address _owner,
//         address _operator,
//         address _usdt_token,
//         address _router
//     ) public initializer {
//         owner = _owner;
//         operator = _operator;
//         usdt_token = IERC20(_usdt_token);
//         router = IPancakeRouter(_router);
//         mixUsdtPart = 7;
//         mixDscPart = 3;
//     }

//     function isValidSignature(
//         address signer,
//         bytes32 hash,
//         uint8 v,
//         bytes32 r,
//         bytes32 s
//     ) public pure returns (bool) {
//         return
//             signer ==
//             ecrecover(
//                 keccak256(
//                     abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
//                 ),
//                 v,
//                 r,
//                 s
//             );
//     }

//     function setMixRatio(
//         uint256 _usdtPart,
//         uint256 _dscPart
//     ) external onlyOwner {
//         require(_usdtPart > 0 && _dscPart > 0, "Invalid parts");
//         mixUsdtPart = _usdtPart;
//         mixDscPart = _dscPart;
//     }

//     function getHashForStaking(
//         address _user,
//         uint256 amountDsc,
//         uint256 amountDscInUsd,
//         uint256 amountUsdt,
//         uint256 rate
//     ) public view returns (bytes32) {
//         return
//             keccak256(
//                 abi.encodePacked(
//                     _user,
//                     userNoncesForStaking[_user],
//                     amountDsc,
//                     amountDscInUsd,
//                     amountUsdt,
//                     rate
//                 )
//             );
//     }

//     function stake(
//         uint256 amountDsc,
//         uint256 amountDscInUsd,
//         uint256 amountUsdt,
//         uint256 rate,
//         address sponsor,
//         uint8 v,
//         bytes32 r,
//         bytes32 s
//     ) public payable {
//         address sender = msg.sender;
//         require(sponsor != address(0), "Invalid sponsor address!");

//         // Validate that at least one asset is provided
//         require(
//             amountDsc > 0 || amountUsdt > 0,
//             "Either DSC or USDT amount must be greater than zero!"
//         );

//         // If DSC is included, verify msg.value
//         if (amountDsc > 0) {
//             require(msg.value == amountDsc, "Incorrect DSC amount sent!");
//         } else {
//             require(msg.value == 0, "No DSC should be sent!");
//         }

//         // Validate signature
//         bytes32 hash = getHashForStaking(
//             sender,
//             amountDsc,
//             amountDscInUsd,
//             amountUsdt,
//             rate
//         );
//         require(
//             isValidSignature(operator, hash, v, r, s),
//             "Invalid Signature!"
//         );

//         // Check total USD equivalent
//         uint256 totalUsd = amountUsdt + amountDscInUsd;
//         require(
//             totalUsd % (100 * 1e18) == 0,
//             "Only $100 or multiples of $100 are allowed!"
//         );

//         uint32 oldNonce = userNoncesForStaking[sender];

//         // If USDT is included, transfer it
//         if (amountUsdt > 0) {
//             require(
//                 usdt_token.allowance(sender, address(this)) >= amountUsdt,
//                 "USDT allowance is too low!"
//             );
//             require(
//                 usdt_token.transferFrom(sender, address(this), amountUsdt),
//                 "USDT transfer failed!"
//             );
//         }

//         if (amountUsdt == 0 && amountDsc > 0) {
//             // do nothing (no LP)
//         }

//         // B) 100% USDT -> add 76% of USDT, match same USD in DSC from contract balance
//         else if (amountUsdt > 0 && amountDsc == 0) {
//             // 76% USDT to LP
//             uint256 usdtToLP = (amountUsdt * 76) / 100;

//             // USD value to match (1e18 USD)
//             uint256 xUsd = usdtToLP;

//             // DSC (native) needed in wei: xUsd (1e18 USD) / (USD per DSC in 1e18)
//             // => DSC = xUsd * 1e18 / rate
//             require(rate > 0, "Rate must be > 0");
//             uint256 dscNeeded = (xUsd * 1e18) / rate;

//             require(
//                 address(this).balance >= dscNeeded,
//                 "Insufficient DSC in contract"
//             );

//             _addLiquidityExact(sender, usdtToLP, dscNeeded);
//         }
//         // C) Mix (USDT + DSC) -> validate ratio, add 76% of each
//         else {
//             // Validate against configured mix ratio by USD proportions
//             uint256 parts = mixUsdtPart + mixDscPart;
//             uint256 expectedUsdt = (totalUsd * mixUsdtPart) / parts;

//             // allow tiny integer tolerance (0.1%)
//             uint256 tolerance = totalUsd / 1000;
//             require(
//                 amountUsdt + tolerance >= expectedUsdt &&
//                     amountUsdt <= expectedUsdt + tolerance,
//                 "Invalid USDT:DSC mix"
//             );

//             // Add 76% of each side
//             uint256 usdtToLP = (amountUsdt * 76) / 100;
//             uint256 dscToLP = (msg.value * 76) / 100; // native DSC

//             _addLiquidityExact(sender, usdtToLP, dscToLP);
//         }

//         // Increment nonce
//         userNoncesForStaking[sender]++;

//         emit Staked(
//             amountDsc,
//             amountDscInUsd,
//             amountUsdt,
//             rate,
//             sender,
//             oldNonce,
//             sponsor
//         );
//     }

//     function changeOwner(address _owner) public onlyOwner {
//         owner = _owner;
//     }

//     function getHashForWithdrawIncomeDsc(
//         address _user,
//         uint256 amountDsc,
//         uint256 amountDscInUsd,
//         uint256 amountDscInUsdIn1e18AfterDeduction,
//         uint256 amountDscIn1e18AfterDeduction,
//         uint256 rate
//     ) public view returns (bytes32) {
//         return
//             keccak256(
//                 abi.encodePacked(
//                     _user,
//                     userNoncesForWithdrawIncome[_user],
//                     amountDsc,
//                     amountDscInUsd,
//                     amountDscInUsdIn1e18AfterDeduction,
//                     amountDscIn1e18AfterDeduction,
//                     rate
//                 )
//             );
//     }

//     function getHashForWithdrawIncomeUsdt(
//         address _user,
//         uint256 amountUsdt,
//         uint256 amountUsdtIn1e18AfterDeduction
//     ) public view returns (bytes32) {
//         return
//             keccak256(
//                 abi.encodePacked(
//                     _user,
//                     userNoncesForWithdrawIncome[_user],
//                     amountUsdt,
//                     amountUsdtIn1e18AfterDeduction
//                 )
//             );
//     }

//     function withdrawIncomeUsdt(
//         uint256 amountUsdt,
//         uint256 amountUsdtIn1e18AfterDeduction,
//         uint8 v,
//         bytes32 r,
//         bytes32 s
//     ) public {
//         address sender = msg.sender;
//         bytes32 hash = getHashForWithdrawIncomeUsdt(
//             sender,
//             amountUsdt,
//             amountUsdtIn1e18AfterDeduction
//         );
//         require(
//             isValidSignature(operator, hash, v, r, s),
//             "Invalid Signature!"
//         );
//         address payable user = payable(sender);

//         uint32 oldNonce = userNoncesForWithdrawIncome[sender];
//         // validate input
//         if (amountUsdtIn1e18AfterDeduction > 0) {
//             // Case 1: withdraw only USDT
//             require(
//                 usdt_token.balanceOf(address(this)) >=
//                     amountUsdtIn1e18AfterDeduction,
//                 "Insufficient USDT balance in contract!"
//             );
//             require(
//                 usdt_token.transfer(user, amountUsdtIn1e18AfterDeduction),
//                 "USDT transfer failed!"
//             );
//             userNoncesForWithdrawIncome[sender]++;
//         }
//         emit WithdrawIncomeUsdt(
//             amountUsdt,
//             amountUsdtIn1e18AfterDeduction,
//             sender,
//             oldNonce
//         );
//     }

//     function withdrawIncomeDsc(
//         uint256 amountDsc,
//         uint256 amountDscInUsdt,
//         uint256 amountDscInUsdIn1e18AfterDeduction,
//         uint256 amountDscIn1e18AfterDeduction,
//         uint256 priceDscInUsdt,
//         uint8 v,
//         bytes32 r,
//         bytes32 s
//     ) public {
//         address sender = msg.sender;
//         bytes32 hash = getHashForWithdrawIncomeDsc(
//             sender,
//             amountDsc,
//             amountDscInUsdt,
//             amountDscInUsdIn1e18AfterDeduction,
//             amountDscIn1e18AfterDeduction,
//             priceDscInUsdt
//         );
//         require(
//             isValidSignature(operator, hash, v, r, s),
//             "Invalid Signature!"
//         );
//         address payable user = payable(sender);

//         uint32 oldNonce = userNoncesForWithdrawIncome[sender];
//         require(amountDscIn1e18AfterDeduction > 0, "Invalid amount!");

//         require(
//             address(this).balance >= amountDscIn1e18AfterDeduction,
//             "Insufficient DSC balance in contract!"
//         );
//         (bool sent, ) = user.call{value: amountDscIn1e18AfterDeduction}("");
//         require(sent, "DSC transfer failed!");

//         userNoncesForWithdrawIncome[sender]++;

//         emit WithdrawIncomeDsc(
//             amountDsc,
//             amountDscInUsdt,
//             amountDscIn1e18AfterDeduction,
//             amountDscInUsdIn1e18AfterDeduction,
//             priceDscInUsdt,
//             sender,
//             oldNonce
//         );
//     }

//     function getHashForNodeConversion(
//         address _user,
//         string memory nodeName
//     ) public view returns (bytes32) {
//         return
//             keccak256(
//                 abi.encodePacked(
//                     _user,
//                     userNoncesForNodeConversion[_user],
//                     nodeName
//                 )
//             );
//     }

//     function getHashForNodeRegistration(
//         address _user,
//         string memory nodeName,
//         uint256 amountToDeduct
//     ) public view returns (bytes32) {
//         return
//             keccak256(
//                 abi.encodePacked(
//                     _user,
//                     userNoncesForNodeConversion[_user],
//                     nodeName,
//                     amountToDeduct
//                 )
//             );
//     }

//     // function manageNode(
//     //     string memory nodeName,
//     //     uint256 amountToDeduct,
//     //     uint8 v,
//     //     bytes32 r,
//     //     bytes32 s
//     // ) public {
//     //     address sender = msg.sender;

//     //     bytes32 hash = getHashForNodeRegistration(
//     //         sender,
//     //         nodeName,
//     //         amountToDeduct
//     //     );
//     //     require(
//     //         isValidSignature(operator, hash, v, r, s),
//     //         "Invalid Signature!"
//     //     );

//     //     require(amountToDeduct > 0, "Deduction amount must be positive");

//     //     // Step 1: Deduct USDT from the user (transfer to this contract)
//     //     require(
//     //         usdt_token.allowance(sender, address(this)) >= amountToDeduct,
//     //         "USDT allowance is too low!"
//     //     );
//     //     require(
//     //         usdt_token.transferFrom(sender, address(this), amountToDeduct),
//     //         "USDT transfer failed!"
//     //     );

//     //     // Step 2: Split the deducted amount into two halves
//     //     uint256 amountToSwap = amountToDeduct / 2;
//     //     uint256 amountToDistribute = amountToDeduct - amountToSwap;

//     //     // Step 3: Swap 50% of the USDT for WBNB
//     //     if (amountToSwap > 0) {
//     //         address wbnbAddress = router.WETH(); // Gets WBNB address on BSC
//     //         address[] memory path = new address[](2);
//     //         path[0] = address(usdt_token);
//     //         path[1] = wbnbAddress;

//     //         // Approve the router to spend the USDT this contract now holds
//     //         usdt_token.approve(address(router), amountToSwap);

//     //         // Execute the swap. WBNB will be stored in this contract.
//     //         router.swapExactTokensForTokens(
//     //             amountToSwap,
//     //             0, // IMPORTANT: For production, set a secure minimum amount out
//     //             path,
//     //             address(this), // The recipient of the WBNB is this contract
//     //             block.timestamp + 600 // 10-minute deadline
//     //         );
//     //     }

//     //     uint256 remainingForFourParts = 0;

//     //     // Step 4: Distribute the remaining 50% into the five income variables
//     //     if (amountToDistribute > 0) {
//     //         // First part is 33.333...% (1/3)
//     //         uint256 firstPart = amountToDistribute / 3;
//     //         incomeStream1 += firstPart;
//     //         // The remaining 66.666...% is split into 4 equal parts
//     //         remainingForFourParts = amountToDistribute - firstPart;
//     //     }

//     //     userNoncesForNodeConversion[sender]++;

//     //     emit NodeRegistered(
//     //         sender,
//     //         nodeName,
//     //         amountToDeduct,
//     //         incomeStream1,
//     //         remainingForFourParts
//     //     );
//     // }

//     function upgradeNode(
//         string memory nodeName,
//         address sender,
//         uint256 amountPaid
//     ) internal {
//         // bytes32 hash = getHashForNodeConversion(sender, nodeName);
//         // require(
//         //     isValidSignature(operator, hash, v, r, s),
//         //     "Invalid Signature!"
//         // );

//         uint32 oldNonce = userNoncesForNodeConversion[sender];
//         userNoncesForNodeConversion[sender]++;

//         // emit UpgradeNode(sender, nodeName, oldNonce, amountPaid);
//     }

//     function paymentAndDistribution(
//         uint256 amountToDeduct,
//         address sender,
//         bool isRegistration,
//         string memory action
//     ) internal {
//         require(amountToDeduct > 0, "Deduction amount must be positive");

//         // Step 1: Deduct USDT from the user (transfer to this contract)
//         require(
//             usdt_token.allowance(sender, address(this)) >= amountToDeduct,
//             "USDT allowance is too low!"
//         );
//         require(
//             usdt_token.transferFrom(sender, address(this), amountToDeduct),
//             "USDT transfer failed!"
//         );

//         uint256 amountToSwap = amountToDeduct / 2;
//         uint256 amountToDistribute = amountToDeduct - amountToSwap;

//         // Step 3: Swap 50% of the USDT for WBNB
//         if (amountToSwap > 0) {
//             address wbnbAddress = router.WETH(); // Gets WBNB address on BSC
//             address[] memory path = new address[](2);
//             path[0] = address(usdt_token);
//             path[1] = wbnbAddress;

//             // Approve the router to spend the USDT this contract now holds
//             usdt_token.approve(address(router), amountToSwap);

//             // Execute the swap. WBNB will be stored in this contract.
//             router.swapExactTokensForTokens(
//                 amountToSwap,
//                 0, // IMPORTANT: For production, set a secure minimum amount out
//                 path,
//                 address(this), // The recipient of the WBNB is this contract
//                 block.timestamp + 600 // 10-minute deadline
//             );
//         }

//         uint256 remainingForFourParts = 0;

//         // Step 4: Distribute the remaining 50% into the five income variables
//         if (amountToDistribute > 0) {
//             // First part is 33.333...% (1/3)
//             uint256 firstPart = amountToDistribute / 3;
//             incomeStream1 += firstPart;
//             // The remaining 66.666...% is split into 4 equal parts
//             remainingForFourParts = amountToDistribute - firstPart;
//         }

//         if(isRegistration){

//             isUserRegForNodeConversion[sender] = true;
//             emit NodeRegistered(
//             sender,
//             amountToDeduct,
//             incomeStream1,
//             remainingForFourParts
//             );
//         }else {
//             upgradeNode(action, sender, amountToDeduct,incomeStream1,remainingForFourParts);
//         }
//     }

//     function manageNode(
//         string memory action,
//         uint256 amountToDeduct,
//         uint8 v,
//         bytes32 r,
//         bytes32 s
//     ) public {
//         address sender = msg.sender;

//         bytes32 hash = getHashForNodeRegistration(
//             sender,
//             action,
//             amountToDeduct
//         );
//         require(
//             isValidSignature(operator, hash, v, r, s),
//             "Invalid Signature!"
//         );

//         bool isRegisteredForNode = isUserRegForNodeConversion[sender];

//         if(!isRegisteredForNode){

//             require(amountToDeduct >= 300, "Registration amount is 300$");
//             paymentAndDistribution(amountToDeduct, sender,true,action);
//         }else {
            
//             paymentAndDistribution(amountToDeduct, sender,false,action);
//         }


//         // Step 1: Deduct USDT from the user (transfer to this contract)
//         // require(
//         //     usdt_token.allowance(sender, address(this)) >= amountToDeduct,
//         //     "USDT allowance is too low!"
//         // );
//         // require(
//         //     usdt_token.transferFrom(sender, address(this), amountToDeduct),
//         //     "USDT transfer failed!"
//         // );

//         // Step 2: Split the deducted amount into two halves
//         // uint256 amountToSwap = amountToDeduct / 2;
//         // uint256 amountToDistribute = amountToDeduct - amountToSwap;

//         // // Step 3: Swap 50% of the USDT for WBNB
//         // if (amountToSwap > 0) {
//         //     address wbnbAddress = router.WETH(); // Gets WBNB address on BSC
//         //     address[] memory path = new address[](2);
//         //     path[0] = address(usdt_token);
//         //     path[1] = wbnbAddress;

//         //     // Approve the router to spend the USDT this contract now holds
//         //     usdt_token.approve(address(router), amountToSwap);

//         //     // Execute the swap. WBNB will be stored in this contract.
//         //     router.swapExactTokensForTokens(
//         //         amountToSwap,
//         //         0, // IMPORTANT: For production, set a secure minimum amount out
//         //         path,
//         //         address(this), // The recipient of the WBNB is this contract
//         //         block.timestamp + 600 // 10-minute deadline
//         //     );
//         // }

//         // uint256 remainingForFourParts = 0;

//         // // Step 4: Distribute the remaining 50% into the five income variables
//         // if (amountToDistribute > 0) {
//         //     // First part is 33.333...% (1/3)
//         //     uint256 firstPart = amountToDistribute / 3;
//         //     incomeStream1 += firstPart;
//         //     // The remaining 66.666...% is split into 4 equal parts
//         //     remainingForFourParts = amountToDistribute - firstPart;
//         // }

//         // userNoncesForNodeConversion[sender]++;

        
//     }

//     function _addLiquidityExact(
//         address to,
//         uint256 usdtAmount,
//         uint256 nativeAmount
//     ) internal {
//         if (usdtAmount == 0 || nativeAmount == 0) return;

//         // Approve USDT to router
//         usdt_token.approve(address(router), usdtAmount);

//         // Add liquidity: USDT + native DSC
//         router.addLiquidityETH{value: nativeAmount}(
//             address(usdt_token),
//             usdtAmount,
//             0,
//             0,
//             to, // send LP to user (or address(this))
//             block.timestamp + 600
//         );
//     }
// }
