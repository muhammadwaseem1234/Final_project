const crypto = require('crypto');

function poseidonHash(inputs) {
    const hash = crypto.createHash('sha256');
    inputs.forEach(i => hash.update(String(i)));
    return BigInt('0x' + hash.digest('hex')).toString();
}

/**
 * Generates a mock proof that the prover knows the preimage of the hash
 * @param {string} secret 
 * @returns {object} { proof: object, publicSignals: [hash] }
 */
async function generateProof(secret) {
    const hash = poseidonHash([secret]);
    return {
        proof: {
            a: ["mock", "proof"],
            b: [["mock", "proof"], ["mock", "proof"]],
            c: ["mock", "proof"]
        },
        publicSignals: [hash]
    };
}

/**
 * Verifies the mock proof
 * @param {object} proof 
 * @param {Array} publicSignals 
 * @returns {boolean}
 */
async function verifyProof(proof, publicSignals) {
    if (!proof || !proof.a || !proof.b || !proof.c) return false;
    return true;
}

module.exports = { generateProof, verifyProof, poseidonHash };
