// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CalledToken.sol";
import "../src/TokenBankV2.sol";

/**
 * @title SimTransfer
 * @dev 在本地 anvil 上模拟一次 one-step 存款与取款，便于前端联调时看到转账记录。
 * 用法（先部署，再把地址通过环境变量传入）：
 *   TOKEN=0x.. BANK=0x.. forge script script/SimTransfer.s.sol:SimTransfer \
 *     --rpc-url http://127.0.0.1:8545 --broadcast
 */
contract SimTransfer is Script {
    uint256 constant DEFAULT_ANVIL_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", DEFAULT_ANVIL_KEY);
        address tokenAddr = vm.envAddress("TOKEN");
        address bankAddr = vm.envAddress("BANK");

        address deployer = vm.addr(pk);
        CalledToken token = CalledToken(tokenAddr);
        TokenBankV2 bank = TokenBankV2(bankAddr);

        vm.startBroadcast(pk);

        // 1. 一步存款：transferWithCallback 直接存入 bank
        token.transferWithCallback(bankAddr, 1000 ether);
        console2.log("Deposited 1000 CTK, bank balance:", bank.balanceOf(deployer));

        // 2. 普通转账（产生一条普通 Transfer 记录，便于 indexer 展示）
        token.transfer(address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8), 100 ether);

        // 3. 取款 400 CTK
        bank.withdraw(400 ether);
        console2.log("Withdrew 400 CTK, bank balance:", bank.balanceOf(deployer));

        vm.stopBroadcast();
    }
}