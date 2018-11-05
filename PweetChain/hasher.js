'use strict';

const nacl = require('tweetnacl');

exports.hash = (data) => {
    return Buffer.from(nacl.hash(data)).toString('hex');
};

/**
 * sign should be the signature in hex format
 * key is the public key in hex format
 */
exports.verify = (message, sign, key) => {
    return nacl.sign.detached.verify(Buffer.from(message, 'utf8'), Buffer.from(sign, 'hex'), Buffer.from(key, 'hex'));
};

/**
 * key is private key and should also be in hex format
 */
exports.sign = (message, key) => {
    return Buffer.from(nacl.sign.detached(Buffer.from(message, 'utf8'), Buffer.from(key, 'hex'))).toString('hex').toLowerCase();
};

/**
 * generates a keypair
 * the object is {publicKey: "hex", privateKey: "hex"}
 */
exports.keyPair = () => {
    const pair = nacl.sign.keyPair();
    return {
        public: Buffer.from(pair.publicKey).toString('hex').toLowerCase(),
        private: Buffer.from(pair.secretKey).toString('hex').toLowerCase()
    };
};