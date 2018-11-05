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

const SendBlockToPeers = async (block) => {
    for(let i = 0; i < peers.length; i++) {
        try {
            if(peers[i] === config.address) {
                continue;
            }

            await request.post(url.resolve(peers[i], 'block'), block);
        }
        catch (e) {
            console.log(e);
        }
    }
};

const SendMessageToPeers = async (msg) => {
    for(let i = 0; i < peers.length; i++) {
        try {
            if(peers[i] === config.address) {
                continue;
            }

            await request.post(url.resolve(peers[i], 'message'), msg);
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
            id = parseFloat(id);

            if(id > max && !Number.isNaN(id)) {
                max = id;
                longestChain = peer;
            }
        }
        catch (e) {
            console.log(e);
        }
    }

    try {
        if(longestChain !== null) {
            let blk = await request.get(url.resolve(longestChain, 'block/' + chain.last.id));
            let v = chain.consensus(blk);

            if(!v) {
                return;
            }

            for(let i = chain.last.id; i < max; i += 0.1) {
                try {
                    blk = await request.get(url.resolve(longestChain, 'block/' + i));
                    v = chain.consensus(blk);
                    if(!v) break;
                }
                catch (e) {
                    console.log(e);
                    break;
                }
            }
        }
    }
    catch (e) {
        console.log(e);
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
        if(res.sent) {
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
        knownPeers[p] = true;
        peers.push(p);
        config.savePeers(peers);
    }

    res.status(200).send('OK').end();
});

app.get('/last/id', (req, res) => {
    res.status(200).send(chain.last.id).end();
});

app.get('/last', (req, res) => {
    res.status(200).json(chain.last.toObject());
});

app.get('/search/replies/:id([A-Za-z0-9\-]{1,})/page/:page([0-9]{1,}', (req, res) => {
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

const Load = async () => {
    //setup our known peers
    peers.forEach(p => {
        knownPeers[p] = true;
    });

    await Sync();

    app.listen(config.port, config.local, async () => {
        console.log('pweet node listening on: ' + config.local + ':' + config.port);

        //for each peer alert them to us
        for(let i = 0; i < peers.length; i++) {
            const peer = peers[i];

            if(peer === config.address) {
                continue;
            }

            try {
                await request.post(path.join(peer, 'peer'), { address: config.address });
            }
            catch (e) {
                console.log(e);
            }
        }
    });
};

Load();