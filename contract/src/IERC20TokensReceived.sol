// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC20TokensReceived
 * @dev 收款方回调接口。
 * 支持 tokenbank-v2 的 one-step 存款：代币通过 transferWithCallback 转入时，
 * 目标合约（TokenBankV2）实现 tokensReceived，自动把余额记入存款。
 */
interface IERC20TokensReceived {
    /**
     * @dev 代币转入时被 CalledToken 调用
     * @param from 代币发送者（实际调用 transferWithCallback 的地址）
     * @param value 转入数量
     * @return true 表示接收成功
     */
    function tokensReceived(address from, uint256 value) external returns (bool);
}