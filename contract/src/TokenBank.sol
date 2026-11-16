// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title TokenBank
 * @dev 一个安全的代币存取合约（tokenbank-v2 的基础版本）。
 * 用户可以存入指定 ERC20 代币（approve + deposit），之后随时取出。
 */
contract TokenBank {
    IERC20 public immutable token;

    // 记录每个地址已存入的代币数量
    mapping(address => uint256) public balances;

    // 重入锁
    uint256 private _locked = 1;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    error ZeroAmount();
    error InsufficientBalance();
    error InvalidTokenAddress();
    error ReentrantCall();
    error TransferFailed();

    modifier nonReentrant() {
        if (_locked != 1) revert ReentrantCall();
        _locked = 2;
        _;
        _locked = 1;
    }

    /**
     * @dev 构造函数
     * @param _token 支持的 ERC20 代币地址
     */
    constructor(address _token) {
        if (_token == address(0)) revert InvalidTokenAddress();
        token = IERC20(_token);
    }

    /**
     * @dev 存入代币：要求调用者已 approve 足够额度给本合约
     * @param amount 存入数量
     */
    function deposit(uint256 amount) external virtual nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // 先记录余额再转账，避免任何潜在的重入问题
        balances[msg.sender] += amount;

        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        emit Deposit(msg.sender, amount);
    }

    /**
     * @dev 提取代币
     * @param amount 提取数量
     */
    function withdraw(uint256 amount) external virtual nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (balances[msg.sender] < amount) revert InsufficientBalance();

        // 先更新状态
        balances[msg.sender] -= amount;

        if (!token.transfer(msg.sender, amount)) revert TransferFailed();

        emit Withdraw(msg.sender, amount);
    }

    /**
     * @dev 查询用户在本合约中的存款余额
     */
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    /**
     * @dev 本合约持有的代币总量
     */
    function totalDeposits() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}