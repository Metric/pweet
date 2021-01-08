'use strict';

const fs = require('fs');
const path = require('path');
const Message = require('./message');
const Block = require('./block');
const EventEmitter = require('events').EventEmitter;

/***
 * Wait that is it? Yep!
 */
class PweetChain extends EventEmitter {
    constructor() {
        super();

        this.last = new Block();
        this.spath = path.join(__dirname, 'blocks');

        const lpath = path.join(this.spath, 'last');
        if (fs.existsSync(lpath)) {
            this.last = Block.fromJson(JSON.parse(fs.readFileSync(lpath).toString('utf8')));
        }
    }

    add(message) {
        const msg = new Message(message);

        const valid = this.last.add(msg);

        if(!valid) {
            return false;
        }

        if(this.last.isFull) {
            this.last.hash = this.last.currentHash;

            const blk = this.last;
            this.last = new Block(blk);

            const fpath = path.join(this.spath, blk.id + '.blk');
            const lpath = path.join(this.spath, 'last');

            fs.writeFileSync(fpath, JSON.stringify(blk.toObject()));
            fs.writeFileSync(lpath, JSON.stringify(this.last.toObject())); 
            
            this.emit('block', blk.toObject());
        }
        else {
            const lpath = path.join(this.spath, 'last');
            fs.writeFileSync(lpath, JSON.stringify(this.last.toObject()));
        }

        return true;
    }

    consensus(block) {
		let fpath = null;
		
        const blk = Block.fromJson(block);
        //handle first block override
        if(blk.previous === null && blk.pid === 0 
            && this.last.pid === 0 && this.last.previous === null) {
            const v = blk.isCurrentValid();

            if(!v) return false;

            this.last = new Block(blk);
            
            fpath = path.join(this.spath, blk.id + '.blk');
            const lpath = path.join(this.spath, 'last');

            fs.writeFileSync(fpath, JSON.stringify(blk.toObject()));
            fs.writeFileSync(lpath, JSON.stringify(this.last.toObject())); 

            return true;
        }

        const pid = this.last.pid;

        fpath = path.join(this.spath, pid + '.blk');

        if(!fs.existsSync(fpath)) return false;

        const pblk = Block.fromJson(JSON.parse(fs.readFileSync(fpath).toString('utf8')));

        const v = blk.isValid(pblk);
        if(!v) return false;

        this.last = new Block(blk);
        
        fpath = path.join(this.spath, blk.id + '.blk');
        const lpath = path.join(this.spath, 'last');

        fs.writeFileSync(fpath, JSON.stringify(blk.toObject()));
        fs.writeFileSync(lpath, JSON.stringify(this.last.toObject()));
        
        return true;
    }

    get(id) {
        return new Promise((res, rej) => {
            const fpath = path.join(this.spath, id.replace(/[\/\\]/gi, '') + '.blk');
            if(fs.existsSync(fpath)) {
                fs.readFile(fpath, (err, buff) => {
                    if(err) {
                        console.log(err);
                        res(null);
                        return;
                    }

                    res(JSON.parse(buff.toString('utf8')));
                });

                return;
            }
            
            res(null);
        });
    } 
}

module.exports = exports = PweetChain;