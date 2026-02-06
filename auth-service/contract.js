const { ethers } = require('ethers');

const ABI = [
  'function registerDevice(bytes32 _idHash, uint256 _pubKeyHash)',
  'function updateStatus(bytes32 _idHash, uint8 _status)',
  'function logAuth(bytes32 _idHash, bool _success, string _reason)'
];

const STATUS = {
  REGISTERED: 0,
  ACTIVE: 1,
  REVOKED: 2
};

const getContract = ({ providerUrl, contractAddress }) => {
  if (!providerUrl || !contractAddress) return null;
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) return null;
  const provider = new ethers.JsonRpcProvider(providerUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, ABI, signer);

  return {
    registerDevice: async (deviceId, commitment) => {
      const idHash = ethers.id(deviceId);
      return contract.registerDevice(idHash, BigInt(commitment));
    },
    updateStatus: async (deviceId, status) => {
      const idHash = ethers.id(deviceId);
      const statusValue = STATUS[status] ?? STATUS.ACTIVE;
      return contract.updateStatus(idHash, statusValue);
    },
    logAuth: async (deviceId, success, reason) => {
      const idHash = ethers.id(deviceId);
      return contract.logAuth(idHash, success, reason);
    }
  };
};

module.exports = { getContract };
