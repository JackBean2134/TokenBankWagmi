// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TokenBank.sol";
import "./IERC20TokensReceived.sol";

/**
 * @title TokenBankV2
 * @dev 扩展 TokenBank，支持 one-step 存款：
 * 用户直接调用 CalledToken.transferWithCallback(bank, amount) 即可完成存款，
 * 无需先 approve。
 */
contract TokenBankV2 is TokenBank, IERC20TokensReceived {
    event DepositWithCallback(address indexed user, uint256 amount);

    constructor(address _tokenAddr) TokenBank(_tokenAddr) {}

    /**
     * @dev 由 CalledToken.transferWithCallback 回调触发，自动完成存款。
     * 只有代币合约可以调用。
     */
    function tokensReceived(address from, uint256 value) external override returns (bool) {
        require(msg.sender == address(token), "TokenBankV2: only token contract");
        require(value > 0, "TokenBankV2: value must be > 0");
        balances[from] += value;
        emit DepositWithCallback(from, value);
        emit Deposit(from, value);
        return true;
    }
}