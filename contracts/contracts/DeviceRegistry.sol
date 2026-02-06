// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DeviceRegistry {
    enum Status { REGISTERED, ACTIVE, REVOKED }

    struct Device {
        bytes32 idHash;
        uint256 pubKeyHash; // Simplified for ZK commitment or public key hash
        Status status;
        uint256 registeredAt;
        uint256 lastSeen;
        uint256 reputation;
    }

    mapping(bytes32 => Device) public devices;
    
    event DeviceRegistered(bytes32 indexed idHash, uint256 pubKeyHash);
    event DeviceStatusUpdated(bytes32 indexed idHash, Status status);
    event AuthAttempt(bytes32 indexed idHash, bool success, string reason);

    modifier onlyActive(bytes32 _idHash) {
        require(devices[_idHash].status == Status.ACTIVE, "Device not active");
        _;
    }

    function registerDevice(bytes32 _idHash, uint256 _pubKeyHash) external {
        require(devices[_idHash].registeredAt == 0, "Device already registered");
        
        devices[_idHash] = Device({
            idHash: _idHash,
            pubKeyHash: _pubKeyHash,
            status: Status.ACTIVE,
            registeredAt: block.timestamp,
            lastSeen: block.timestamp,
            reputation: 100
        });

        emit DeviceRegistered(_idHash, _pubKeyHash);
    }

    function updateStatus(bytes32 _idHash, Status _status) external {
        // In a real system, this would be restricted to onlyOwner or a Governance contract
        require(devices[_idHash].registeredAt != 0, "Device not found");
        devices[_idHash].status = _status;
        emit DeviceStatusUpdated(_idHash, _status);
    }

    function logAuth(bytes32 _idHash, bool _success, string calldata _reason) external {
        // Called by Auth Oracle / Service
        // Verify this call comes from a trusted relayer in prod
        if(_success) {
            devices[_idHash].lastSeen = block.timestamp;
            if(devices[_idHash].reputation < 100) {
                devices[_idHash].reputation++;
            }
        } else {
             if(devices[_idHash].reputation > 0) {
                devices[_idHash].reputation--;
            }
        }
        emit AuthAttempt(_idHash, _success, _reason);
    }
    
    function getDevice(bytes32 _idHash) external view returns (Device memory) {
        return devices[_idHash];
    }
}
