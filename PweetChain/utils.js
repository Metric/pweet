'use strict';

const SIMPLE_URL_MATCH = /[\S]+:\/\/[\S]+/gi;
const NAME_MATCH = /[A-Za-z0-9_]{1,15}/gi;
const MENTION_MATCH = /\@[A-Za-z0-9]/gi;
const HASH_MATCH = /\#[A-Za-z0-9_-]/gi;
const MAX_LENGTH = 140;
const MAX_USERNAME_LENGTH = 15;

exports.MAX_LENGTH = MAX_LENGTH;

exports.HASH_MATCH = HASH_MATCH;
exports.MENTION_MATCH = MENTION_MATCH;
exports.SIMPLE_URL_MATCH = SIMPLE_URL_MATCH;

exports.isValidName = name => {
    return name.match(NAME_MATCH) && name.length > 0 && name.length < MAX_USERNAME_LENGTH;
};

const getHashes = exports.getHashes = message => {
    const hashes = [];
    const items = message.split(/\s/);
    items.forEach(i => {
        if(i.match(HASH_MATCH)) {
            hashes.push(i);
        }
    });  
    return hashes;
};

const getMentions = exports.getMentions = message => {
    const mentions = [];
    const items = message.split(/\s/);
    items.forEach(i => {
        if(i.match(MENTION_MATCH)) {
            mentions.push(i);
        }
    });
    return mentions;
};

exports.isExcessive = message => {
    if (getMentions(message).length > 10 || getHashes(message).length > 10) {
        return true;
    }

    return false;
};

exports.getLength = message => {
    if(message.length === 0) return MAX_LENGTH + 1;
    const hashes = getHashes(message);
    hashes.forEach(h => {
        message = message.replace(h, '');
    });
    const mentions = getMentions(message);
    mentions.forEach(m => {
        message = message.replace(m, '');
    });

    return message.length;
};

exports.getURLs = message => {
    return message.match(SIMPLE_URL_MATCH);
};
