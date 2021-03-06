'use strict';

const Express = require('express');
const path = require('path');
const app = Express();
const bodyparser = require('body-parser');
const request = require('./request');
const config = require('./config');
const {Chain, Block} = require('./PweetChain');
const peers = config.getPeers();
const knownPeers = {};
const chain = new Chain();
const url = require('url');
const async = require('async');

const PER_PAGE = 20;
const PEER_IS_ALIVE_TIME = 1000 * 60 * 20;
const PEER_NOTIF_INTERNVAL = 1000 * 60 * 10;

const SendBlockToPeers = async (block) => {
    for(let i = 0; i < peers.length; i++) {
        try {
            const k = peers[i];

            if(k === config.address) {
                continue;
            }

            const ts = knownPeers[k];
            if ((Date.now() - ts) <= PEER_IS_ALIVE_TIME) {
                await request.post(url.resolve(k, 'block'), block);
                knownPeers[k] = Date.now();
            }
        }
        catch (e) {
            console.log(e);
        }
    }
};

const SendMessageToPeers = async (msg) => {
    for(let i = 0; i < peers.length; i++) {
        try {
            const k = peers[i];

            if(k === config.address) {
                continue;
            }

            const ts = knownPeers[k];
            if ((Date.now() - ts) <= PEER_IS_ALIVE_TIME) {
                await request.post(url.resolve(k, 'message'), msg);
                knownPeers[k] = Date.now();
            }
        }
        catch (e) {
            console.log(e);
        }
    }
}

const Sync = async () => {
    //we consider the longest chain to be the most accurate
    //and the correct chain to base off of
    //if we are the longest chain - do nothing
    let longestChain = null;
    let max = chain.last.id;
    for(let i = 0; i < peers.length; i++) {
        const peer = peers[i];

        if(peer === config.address) {
            continue;
        }

        try {
            let id = await request.get(url.resolve(peer, 'last/id'));
            id = Number(id);

            if(id > max && !Number.isNaN(id) && Number.isFinite(id)) {
                max = id;
                longestChain = peer;
            }
        }
        catch (e) {
            console.log(e);
        }
    }

    if(longestChain !== null) {
        let blk = null;
        let v = null;
        let failedConsensus = false;
        let findPrevious = false;

        try {
            blk = await request.get(url.resolve(longestChain, 'block/' + chain.last.id));
            v = chain.consensus(blk);

            if(!v) {
                console.log('last block consensus failed. trying to find previous block with consensus.');
                findPrevious = true;
            }
        }
        catch (e) {
            console.log(e);
        }

        if (findPrevious) {
            let foundConsensus = false;
            for(let i = chain.last.id - 0.1; i > 0; i -= 0.1) {
                try {
                    blk = await request.get(url.resolve(longestChain, 'block/' + i));
                    v = chain.consensus(blk);
                    if (v) {
                        console.log('consensus found at block: ' + i);
                        foundConsensus = true;
                        break;
                    }
                }
                catch (e) {
                    console.log(e);
                }
            }

            if (!foundConsensus) {
                console.log('consensus could not be found. resetting to origin.');
                chain.resetToOrigin();
            }
        }

        for(let i = chain.last.id; i < max; i += 0.1) {
            try {
                blk = await request.get(url.resolve(longestChain, 'block/' + i));
                v = chain.consensus(blk);
                if(!v) {
                    failedConsensus = true;
                    break;
                }
            }
            catch (e) {
                failedConsensus = true;
                console.log(e);
                break;
            }
        }

        if (failedConsensus) {
            console.log('consensus failed with longest chain.');
            
            if (config.syncOnly) {
                setTimeout(() => {
                    Sync();
                }, config.syncInterval || 5000);
            }

            return;
        }

        try {
            blk = await request.get(url.resolve(longestChain, 'last'))
            v = chain.copyLast(blk);
            if (!v) {
                console.log('failed to copy latest block info from longest chain');
            }
        }
        catch (e) {
            console.log(e);
        }
    }

    if (config.syncOnly) {
        setTimeout(() => {
            Sync();
        }, config.syncInterval || 5000);
    }
};

chain.on('block', async (block) => {
    await SendBlockToPeers(block);
});

app.use(function (req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Allow-Methods', '*');
    return next();
});

app.options('*', function (req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Allow-Methods', '*');
    res.set('Content-Type', req.headers['Content-Type']);
    return next();
});

app.use(bodyparser.json({type: '*/*'}));

app.post('/block', async (req, res) => {
    try {
        const okay = chain.consensus(req.body);

        if(!okay) {
            res.status(200).send('BAD').end();
            res.sent = true;
            return;
        }

        res.status(200).send('OK').end();
        res.sent = true;

        await SendBlockToPeers(req.body);
    }
    catch (e) {
        console.log(e);
        if(!res.sent) {
            res.status(500).end();
        }
    }
});

app.post('/message', async (req, res) => {
    try {
        const valid = chain.add(req.body);

        if(!valid) {
            res.status(200).send('BAD').end();
            res.sent = true;
            return;
        }

        res.status(200).send('OK').end();
        res.sent = true;

        await SendMessageToPeers(req.body);
    }
    catch (e) {
        console.log(e);
        if(!res.sent) {
            res.status(500).end();
        }
    }
});

app.get('/block/:id([0-9.]{1,})', (req, res) => {
    try {
        const block = chain.get(req.params.id);

        if(!block) {
            res.status(404).end();
            return;
        }

        res.status(200).json(block);
    }
    catch (e) {
        console.log(e);
        res.status(500).end();
    }
});

app.post('/peer', async (req, res) => {
    const p = req.body.address;

    if (!knownPeers[p] && p && p.length > 0) {
        knownPeers[p] = Date.now();
        peers.push(p);
        config.savePeers(peers);
    }
    else if(knownPeers[p] && p && p.length > 0) {
        knownPeers[p] = Date.now();
    }

    res.status(200).send('OK').end();
});

app.get('/last/id', (req, res) => {
    res.status(200).send(chain.last.id).end();
});

app.get('/last', (req, res) => {
    res.status(200).json(chain.last.toObject());
});

app.get('/search/replies/:id([A-Za-z0-9\-]{1,})/page/:page([0-9]{1,})', (req, res) => {
    let block = chain.last;

    let page = parseInt(req.params.page) || 1;
    page = page <= 0 ? 1 : page;

    let index = 0;
    let start = (page - 1) * PER_PAGE;

    const messages = [];
    const id = req.params.id;

    if(!id || id.length === 0) {
        res.status(200).json(messages);
        return;
    }

    async.whilst(() => block !== null && messages.length < PER_PAGE,
        (cb) => {
            async.eachSeries(block.messages, (m, cb2) => {
                if(index >= start) {
                    if (m.replyTo === id) {
                        messages.push(m);
                    }
                }
                index++;
                cb2();
            },
            async (err) => {
                if(err) {
                    console.log(err);
                }

                if(block.previous !== null) {
                    try {
                        block = await chain.get(block.pid);
                    }
                    catch (e) {
                        console.log(e);
                        block = null;
                    }
                }
                else {
                    block = null;
                }
                cb();
            });
        },
        (err) => {
            if(err) {
                console.log(err);
            }
            res.status(200).json(messages);
        }
    );
});

app.get('/search/address/:address([A-Za-z0-9]{1,})/page/:page([0-9]{1,})', (req, res) => {
    let block = chain.last;
    let page = parseInt(req.params.page) || 1;
    page = page <= 0 ? 1 : page;

    let index = 0;
    let start = (page - 1) * PER_PAGE;

    const messages = [];
    const address = req.params.address;

    if(!address || address.length === 0) {
        res.status(200).json(messages);
        return;
    }

    async.whilst(() => block !== null && messages.length < PER_PAGE,
        (cb) => {
            async.eachSeries(block.messages, (m, cb2) => {
                if(index >= start) {
                    if (m.mentions.indexOf('@' + address) > -1 || m.address === address) {
                        messages.push(m);
                    }
                }
                index++;
                cb2();
            },
            async (err) => {
                if(err) {
                    console.log(err);
                }

                if(block.previous !== null) {
                    try {
                        block = await chain.get(block.pid);
                    }
                    catch (e) {
                        console.log(e);
                        block = null;
                    }
                }
                else {
                    block = null;
                }
                cb();
            });
        },
        (err) => {
            if(err) {
                console.log(err);
            }
            res.status(200).json(messages);
        }
    );
});

app.get('/message/:id([A-Za-z0-9\-]{1,})', (req, res) => {
    let block = chain.last;
    const id = req.params.id;
    let message = {};

    if(!id || id.length === 0) {
        res.status(200).json(message);
        return;
    }

    async.whilst(() => block !== null,
        (cb) => {
            async.eachSeries(block.messages, (m, cb2) => {
                if (m.id === id) {
                    message = m;
                    cb2('found');
                    return;
                }
                cb2();
            },
            async (err) => {
                if(err && err !== 'found') {
                    console.log(err);
                }

                if (err === 'found') {
                    block = null;
                    cb();
                    return;
                }

                if(block.previous !== null) {
                    try {
                        block = await chain.get(block.pid);
                    }
                    catch (e) {
                        console.log(e);
                        block = null;
                    }
                }
                else {
                    block = null;
                }
                cb();
            });
        },
        (err) => {
            if(err) {
                console.log(err);
            }
            res.status(200).json(message);
        }
    );
});

app.get('/search/tag/:tag([A-Za-z0-9_-]{1,})/page/:page([0-9]{1,})', (req, res) => {
    let block = chain.last;

    let page = parseInt(req.params.page) || 1;
    page = page <= 0 ? 1 : page;

    let index = 0;
    let start = (page - 1) * PER_PAGE;

    const messages = [];
    const tag = req.params.tag;

    if(!tag || tag.length === 0) {
        res.status(200).json(messages);
        return;
    }

    async.whilst(() => block !== null && messages.length < PER_PAGE,
        (cb) => {
            async.eachSeries(block.messages, (m, cb2) => {
                if(index >= start) {
                    if (m.tags.indexOf('#' + tag) > -1) {
                        messages.push(m);
                    }
                }
                index++;
                cb2();
            },
            async (err) => {
                if(err) {
                    console.log(err);
                }

                if(block.previous !== null) {
                    try {
                        block = await chain.get(block.pid);
                    }
                    catch (e) {
                        console.log(e);
                        block = null;
                    }
                }
                else {
                    block = null;
                }
                cb();
            });
        },
        (err) => {
            if(err) {
                console.log(err);
            }
            res.status(200).json(messages);
        }
    );
});

let peerInterval = null;

const SendPeerInfo = async () => {
    if (config.syncOnly) {
        return;
    }

    //for each peer alert them to us
    for(let i = 0; i < peers.length; i++) {
        const peer = peers[i];

        if(peer === config.address) {
            continue;
        }

        try {
            await request.post(url.resolve(peer, 'peer'), { address: config.address });
            knownPeers[peer] = Date.now();
        }
        catch (e) {
            console.log(e);
        }
    }
}

const Load = async () => {
    //setup our known peers
    peers.forEach(p => {
        knownPeers[p] = 0; //default to 0 timestamp
    });

    //initial sync
    //we do not alert the peers of 
    //our presence yet
    await Sync();

    app.listen(config.port, config.local, async () => {
        console.log('pweet node listening on: ' + config.local + ':' + config.port);
        if (!config.syncOnly) {
            peerInterval = setInterval(SendPeerInfo, PEER_NOTIF_INTERNVAL);

            //send initial peer info if needed
            await SendPeerInfo();
        }
    });
};

Load();