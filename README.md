# TokenBankWagmi

参考 [lbc-team/TokenBank](https://github.com/lbc-team/TokenBank) tokenbank-v2 分支实现的全栈 Demo：

- **CalledToken**：基于 `transferWithCallback` 回调的 ERC20 代币
- **TokenBank / TokenBankV2**：代币银行合约，支持一步存款（无需 approve）
- **前端（front/）**：wagmi + viem + React + Vite，连接钱包、存款/取款、余额展示，并调用后端 indexer 展示转账记录
- **后端（back_scripts/indexer.js）**：纯 Node 零依赖的链上 `Transfer` 事件索引器，提供 `GET /api/transfers/:address` 查询接口

## 目录结构

```
├── contract/                  # Foundry 智能合约
│   ├── src/
│   │   ├── IERC20TokensReceived.sol   # 回调接口
│   │   ├── CalledToken.sol            # 支持 transferWithCallback 的 ERC20
│   │   ├── TokenBank.sol              # 基础存取款（approve + deposit）
│   │   └── TokenBankV2.sol            # 回调一步存款版
│   ├── script/Deploy.s.sol            # 部署脚本
│   ├── script/SimTransfer.s.sol       # 模拟交易的脚本（生成转账记录）
│   └── test/TokenBank.t.sol           # 合约测试
├── front/                     # Vite + React + wagmi 前端
│   ├── src/App.tsx                   # 主界面（存款/取款/余额/记录）
│   ├── src/wagmi.ts                  # wagmi 配置（anvil 31337）
│   └── src/constants/                # 合约地址 + ABI
└── back_scripts/
    └── indexer.js             # 转账记录索引器 + HTTP 查询接口（纯 Node，零依赖）
```

## 快速开始

### 1. 合约

```bash
cd contract
forge build        # 编译
forge test         # 测试
```

### 2. 部署到 anvil

先启动本地节点：

```bash
anvil                       # 监听 127.0.0.1:8545，chainId 31337
```

再部署合约：

```bash
cd contract
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

> 部署脚本使用 anvil 默认账户（`0xf39F...92266`）。部署完成后会输出 `CalledToken` 与 `TokenBankV2` 地址，请把它们填入 `front/src/constants/addresses.ts`。

（可选）跑一次模拟交易，生成存/取款与普通转账记录：

```bash
TOKEN=0x<CalledToken> BANK=0x<TokenBankV2> \
forge script script/SimTransfer.s.sol:SimTransfer \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

### 3. 启动后端 indexer

```bash
cd back_scripts
node indexer.js        # 或：npm start
```

- 轮询 anvil（默认 `http://127.0.0.1:8545`）的 `Transfer` 事件
- 提供 `GET http://127.0.0.1:9000/api/transfers/:address`
- 支持环境变量：`RPC_URL`、`TOKEN_ADDRESS`、`PORT`、`POLL_INTERVAL`、`START_BLOCK`

### 4. 启动前端

```bash
cd front
npm install
npm run dev            # http://localhost:5173
```

前端通过 wagmi 注入浏览器钱包（MetaMask 需切换到 anvil `31337` 网络并导入测试私钥）。支持：

- 连接/断开钱包
- **一步存款**：调用 `CalledToken.transferWithCallback(bank, amount)`
- 取款：调用 `TokenBankV2.withdraw(amount)`
- 实时余额展示
- **转账记录**：每 5s 调用 `back_scripts/indexer.js` 拉取当前用户地址的相关转账记录并展示（含类型、数量、地址、交易哈希、区块）

## 核心机制：一步存款（tokenbank-v2）

传统 v1 需要两步：

```text
approve(bank, amount)  ->  deposit(amount)
```

tokenbank-v2 将其简化为一步——`CalledToken.transferWithCallback`：

```text
token.transferWithCallback(bank, amount)
  └─ 内部先执行 transfer(msg.sender, bank, amount)  // ERC20 转账
     └─ 若 bank 是合约，调用 bank.tokensReceived(msg.sender, amount)
        └─ TokenBankV2 在 tokensReceived 中自动记录存款
```

因此用户无需先 `approve`，一次调用即可完成存款。安全校验见合约内 `require`（仅允许代币合约调用回调等）。
## 网页转账成功展示
<img width="930" height="764" alt="withdraw" src="https://github.com/user-attachments/assets/6d121913-06f0-4024-9652-04d4a325bfbc" />


## 技术栈

- 合约：Solidity ^0.8.24，Foundry
- 前端：Next.js 风格修饰——实际使用 **Vite + React 19 + wagmi v3 + viem v2 + @tanstack/react-query**
- 后端：Node 20 原生 `http` + `fetch`，零第三方依赖
- 本地链：Anvil（Foundry）

## 已确认的合约地址（本地 anvil 部署一次）

> 每次重启 anvil 后地址不变（CREATE 确定性地址），除非重建链。

- CalledToken：`0x5FbDB2315678afecb367f032d93F642f64180aa3`
- TokenBankV2：`0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
