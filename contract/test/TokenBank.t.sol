// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/CalledToken.sol";
import "../src/TokenBankV2.sol";

contract TokenBankTest is Test {
    CalledToken token;
    TokenBankV2 bank;
    address alice;
    address bob;
    uint256 constant MINT = 1_000_000 ether;

    function setUp() public {
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        vm.prank(alice);
        token = new CalledToken("CalledToken", "CTK", 1_000_000);
        vm.prank(alice);
        bank = new TokenBankV2(address(token));
    }

    // one-step 存款：transferWithCallback 直接完成
    function testDepositWithCallback() public {
        vm.prank(alice);
        token.transferWithCallback(address(bank), 100 ether);

        assertEq(bank.balanceOf(alice), 100 ether);
        assertEq(token.balanceOf(address(bank)), 100 ether);
    }

    // 取款
    function testWithdraw() public {
        vm.prank(alice);
        token.transferWithCallback(address(bank), 100 ether);

        vm.prank(alice);
        bank.withdraw(40 ether);

        assertEq(bank.balanceOf(alice), 60 ether);
        assertEq(token.balanceOf(alice), MINT - 100 ether + 40 ether);
    }

    // 普通 approve + deposit 仍可用
    function testDepositWithApprove() public {
        vm.prank(alice);
        token.approve(address(bank), 50 ether);

        vm.prank(alice);
        bank.deposit(50 ether);

        assertEq(bank.balanceOf(alice), 50 ether);
    }

    // 只有代币合约能触发回调
    function testOnlyTokenCanCallback() public {
        vm.prank(bob);
        vm.expectRevert("TokenBankV2: only token contract");
        bank.tokensReceived(alice, 1 ether);
    }
}