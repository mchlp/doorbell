import express from 'express';
import bodyParser from 'body-parser';
import config from './config.json';
import childProcess from 'child_process';
import crypto from 'crypto';

const exec = childProcess.exec;

const app = express();
const tokens = [];

function randomBytes(bytes) {
    return new Promise(function randomBytesPromise(resolve, reject) {
        crypto.randomBytes(bytes, function (err, buffer) {
            if (err) return reject(err);
            resolve(buffer);
        });
    });
}

async function genToken(len) {
    return (await randomBytes(len)).toString('base64').substring(0, len);
}

function isAuthenticated(req, res, next) {
    const rawToken = req.get('Authorization');
    if (!rawToken) {
        res.status(401).end('Not authorized');
        return;
    } else {
        if (tokens.includes(rawToken)) {
            return next();
        }
        else {
            res.status(401).end('Not authorized');
            return;
        }
    }
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/api/login', async function (req, res, next) {
    if (req.body.password === config.password) {
        const token = await genToken(16);
        tokens.push(token);
        setTimeout(() => {
            var index = arr.indexOf(token);
            if (index > -1) {
                arr.splice(index, 1);
            }
        }, 1000*60*10);
        res.json({
            'status': 'success',
            token
        });
    } else {
        res.json({
            'status': 'failed'
        })
    }
});

app.post('/api/doorbell', isAuthenticated, function (req, res, next) {
    exec('./actions/ring.sh', (err, stdout, stderr) => {
        if (err) {
            next(err);
        } else {
            if (stderr) {
                next(err);
            } else {
                res.json({
                    'status': 'success'
                });
            }
        }
    });
});

app.post('/api/cdtray', isAuthenticated, function (req, res, next) {
    exec('./actions/tray.sh', (err, stdout, stderr) => {
        if (err) {
            next(err);
        } else {
            if (stderr) {
                next(err);
            } else {
                res.json({
                    'status': 'success'
                });
            }
        }
    });
});

app.post('/api/alarm', isAuthenticated, function (req, res, next) {
    exec('./actions/alarm.sh', (err, stdout, stderr) => {
        if (err) {
            next(err);
        } else {
            if (stderr) {
                next(err);
            } else {
                res.json({
                    'status': 'success'
                });
            }
        }
    });
});

app.use(function (req, res, next) {
    res.status(404);
    res.end('404');
});

app.use(function (err, req, res, next) {
    res.status(500);
    res.end('Internal Server Error');
    console.error(err);
});

app.listen(config.api.port, function () {
    console.log("Started API on port " + config.api.port);
});