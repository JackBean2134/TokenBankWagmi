import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Droplets,
  History,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { BANK_ADDRESS, INDEXER_API, TOKEN_ADDRESS } from "./constants/addresses";
import { erc20Abi, tokenBankAbi } from "./constants/abis";
import "./App.css";

// ---------- Indexer 返回的转账记录类型 ----------
type TransferRecord = {
  blockNumber: string;
  txHash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  type?: string;
};

const shorten = (addr: string, n = 6) =>
  addr.length <= 20 ? addr : `${addr.slice(0, n)}...${addr.slice(-4)}`;

// ---------- 转账记录表格 ----------
function TransferHistory({ address }: { address: string }) {
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchRecords = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${INDEXER_API}/api/transfers/${address}`);
      const json = await res.json();
      if (json.code === 0) {
        const rows = (json.data || []).map((r: TransferRecord) => ({
          ...r,
          type:
            r.from.toLowerCase() === address.toLowerCase() ? "Withdraw" : "Deposit",
        }));
        setRecords(rows);
      } else {
        setError(json.msg || "查询失败");
      }
    } catch (e) {
      setError(
        `无法连接 indexer 服务（${INDEXER_API}），请确认 back_scripts/indexer.js 已启动。可通过 npm run indexer 启动。`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    const timer = setInterval(fetchRecords, 5000);
    return () => clearInterval(timer);
  }, [address]);

  const copyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash).then(() => {
      setCopied(hash);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="icon icon-blue">
            <History size={18} />
          </span>
          <h2>转账记录</h2>
          <p>由 back_scripts/indexer.js 从链上 Transfer 事件索引</p>
        </div>
        <button className="ghost" onClick={fetchRecords} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          {loading ? "刷新中" : "刷新"}
        </button>
      </div>

      {error && (
        <div className="notice error">
          <X size={14} />
          <span>{error}</span>
        </div>
      )}

      {!error && records.length === 0 && !loading && (
        <div className="empty">暂无转账记录，先在下方发起一笔存款吧</div>
      )}

      {records.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>类型</th>
                <th>数量</th>
                <th>从</th>
                <th>到</th>
                <th>TX HASH</th>
                <th>区块</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.txHash + i}>
                  <td>
                    <span
                      className={`badge ${
                        r.type === "Deposit" ? "badge-blue" : "badge-green"
                      }`}
                    >
                      {r.type === "Deposit" ? (
                        <ArrowDownToLine size={12} />
                      ) : (
                        <ArrowUpFromLine size={12} />
                      )}
                      {r.type}
                    </span>
                  </td>
                  <td className="mono">{formatEther(BigInt(r.value))} CTK</td>
                  <td className="mono dim">{shorten(r.from)}</td>
                  <td className="mono dim">{shorten(r.to)}</td>
                  <td>
                    <button className="hash" onClick={() => copyHash(r.txHash)}>
                      {copied === r.txHash ? "已复制" : shorten(r.txHash, 10)}
                      <Copy size={12} />
                    </button>
                  </td>
                  <td className="mono dim">#{r.blockNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- 连接钱包按钮 ----------
function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);

  if (isConnected && address) {
    return (
      <div className="wallet-box">
        <span className="dot dot-green" />
        <code>{shorten(address)}</code>
        <button className="ghost" onClick={() => disconnect()}>
          断开
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <button
        className="primary"
        onClick={() => {
          setError(null);
          const connector = connectors[0];
          if (!connector) {
            setError("未检测到浏览器钱包，请安装 MetaMask");
            return;
          }
          connect({ connector });
        }}
      >
        <Wallet size={16} />
        连接钱包
      </button>
      {error && <span className="err-text">{error}</span>}
    </div>
  );
}

// ---------- 主页面 ----------
export default function App() {
  const { address, isConnected } = useAccount();

  // 读:代币余额
  const { data: tokenBalance, refetch: refetchToken } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // 读:银行存款
  const { data: bankBalance, refetch: refetchBank } = useReadContract({
    address: BANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // 写:一步存款 (transferWithCallback)
  const deposit = useWriteContract();
  const depositReceipt = useWaitForTransactionReceipt({ hash: deposit.data });

  // 写:取款
  const withdraw = useWriteContract();
  const withdrawReceipt = useWaitForTransactionReceipt({ hash: withdraw.data });

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // 交易确认后刷新余额
  useEffect(() => {
    if (depositReceipt.isSuccess) {
      refetchToken();
      refetchBank();
      setNotice("存款成功 🎉");
    }
  }, [depositReceipt.isSuccess, refetchToken, refetchBank]);

  useEffect(() => {
    if (withdrawReceipt.isSuccess) {
      refetchToken();
      refetchBank();
      setNotice("取款成功 ✅");
    }
  }, [withdrawReceipt.isSuccess, refetchToken, refetchBank]);

  // 关键修复：仅当本次会话发起了交易，才判定为 pending，避免刷新后永久转圈
  const depositPending = deposit.isPending || (!!deposit.data && depositReceipt.isPending);
  const withdrawPending = withdraw.isPending || (!!withdraw.data && withdrawReceipt.isPending);

  const handleDeposit = () => {
    if (!address || !depositAmount || Number(depositAmount) <= 0) return;
    setNotice(null);
    deposit.writeContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transferWithCallback",
      args: [BANK_ADDRESS, parseEther(depositAmount)],
    });
  };

  const handleWithdraw = () => {
    if (!address || !withdrawAmount || Number(withdrawAmount) <= 0) return;
    setNotice(null);
    withdraw.writeContract({
      address: BANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: "withdraw",
      args: [parseEther(withdrawAmount)],
    });
  };

  return (
    <main className="page">
      <div className="bg-glow" aria-hidden />
      <div className="bg-glow-right" aria-hidden />

      <nav className="nav">
        <a href="#top" className="brand">
          <span className="brand-mark">
            <Droplets size={20} />
          </span>
          <span>
            Token<span className="accent">Bank</span>
          </span>
        </a>
        <ConnectButton />
      </nav>

      <section id="top" className="container">
        <header className="hero">
          <div>
            <p className="eyebrow">
              <ShieldCheck size={14} />
              CalledToken · tokenbank-v2 模式
            </p>
            <h1>一步存款，即存即得</h1>
            <p className="hero-sub">
              代币通过 transferWithCallback 回调自动存入银行合约，无需 approve。
            </p>
          </div>
          <div className="chain-pill">
            <span className="dot dot-green" />
            Anvil Local (31337)
          </div>
        </header>

        {notice && (
          <div className="notice success">
            <span>{notice}</span>
            <button className="close" onClick={() => setNotice(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        <section className="cards">
          <article className="card">
            <div className="card-title">
              <span className="icon icon-violet">
                <ArrowDownToLine size={20} />
              </span>
              <h2>存入代币</h2>
              <p>transferWithCallback 一步入金</p>
            </div>
            {!isConnected ? (
              <div className="empty">请先连接钱包</div>
            ) : (
              <div className="form">
                <label>存款数量</label>
                <div className="input-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                  <button
                    className="max-btn"
                    onClick={() =>
                      setDepositAmount(
                        tokenBalance ? formatEther(BigInt(tokenBalance)) : ""
                      )
                    }
                  >
                    MAX
                  </button>
                </div>
                <button
                  className="primary block"
                  onClick={handleDeposit}
                  disabled={depositPending || !depositAmount}
                >
                  {depositPending ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      存款中…
                    </>
                  ) : (
                    "存入 CalledToken 到银行"
                  )}
                </button>
                {deposit.error && (
                  <p className="err-text">{(deposit.error as Error).message}</p>
                )}
              </div>
            )}
          </article>

          <article className="card">
            <div className="card-title">
              <span className="icon icon-green">
                <ArrowUpFromLine size={20} />
              </span>
              <h2>提取代币</h2>
              <p>从银行取回你的资产</p>
            </div>
            {!isConnected ? (
              <div className="empty">请先连接钱包</div>
            ) : (
              <div className="form">
                <label>取款数量</label>
                <div className="input-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                  <button
                    className="max-btn"
                    onClick={() =>
                      setWithdrawAmount(
                        bankBalance ? formatEther(BigInt(bankBalance)) : ""
                      )
                    }
                  >
                    MAX
                  </button>
                </div>
                <button
                  className="primary block green"
                  onClick={handleWithdraw}
                  disabled={withdrawPending || !withdrawAmount}
                >
                  {withdrawPending ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      取款中…
                    </>
                  ) : (
                    "提取代币"
                  )}
                </button>
                {withdraw.error && (
                  <p className="err-text">{(withdraw.error as Error).message}</p>
                )}
              </div>
            )}
          </article>

          <article className="card stats">
            <div className="card-title">
              <span className="icon icon-amber">
                <Landmark size={20} />
              </span>
              <h2>我的资产</h2>
              <p>实时余额</p>
            </div>
            {!isConnected ? (
              <div className="empty">连接钱包后查看</div>
            ) : (
              <div className="stats-grid">
                <div className="stat">
                  <span className="stat-label">钱包余额</span>
                  <span className="stat-value">
                    {tokenBalance ? formatEther(BigInt(tokenBalance)) : "0.0"}{" "}
                    <small>CTK</small>
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">银行存款</span>
                  <span className="stat-value">
                    {bankBalance ? formatEther(BigInt(bankBalance)) : "0.0"}{" "}
                    <small>CTK</small>
                  </span>
                </div>
                <div className="stat address-box">
                  <span className="stat-label">当前地址</span>
                  <code>{address}</code>
                </div>
              </div>
            )}
          </article>
        </section>

        <TransferHistory address={address || ""} />

        <footer className="footer">
          <span>TokenBank · CalledToken one-step deposit demo</span>
          <a href="#top" className="ghost-link">
            回到顶部
          </a>
        </footer>
      </section>
    </main>
  );
}
