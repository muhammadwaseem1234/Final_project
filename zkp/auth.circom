pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template Auth() {
    signal input secret;
    signal input commitment;

    component poseidon = Poseidon(1);
    poseidon.inputs[0] <== secret;

    commitment === poseidon.out;
}

component main {public [commitment]} = Auth();
