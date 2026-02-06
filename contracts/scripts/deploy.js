import fs from "fs";
import path from "path";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const RPC_URL = "http://127.0.0.1:8545";
const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const main = async () => {
  const artifactPath = path.resolve(
    "artifacts",
    "contracts",
    "DeviceRegistry.sol",
    "DeviceRegistry.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PRIVATE_KEY, provider);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(address);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
