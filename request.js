'use strict';


//TODO: Add gzip support...

class Request {
    static post(url, d, headers) {
        return new Promise((res, rej) => {
            const data = '';

            const lib = url.startsWith('https:') ? require('https') : require('http');
            
            headers = headers || {
                'Content-Type': 'text/plain'
            };

            if(typeof d === 'object') {
                d = JSON.stringify(d);
                headers['Content-Type'] = 'application/json';
            }

            headers['Content-Length'] = Buffer.byteLength(d + '');

            const req = lib.request(url, {
                method: 'POST',
                headers: headers
            }, (resp) => {

                if(resp.statusCode < 200 || resp.statusCode > 299) {
                    rej(new Error('Failed with status code: ' + resp.statusCode));
                    return;
                }

                resp.on('data', (chunk) => {
                    data += chunk;
                })
                .on('end', () => {
                    if(resp.headers['Content-Type'].indexOf('json') > -1) {
                        res(JSON.parse(data));
                    }
                    else {
                        res(data);
                    }
                });
            })
            .on('error', (er) => {
                rej(er);
            });
            
            req.write(d + '');
            req.end();
        });
    }

    static get(url) {
        return new Promise((res, rej) => {
            const data = '';

            const lib = url.startsWith('https:') ? require('https') : require('http');

            lib.get(url, (resp) => {
                if(resp.statusCode < 200 || resp.statusCode > 299) {
                    rej(new Error('Failed with status code: ' + resp.statusCode));
                    return;
                }

                resp.on('data', (chunk) => {
                    data += chunk;
                })
                .on('end', () => {
                    if(resp.headers['Content-Type'].indexOf('json') > -1) {
                        res(JSON.parse(data));
                    }
                    else {
                        res(data);
                    }
                });
            })
            .on('error', (er) => {
                rej(er);
            });
        });
    }
}

module.exports = exports = Request;