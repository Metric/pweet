'use strict';

const UUID = require('uuid/v4');
const Hasher = require('./hasher');
const striptags = require('striptags');
const {Cuckoo} = require('cuckoo-cycle');
const Utils = require('./utils');

const INITIAL_EPOCH = new Date(2018,7,9).getTime();

const DIFF = (50 * Cuckoo.SIZE / 100);

class Message {
    constructor(json) {
        json = json || {};
        this.id = json.id ? striptags(json.id).replace(/[\/\\]/gi, '') : UUID();
        this.image = json.image ? striptags(json.image) : '';
        this.name = json.name ? striptags(json.name) : '';
        this.address = json.address ? striptags(json.address) : '';
        this.message = json.message ? striptags(json.message) : '';
        this.date = json.date ? parseFloat(json.date) : Date.now();
        this.replyTo = json.replyTo ? striptags(json.replyTo) : '';

        this.signature = json.signature ? striptags(json.signature) : '';

        this.tags = json.tags && Array.isArray(json.tags) ? json.tags : [];
        this.mentions = json.mentions && Array.isArray(json.mentions) ? json.mentions : [];

        this.nonce = json.nonce || 0.0;
        this.solution = json.solution || [];
    }

    get size() {
        return (this.id + '').length + this.image.length 
                + this.name.length + this.address.length 
                + this.message.length + (this.date + '').length
                + this.replyTo.length + this.signature.length; 
    }

    parseTags() {
        this.tags = Utils.getHashes(this.message);
        this.mentions = Utils.getMentions(this.message);
    }

    isValid() {
        try {
            if(!this.address) return false;
            if(!this.id) return false;
            if(!this.signature) return false;
            if(!this.image || !this.image.match(Utils.SIMPLE_URL_MATCH) || this.image.length > 255) return false;
            if(this.date < INITIAL_EPOCH || this.date > Date.now()) return false;
            if(!this.name || !Utils.isValidName(this.name)) return false;
            if(!this.message || Utils.getLength(this.message) > Utils.MAX_LENGTH || Utils.isExcessive(this.message)) return false;

            //validate cuckoo-cycle
            const cuckoo = new Cuckoo(this.hash, true);
            if(!cuckoo.verify(this.solution, DIFF)) return false;

            if(!this.isValidSignature()) return false;
            return true;
        }
        catch (e) {
            console.log(e);
            return false;
        }
    }

    get hash() {
        return this.id + this.image + this.name + this.message + this.date + this.replyTo + this.address + this.nonce;
    }

    sign(pkey) {
        this.signature = Hasher.sign(this.id + this.image + this.name + this.message + this.date + this.replyTo + this.nonce + this.solution.join(','), pkey);
    }

    isValidSignature() {
        return Hasher.verify(this.id + this.image + this.name + this.message + this.date + this.replyTo + this.nonce + this.solution.join(','), this.signature, this.address);
    }
}

module.exports = exports = Message;