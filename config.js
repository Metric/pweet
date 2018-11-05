'use strict';
const fs = require('fs');
const path = require('path');

exports.address = 'http://localhost:8000/'; //your main server address that points to this node
exports.port = 8000;
exports.local = 'localhost';

//for known peers see github.com/Metric/pweet/peers.json
exports.getPeers = () => {
    const fpath = path.join(__dirname, 'peers.json');
    if(fs.existsSync(fpath)) {
        return JSON.parse(fs.readFileSync(fpath).toString('utf8'));
    }

    return [];
};

exports.savePeers = (peers) => {
    const fpath = path.join(__dirname, 'peers.json');
    fs.writeFileSync(fpath, JSON.stringify(peers));
};