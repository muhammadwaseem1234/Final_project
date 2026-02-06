const { spawn } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const contractsDir = path.join(repoRoot, "contracts");
const webUiDir = path.join(repoRoot, "web-ui");

const HARDHAT_RPC = "http://127.0.0.1:8545";
const DEFAULT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const processes = [];

const spawnProc = (command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  processes.push(child);
  return child;
};

const waitForJsonRpc = async (url, retries = 40) => {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Hardhat node did not start");
};

const deployContract = () =>
  new Promise((resolve, reject) => {
    const deploy = spawnProc(
      "npx",
      ["hardhat", "run", "scripts/deploy.js", "--network", "localhost"],
      { cwd: contractsDir }
    );
    let output = "";
    deploy.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });
    deploy.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });
    deploy.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(output || "Deploy failed"));
        return;
      }
      const address = output.trim().split("\n").pop().trim();
      resolve(address);
    });
  });

const shutdown = () => {
  processes.forEach((proc) => {
    if (!proc.killed) {
      proc.kill();
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const main = async () => {
  spawnProc("npx", ["hardhat", "node"], { cwd: contractsDir });
  await waitForJsonRpc(HARDHAT_RPC);

  spawnProc("npx", ["hardhat", "compile"], { cwd: contractsDir });
  const contractAddress = await deployContract();

  const env = {
    ...process.env,
    PRIVATE_KEY: process.env.PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
    CONTRACT_ADDRESS: contractAddress,
    PROVIDER_URL: HARDHAT_RPC,
  };

  spawnProc("node", ["auth-service/index.js"], { cwd: repoRoot, env });
  spawnProc(process.env.PYTHON || "python", ["behavior-service/main.py"], {
    cwd: repoRoot,
  });
  spawnProc("node", ["gateway/index.js"], { cwd: repoRoot });
  spawnProc("npm", ["run", "dev"], { cwd: webUiDir });
};

main().catch((error) => {
  console.error(error.message);
  shutdown();
  process.exit(1);
});
