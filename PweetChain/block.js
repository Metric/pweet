'use strict';

const Hasher = require('./hasher');
const Message = require('./message');

const MAX_BLOCK_SIZE = 2 * 1024 * 1024; 
//2mb block size; roughly 2K messages per block 
// at each message average of 1KB or less

class Block {
    constructor(prev) {
        prev = prev || {};
        prev.id = prev.id || 0;

        //we use one decimal place
        this.pid = prev.id;
        this.previous = prev.hash || null;
        this.id = prev.id + 0.1;
        this.messages = [];
        this.seenMessages = {};
        this.hash = null;
    }

    add(message) {
        if(this.seenMessages[message.id]) {
            return false;
        }

        const valid = message.isValid();

        if(!valid) {
            return false;
        }

        message.parseTags();

        this.messages.push(message);
        this.seenMessages[message.id] = true;

        return true;
    }

    get currentHash() {
        const keys = Object.keys(this.seenMessages);
        return Hasher.hash(keys.join(',') + this.previous + this.pid + this.id);
    }

    get isFull() {
        return this.messages.reduce((a,b) => a.size + b.size, 0) >= MAX_BLOCK_SIZE;
    }

    isCurrentValid() {
        if(this.hash !== this.currentHash) return false;
        if(!this.isFull) return false;
        return this.containsValidMessages();
    }

    isValid(prev) {
        if(this.previous !== prev.hash) return false;
        if(this.id !== prev.id + 0.1) return false;
        if(this.pid !== prev.id) return false;
        if(this.hash !== this.currentHash) return false;
        if(!this.isFull) return false;
        return this.containsValidMessages();
    }

    containsValidMessages() {
        for(let i = 0; i < this.messages.length; i++) {
            const msg = this.messages[i];

            const v = msg.isValid();

            if(!v) {
                return false;
            }
        }

        return true;
    }

    toObject() {
        return {
            previous: this.previous,
            id: this.id,
            pid: this.pid,
            messages: this.messages,
            hash: this.hash
        };
    }

    static fromJson(obj) {
        const block = new Block({hash: obj.previous, id: obj.pid});
        block.previous = obj.previous;
        block.pid = obj.pid;
        block.id = obj.id;
        block.hash = obj.hash;
        
        for(let i = 0; i < obj.messages.length; i++) {
            const msg = new Message(obj.messages[i]);
            block.messages.push(msg);
            block.seenMessages[msg.id] = true;
        }

        return block;
    }
}

module.exports = exports = Block;