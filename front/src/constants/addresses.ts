// 合约地址（部署到本地 anvil 后填写）
// 参考:forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
export const TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
export const BANK_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const;

// 本地 anvil RPC
export const ANVIL_RPC = "http://127.0.0.1:8545" as const;
export const ANVIL_CHAIN_ID = 31337;

// 后端 indexer 查询接口
export const INDEXER_API = "http://127.0.0.1:9000" as const;
