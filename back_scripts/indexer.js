/**
 * TokenBank 转账记录 Indexer
 * ------------------------------------------------------------------
 * 纯 Node.js 实现（零第三方依赖），轮询本地 anvil 节点的 ERC20 Transfer 事件，
 * 建立「地址 -> 转账记录」索引，并通过 HTTP 接口提供给前端查询。
 *
 * 启动：
 *   node back_scripts/indexer.js
 *
 * 环境变量（均有默认值，可直接跑）：
 *   RPC_URL       默认 http://127.0.0.1:8545
 *   TOKEN_ADDRESS 默认 0x5FbDB2315678afecb367f032d93F642f64180aa3 (CalledToken)
 *   PORT          默认 9000
 *   POLL_INTERVAL 轮询间隔(ms)，默认 2000
 *   START_BLOCK   起始区块，默认 0
 *
 * 接口：
 *   GET /api/transfers/:address   查询该地址相关的转账记录
 *   GET /api/health              健康检查
 */

const http = require("http");

// ---------------- 配置 ----------------
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const TOKEN_ADDRESS = (
  process.env.TOKEN_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3"
).toLowerCase();
const PORT = Number(process.env.PORT || 9000);
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 2000);
const START_BLOCK = Number(process.env.START_BLOCK || 0);

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ---------------- 内存索引 ----------------
// txHash -> record
const records = new Map();
// address -> Set<txHash>
const byAddress = new Map();

let lastIndexedBlock = START_BLOCK - 1;

function addToAddressIndex(addr, hash) {
  const key = addr.toLowerCase();
  if (!byAddress.has(key)) byAddress.set(key, new Set());
  byAddress.get(key).add(hash);
}

/** 把 32 字节 topic 转成 20 字节地址 */
function topicToAddress(topic) {
  return "0x" + topic.slice(26).toLowerCase();
}

/** 16 进制数量转十进制字符串 */
function hexToDecimal(hex) {
  return BigInt(hex).toString();
}

// ---------------- JSON-RPC ----------------
let rpcId = 1;
async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

// ---------------- 索引主循环 ----------------
async function indexOnce() {
  const latestHex = await rpc("eth_blockNumber", []);
  const latest = Number(BigInt(latestHex));

  if (latest <= lastIndexedBlock) return;

  const fromBlock = lastIndexedBlock + 1;
  const logs = await rpc("eth_getLogs", [
    {
      address: TOKEN_ADDRESS,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + latest.toString(16),
      topics: [TRANSFER_TOPIC],
    },
  ]);

  if (!Array.isArray(logs) || logs.length === 0) {
    lastIndexedBlock = latest;
    return;
  }

  // 缓存区块时间戳
  const blockTimestamps = new Map();

  for (const log of logs) {
    const hash = log.transactionHash;
    if (!hash || records.has(hash)) continue;

    const from = topicToAddress(log.topics[1]);
    const to = topicToAddress(log.topics[2]);
    const value = hexToDecimal(log.data);

    const blockNumber = Number(BigInt(log.blockNumber));

    if (!blockTimestamps.has(log.blockNumber)) {
      const block = await rpc("eth_getBlockByNumber", [
        log.blockNumber,
        false,
      ]);
      blockTimestamps.set(log.blockNumber, block ? block.timestamp : "0x0");
    }
    const timestamp = hexToDecimal(blockTimestamps.get(log.blockNumber));

    records.set(hash, {
      blockNumber: String(blockNumber),
      txHash: hash,
      from,
      to,
      value,
      timestamp,
    });

    addToAddressIndex(from, hash);
    addToAddressIndex(to, hash);
  }

  lastIndexedBlock = latest;
  console.log(
    `[indexer] blocks ${fromBlock}..${latest}, +${logs.length} logs, total ${records.size}`
  );
}

async function loop() {
  try {
    await indexOnce();
  } catch (err) {
    console.error("[indexer] error:", err.message);
  } finally {
    setTimeout(loop, POLL_INTERVAL);
  }
}

// ---------------- HTTP 服务 ----------------
function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function queryByAddress(address) {
  const hashes = byAddress.get(address.toLowerCase());
  if (!hashes) return [];
  return [...hashes]
    .map((h) => records.get(h))
    .filter(Boolean)
    .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS 预检
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  // 健康检查
  if (url.pathname === "/api/health") {
    return sendJSON(res, 200, {
      code: 0,
      data: {
        rpc: RPC_URL,
        token: TOKEN_ADDRESS,
        lastIndexedBlock,
        totalRecords: records.size,
      },
    });
  }

  // 查询转账记录
  const m = url.pathname.match(/^\/api\/transfers\/(0x[a-fA-F0-9]{40})$/);
  if (m) {
    const address = m[1];
    const data = queryByAddress(address);
    return sendJSON(res, 200, { code: 0, data });
  }

  sendJSON(res, 404, { code: 404, msg: "Not Found" });
});

server.listen(PORT, () => {
  console.log("========================================");
  console.log("  TokenBank Indexer 已启动");
  console.log(`  RPC   : ${RPC_URL}`);
  console.log(`  Token : ${TOKEN_ADDRESS}`);
  console.log(`  API   : http://127.0.0.1:${PORT}/api/transfers/:address`);
  console.log("========================================");
  loop();
});
