// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CalledToken.sol";
import "../src/TokenBankV2.sol";

/**
 * @title Deploy
 * @dev 部署 CalledToken 与 TokenBankV2（anvil / 测试网通用）
 * 用法：
 *   anvil
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url http://127.0.0.1:8545 \
 *     --broadcast
 */
contract Deploy is Script {
    // anvil 默认第一个账户私钥
    uint256 constant DEFAULT_ANVIL_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", DEFAULT_ANVIL_KEY);

        vm.startBroadcast(deployerPrivateKey);

        // 初始供应量 1,000,000 CTK（18 位精度）
        CalledToken token = new CalledToken("CalledToken", "CTK", 1_000_000);
        console2.log("CalledToken deployed at:", address(token));

        TokenBankV2 bank = new TokenBankV2(address(token));
        console2.log("TokenBankV2 deployed at:", address(bank));

        vm.stopBroadcast();

        console2.log("\n=== Deployment Summary ===");
        console2.log("CalledToken :", address(token));
        console2.log("TokenBankV2 :", address(bank));
        console2.log("Deployer    :", vm.addr(deployerPrivateKey));
    }
}