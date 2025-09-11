// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

contract Initializable {
    bool private _initialized;

    bool private _initializing;

    modifier initializer() {
        require(
            _initializing || !_initialized,
            "Initializable: contract is already initialized"
        );

        bool isTopLevelCall = !_initializing;
        if (isTopLevelCall) {
            _initializing = true;
            _initialized = true;
        }

        _;

        if (isTopLevelCall) {
            _initializing = false;
        }
    }
}

interface IPancakeRouter {
    function WETH() external pure returns (address);

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract dscNodeValidator is Initializable {
    address public owner;
    address public operator;
    uint256 public mixUsdtPart; // default 70% USDT
    uint256 public mixDscPart;
    uint256 public incomeStream1;
    uint256 public incomeStream2;
    uint256 public incomeStream3;
    uint256 public incomeStream4;
    uint256 public incomeStream5;
    IERC20 public usdt_token;
    IPancakeRouter public router; // ✅ router added

    mapping(address => uint32) public userNoncesForStaking;
    mapping(address => uint32) public userNoncesForWithdrawIncome;
    mapping(address => uint32) public userNoncesForNodeConversion;
    mapping(address => bool) public isUserRegForNodeConversion;

    event Staked(
        uint256 amountDsc,
        uint256 amountDscInUsd,
        uint256 amountUsdt,
        uint256 rateDollarPerDsc,
        address userAddress,
        uint32 lastUsedNonce,
        address sponsor
    );

    event WithdrawIncomeUsdt(
        uint256 amountUsdt,
        uint256 amountUsdtAfterDeduction,
        address userAddress,
        uint32 lastUsedNonce
    );

    event WithdrawIncomeDsc(
        uint256 amountDsc,
        uint256 amountDscInUsd,
        uint256 amountDscAfterDeduction,
        uint256 amountDscInUsdAfterDeduction,
        uint256 rateDollarPerDsc,
        address userAddress,
        uint32 lastUsedNonce
    );

    event NodeRegistered(
        address user,
        uint256 amountUsdtPaid, 
        uint256 majorIncome,
        uint256 minor4Income
    );

    event UpgradeNode(
        address user,
        string nodeName,
        uint32 lastUsedNonce,
        uint256 amountUsdtPaid,
        uint256 majorIncome,
        uint256 minor4Income
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    receive() external payable {}

    fallback() external payable {}

    function initialize(
        address _owner,
        address _operator,
        address _usdt_token,
        address _router
    ) public initializer {
        owner = _owner;
        operator = _operator;
        usdt_token = IERC20(_usdt_token);
        router = IPancakeRouter(_router);
        mixUsdtPart = 7;
        mixDscPart = 3;
    }

    function isValidSignature(
        address signer,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public pure returns (bool) {
        return
            signer ==
            ecrecover(
                keccak256(
                    abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
                ),
                v,
                r,
                s
            );
    }

    function setMixRatio(
        uint256 _usdtPart,
        uint256 _dscPart
    ) external onlyOwner {
        require(_usdtPart > 0 && _dscPart > 0, "Invalid parts");
        mixUsdtPart = _usdtPart;
        mixDscPart = _dscPart;
    }

    function getHashForStaking(
        address _user,
        uint256 amountDsc,
        uint256 amountDscInUsd,
        uint256 amountUsdt,
        uint256 rate
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _user,
                    userNoncesForStaking[_user],
                    amountDsc,
                    amountDscInUsd,
                    amountUsdt,
                    rate
                )
            );
    }

    function stake(
        uint256 amountDsc,
        uint256 amountDscInUsd,
        uint256 amountUsdt,
        uint256 rate,
        address sponsor,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable {
        address sender = msg.sender;
        require(sponsor != address(0), "Invalid sponsor address!");

        // Validate that at least one asset is provided
        require(
            amountDsc > 0 || amountUsdt > 0,
            "Either DSC or USDT amount must be greater than zero!"
        );

        // If DSC is included, verify msg.value
        if (amountDsc > 0) {
            require(msg.value == amountDsc, "Incorrect DSC amount sent!");
        } else {
            require(msg.value == 0, "No DSC should be sent!");
        }

        // Validate signature
        bytes32 hash = getHashForStaking(
            sender,
            amountDsc,
            amountDscInUsd,
            amountUsdt,
            rate
        );
        require(
            isValidSignature(operator, hash, v, r, s),
            "Invalid Signature!"
        );

        // Check total USD equivalent
        uint256 totalUsd = amountUsdt + amountDscInUsd;
        require(
            totalUsd % (100 * 1e18) == 0,
            "Only $100 or multiples of $100 are allowed!"
        );

        uint32 oldNonce = userNoncesForStaking[sender];

        // If USDT is included, transfer it
        if (amountUsdt > 0) {
            require(
                usdt_token.allowance(sender, address(this)) >= amountUsdt,
                "USDT allowance is too low!"
            );
            require(
                usdt_token.transferFrom(sender, address(this), amountUsdt),
                "USDT transfer failed!"
            );
        }

        if (amountUsdt == 0 && amountDsc > 0) {
            // do nothing (no LP)
        }

        // B) 100% USDT -> add 76% of USDT, match same USD in DSC from contract balance
        else if (amountUsdt > 0 && amountDsc == 0) {
            // 76% USDT to LP
            uint256 usdtToLP = (amountUsdt * 76) / 100;

            // USD value to match (1e18 USD)
            uint256 xUsd = usdtToLP;

            // DSC (native) needed in wei: xUsd (1e18 USD) / (USD per DSC in 1e18)
            // => DSC = xUsd * 1e18 / rate
            require(rate > 0, "Rate must be > 0");
            uint256 dscNeeded = (xUsd * 1e18) / rate;

            require(
                address(this).balance >= dscNeeded,
                "Insufficient DSC in contract"
            );

            _addLiquidityExact(sender, usdtToLP, dscNeeded);
        }
        // C) Mix (USDT + DSC) -> validate ratio, add 76% of each
        else {
            // Validate against configured mix ratio by USD proportions
            uint256 parts = mixUsdtPart + mixDscPart;
            uint256 expectedUsdt = (totalUsd * mixUsdtPart) / parts;

            // allow tiny integer tolerance (0.1%)
            uint256 tolerance = totalUsd / 1000;
            require(
                amountUsdt + tolerance >= expectedUsdt &&
                    amountUsdt <= expectedUsdt + tolerance,
                "Invalid USDT:DSC mix"
            );

            // Add 76% of each side
            uint256 usdtToLP = (amountUsdt * 76) / 100;
            uint256 dscToLP = (msg.value * 76) / 100; // native DSC

            _addLiquidityExact(sender, usdtToLP, dscToLP);
        }

        // Increment nonce
        userNoncesForStaking[sender]++;

        emit Staked(
            amountDsc,
            amountDscInUsd,
            amountUsdt,
            rate,
            sender,
            oldNonce,
            sponsor
        );
    }

    function changeOwner(address _owner) public onlyOwner {
        owner = _owner;
    }

    function getHashForWithdrawIncomeDsc(
        address _user,
        uint256 amountDsc,
        uint256 amountDscInUsd,
        uint256 amountDscInUsdIn1e18AfterDeduction,
        uint256 amountDscIn1e18AfterDeduction,
        uint256 rate
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _user,
                    userNoncesForWithdrawIncome[_user],
                    amountDsc,
                    amountDscInUsd,
                    amountDscInUsdIn1e18AfterDeduction,
                    amountDscIn1e18AfterDeduction,
                    rate
                )
            );
    }

    function getHashForWithdrawIncomeUsdt(
        address _user,
        uint256 amountUsdt,
        uint256 amountUsdtIn1e18AfterDeduction
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _user,
                    userNoncesForWithdrawIncome[_user],
                    amountUsdt,
                    amountUsdtIn1e18AfterDeduction
                )
            );
    }

    function withdrawIncomeUsdt(
        uint256 amountUsdt,
        uint256 amountUsdtIn1e18AfterDeduction,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        address sender = msg.sender;
        bytes32 hash = getHashForWithdrawIncomeUsdt(
            sender,
            amountUsdt,
            amountUsdtIn1e18AfterDeduction
        );
        require(
            isValidSignature(operator, hash, v, r, s),
            "Invalid Signature!"
        );
        address payable user = payable(sender);

        uint32 oldNonce = userNoncesForWithdrawIncome[sender];
        // validate input
        if (amountUsdtIn1e18AfterDeduction > 0) {
            // Case 1: withdraw only USDT
            require(
                usdt_token.balanceOf(address(this)) >=
                    amountUsdtIn1e18AfterDeduction,
                "Insufficient USDT balance in contract!"
            );
            require(
                usdt_token.transfer(user, amountUsdtIn1e18AfterDeduction),
                "USDT transfer failed!"
            );
            userNoncesForWithdrawIncome[sender]++;
        }
        emit WithdrawIncomeUsdt(
            amountUsdt,
            amountUsdtIn1e18AfterDeduction,
            sender,
            oldNonce
        );
    }

    function withdrawIncomeDsc(
        uint256 amountDsc,
        uint256 amountDscInUsdt,
        uint256 amountDscInUsdIn1e18AfterDeduction,
        uint256 amountDscIn1e18AfterDeduction,
        uint256 priceDscInUsdt,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        address sender = msg.sender;
        bytes32 hash = getHashForWithdrawIncomeDsc(
            sender,
            amountDsc,
            amountDscInUsdt,
            amountDscInUsdIn1e18AfterDeduction,
            amountDscIn1e18AfterDeduction,
            priceDscInUsdt
        );
        require(
            isValidSignature(operator, hash, v, r, s),
            "Invalid Signature!"
        );
        address payable user = payable(sender);

        uint32 oldNonce = userNoncesForWithdrawIncome[sender];
        require(amountDscIn1e18AfterDeduction > 0, "Invalid amount!");

        require(
            address(this).balance >= amountDscIn1e18AfterDeduction,
            "Insufficient DSC balance in contract!"
        );
        (bool sent, ) = user.call{value: amountDscIn1e18AfterDeduction}("");
        require(sent, "DSC transfer failed!");

        userNoncesForWithdrawIncome[sender]++;

        emit WithdrawIncomeDsc(
            amountDsc,
            amountDscInUsdt,
            amountDscIn1e18AfterDeduction,
            amountDscInUsdIn1e18AfterDeduction,
            priceDscInUsdt,
            sender,
            oldNonce
        );
    }

    function getHashForNodeConversion(
        address _user,
        string memory nodeName
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _user,
                    userNoncesForNodeConversion[_user],
                    nodeName
                )
            );
    }

    function getHashForNodeRegistration(
        address _user,
        uint256 amountToDeduct,
        string memory action
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _user,
                    userNoncesForNodeConversion[_user],
                    amountToDeduct,
                    action
                )
            );
    }

    // function manageNode(
    //     string memory nodeName,
    //     uint256 amountToDeduct,
    //     uint8 v,
    //     bytes32 r,
    //     bytes32 s
    // ) public {
    //     address sender = msg.sender;

    //     bytes32 hash = getHashForNodeRegistration(
    //         sender,
    //         nodeName,
    //         amountToDeduct
    //     );
    //     require(
    //         isValidSignature(operator, hash, v, r, s),
    //         "Invalid Signature!"
    //     );

    //     require(amountToDeduct > 0, "Deduction amount must be positive");

    //     // Step 1: Deduct USDT from the user (transfer to this contract)
    //     require(
    //         usdt_token.allowance(sender, address(this)) >= amountToDeduct,
    //         "USDT allowance is too low!"
    //     );
    //     require(
    //         usdt_token.transferFrom(sender, address(this), amountToDeduct),
    //         "USDT transfer failed!"
    //     );

    //     // Step 2: Split the deducted amount into two halves
    //     uint256 amountToSwap = amountToDeduct / 2;
    //     uint256 amountToDistribute = amountToDeduct - amountToSwap;

    //     // Step 3: Swap 50% of the USDT for WBNB
    //     if (amountToSwap > 0) {
    //         address wbnbAddress = router.WETH(); // Gets WBNB address on BSC
    //         address[] memory path = new address[](2);
    //         path[0] = address(usdt_token);
    //         path[1] = wbnbAddress;

    //         // Approve the router to spend the USDT this contract now holds
    //         usdt_token.approve(address(router), amountToSwap);

    //         // Execute the swap. WBNB will be stored in this contract.
    //         router.swapExactTokensForTokens(
    //             amountToSwap,
    //             0, // IMPORTANT: For production, set a secure minimum amount out
    //             path,
    //             address(this), // The recipient of the WBNB is this contract
    //             block.timestamp + 600 // 10-minute deadline
    //         );
    //     }

    //     uint256 remainingForFourParts = 0;

    //     // Step 4: Distribute the remaining 50% into the five income variables
    //     if (amountToDistribute > 0) {
    //         // First part is 33.333...% (1/3)
    //         uint256 firstPart = amountToDistribute / 3;
    //         incomeStream1 += firstPart;
    //         // The remaining 66.666...% is split into 4 equal parts
    //         remainingForFourParts = amountToDistribute - firstPart;
    //     }

    //     userNoncesForNodeConversion[sender]++;

    //     emit NodeRegistered(
    //         sender,
    //         nodeName,
    //         amountToDeduct,
    //         incomeStream1,
    //         remainingForFourParts
    //     );
    // }

    // function upgradeNode(
    //     string memory nodeName,
    //     address sender,
    //     uint256 amountPaid
    // ) internal {
        // bytes32 hash = getHashForNodeConversion(sender, nodeName);
        // require(
        //     isValidSignature(operator, hash, v, r, s),
        //     "Invalid Signature!"
        // );

        // uint32 oldNonce = userNoncesForNodeConversion[sender];
        // userNoncesForNodeConversion[sender]++;

        // emit UpgradeNode(sender, nodeName, oldNonce, amountPaid);
    // }

    function paymentAndDistribution(
        uint256 amountToDeduct,
        address sender,
        bool isRegistration,
        string memory action
    ) internal {
        // require(amountToDeduct > 0, "Deduction amount must be positive");

        // Step 1: Deduct USDT from the user (transfer to this contract)
        require(
            usdt_token.allowance(sender, address(this)) >= amountToDeduct,
            "USDT allowance is too low!"
        );
        require(
            usdt_token.transferFrom(sender, address(this), amountToDeduct),
            "USDT transfer failed!"
        );

        uint256 amountToSwap = amountToDeduct / 2;
        uint256 amountToDistribute = amountToDeduct - amountToSwap;

        // Step 3: Swap 50% of the USDT for WBNB
        if (amountToSwap > 0) {
            address wbnbAddress = router.WETH(); // Gets WBNB address on BSC
            address[] memory path = new address[](2);
            path[0] = address(usdt_token);
            path[1] = wbnbAddress;

            // Approve the router to spend the USDT this contract now holds
            usdt_token.approve(address(router), amountToSwap);

            // Execute the swap. WBNB will be stored in this contract.
            router.swapExactTokensForTokens(
                amountToSwap,
                0, // IMPORTANT: For production, set a secure minimum amount out
                path,
                address(this), // The recipient of the WBNB is this contract
                block.timestamp + 600 // 10-minute deadline
            );
        }

        uint256 remainingForFourParts = 0;

        // Step 4: Distribute the remaining 50% into the five income variables
        if (amountToDistribute > 0) {
            // First part is 33.333...% (1/3)
            uint256 firstPart = amountToDistribute / 3;
            incomeStream1 += firstPart;
            // The remaining 66.666...% is split into 4 equal parts
            remainingForFourParts = amountToDistribute - firstPart;
        }

        if (isRegistration) {
            isUserRegForNodeConversion[sender] = true;
            emit NodeRegistered(
                sender,
                amountToDeduct,
                incomeStream1,
                remainingForFourParts
            );
        } else {
            uint32 oldNonce = userNoncesForNodeConversion[sender];
            userNoncesForNodeConversion[sender]++;
            emit UpgradeNode(
                sender,
                action,
                oldNonce,
                amountToDeduct,
                incomeStream1,
                remainingForFourParts
            );
        }
    }

    function manageNode(
        string memory action,
        uint256 amountToDeduct,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        address sender = msg.sender;

        require(sender != address(0),"Invalid address!");

        bytes32 hash = getHashForNodeRegistration(
            sender,
            amountToDeduct,
            action
        );
        require(
            isValidSignature(operator, hash, v, r, s),
            "Invalid Signature!"
        );

        bool isRegisteredForNode = isUserRegForNodeConversion[sender];

        if (!isRegisteredForNode) {
            require(amountToDeduct >= 300*1e18, "Registration amount is 300$");
            paymentAndDistribution(amountToDeduct, sender, true, action);
        } else {
            paymentAndDistribution(amountToDeduct, sender, false, action);
        }

        // Step 1: Deduct USDT from the user (transfer to this contract)
        // require(
        //     usdt_token.allowance(sender, address(this)) >= amountToDeduct,
        //     "USDT allowance is too low!"
        // );
        // require(
        //     usdt_token.transferFrom(sender, address(this), amountToDeduct),
        //     "USDT transfer failed!"
        // );

        // Step 2: Split the deducted amount into two halves
        // uint256 amountToSwap = amountToDeduct / 2;
        // uint256 amountToDistribute = amountToDeduct - amountToSwap;

        // // Step 3: Swap 50% of the USDT for WBNB
        // if (amountToSwap > 0) {
        //     address wbnbAddress = router.WETH(); // Gets WBNB address on BSC
        //     address[] memory path = new address[](2);
        //     path[0] = address(usdt_token);
        //     path[1] = wbnbAddress;

        //     // Approve the router to spend the USDT this contract now holds
        //     usdt_token.approve(address(router), amountToSwap);

        //     // Execute the swap. WBNB will be stored in this contract.
        //     router.swapExactTokensForTokens(
        //         amountToSwap,
        //         0, // IMPORTANT: For production, set a secure minimum amount out
        //         path,
        //         address(this), // The recipient of the WBNB is this contract
        //         block.timestamp + 600 // 10-minute deadline
        //     );
        // }

        // uint256 remainingForFourParts = 0;

        // // Step 4: Distribute the remaining 50% into the five income variables
        // if (amountToDistribute > 0) {
        //     // First part is 33.333...% (1/3)
        //     uint256 firstPart = amountToDistribute / 3;
        //     incomeStream1 += firstPart;
        //     // The remaining 66.666...% is split into 4 equal parts
        //     remainingForFourParts = amountToDistribute - firstPart;
        // }

        // userNoncesForNodeConversion[sender]++;
    }

    function _addLiquidityExact(
        address to,
        uint256 usdtAmount,
        uint256 nativeAmount
    ) internal {
        if (usdtAmount == 0 || nativeAmount == 0) return;

        // Approve USDT to router
        usdt_token.approve(address(router), usdtAmount);

        // Add liquidity: USDT + native DSC
        router.addLiquidityETH{value: nativeAmount}(
            address(usdt_token),
            usdtAmount,
            0,
            0,
            to, // send LP to user (or address(this))
            block.timestamp + 600
        );
    }
}
