'use strict';

const http = require('http');

//simple shortcut since the NIST XML is consistent
const NIST_TIME_REGEX = /\d+/;

class Time {
    static now() {
        return new Promise((res, rej) => {
            http.get('http://nist.time.gov/actualtime.cgi', (rep) => {
                let chunk = '';    
                rep.on('data', (c) => {
                    chunk += c;
                })
                .on('end', () => {
                    const matches = chunk.match(NIST_TIME_REGEX);
                    if(matches && matches.length > 0) {
                        res(new Date(Number(matches[0])));
                    }
                    else{
                        res(Date.now());
                    }
                });
            })
            .on('error', (err) => {
                res(Date.now());
            });
        });
    }
}

module.exports = exports = Time;