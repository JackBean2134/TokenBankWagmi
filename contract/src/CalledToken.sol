// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IERC20TokensReceived.sol";

/**
 * @title CalledToken
 * @dev 一个支持回调转账的 ERC20 代币。
 * 通过 transferWithCallback 转账时，若接收方实现了 IERC20TokensReceived，
 * 则自动回调 tokensReceived，用于 TokenBankV2 的 one-step 存款。
 */
contract CalledToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev 构造函数
     * @param _name 代币名称
     * @param _symbol 代币符号
     * @param _mintAmount 铸造数量（不含精度）
     */
    constructor(string memory _name, string memory _symbol, uint256 _mintAmount) {
        name = _name;
        symbol = _symbol;
        totalSupply = _mintAmount * 10 ** uint256(decimals);
        balances[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function balanceOf(address owner) external view returns (uint256) {
        return balances[owner];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return allowances[owner][spender];
    }

    function transfer(address to, uint256 value) public returns (bool) {
        return _transfer(msg.sender, to, value);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(balances[from] >= value, "CalledToken: balance not enough");
        require(allowances[from][msg.sender] >= value, "CalledToken: allowance not enough");
        allowances[from][msg.sender] -= value;
        return _transfer(from, to, value);
    }

    /**
     * @dev 带回调的转账：
     * 1. 先执行普通 ERC20 转账（发送 Token => 接收方）
     * 2. 若接收方是合约且实现 IERC20TokensReceived，则回调 tokensReceived(msg.sender, value)
     *    用于 TokenBankV2 一步存款。
     */
    function transferWithCallback(address to, uint256 value) public returns (bool) {
        _transfer(msg.sender, to, value);

        if (to.code.length > 0) {
            bool success = IERC20TokensReceived(to).tokensReceived(msg.sender, value);
            require(success, "CalledToken: callback failed");
        }
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal returns (bool) {
        require(to != address(0), "CalledToken: transfer to zero address");
        require(balances[from] >= value, "CalledToken: balance not enough");
        balances[from] -= value;
        balances[to] += value;
        emit Transfer(from, to, value);
        return true;
    }
}