import express from 'express';
import bodyParser from 'body-parser';
import config from './config.json';
import childProcess from 'child_process';
import crypto from 'crypto';

const exec = childProcess.exec;

const app = express();
const tokens = {};

const state = {
    occupiedCheck: {
        checkInterval: null,
        startTime: null,
        resArray: [],
        checking: false,
    }
}

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
        if (rawToken in tokens) {
            if (tokens[rawToken] < Date.now()) {
                delete tokens[rawToken];
                res.status(401).end('Not authorized');
                return;
            }
            return next();
        }
        else {
            res.status(401).end('Not authorized');
            return;
        }
    }
}

function startCheckOccupied(res) {
    state.occupiedCheck.resArray.push(res);
    if (!state.occupiedCheck.checking) {
        exec('./actions/notify.sh', (err, stdout, stderr) => {
            if (err) {
                next(err);
            } else {
                if (stderr) {
                    next(err);
                } else {
                    state.occupiedCheck.startTime = Date.now();
                    exec('./actions/tray-open.sh', (err, stdout, stderr) => {
                        if (err) {
                            throw err;
                        } else {
                            if (stderr) {
                                throw err;
                            } else {
                                state.occupiedCheck.checkInterval = setInterval(checkOccupied, 500);
                            }
                        }
                    });
                }
            }
        });

    }
}

function checkOccupied() {
    if (Date.now() <= state.occupiedCheck.startTime + (config['check-occupied-timeout'] * 1000)) {
        exec('./actions/traystatus', (err, stdout, stderr) => {
            if (err) {
                console.error(err);
            } else {
                if (stderr) {
                    console.error(err);
                } else {
                    if (stdout === 'close') {
                        clearInterval(state.occupiedCheck.checkInterval);
                        for (const res of state.occupiedCheck.resArray) {
                            res.json({ 'occupied': true });
                        }
                        state.occupiedCheck.resArray = [];
                        state.occupiedCheck.checking = false;
                    }
                }
            }
        });
    } else {
        clearInterval(state.occupiedCheck.checkInterval);
        exec('./actions/tray-close.sh', (err, stdout, stderr) => {
            if (err) {
                console.error(err);
            } else {
                if (stderr) {
                    console.error(err);
                } else {
                    for (const res of state.occupiedCheck.resArray) {
                        res.json({ 'occupied': false });
                    }
                    state.occupiedCheck.checking = false;
                    state.occupiedCheck.resArray = [];
                }
            }
        });
    }
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/api/login', async function (req, res, next) {
    if (req.body.password === config.password) {
        const token = await genToken(16);
        tokens[token] = Date.now() + (config['token-expiry'] * 1000);
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

app.post('/api/check', isAuthenticated, function (req, res, next) {
    startCheckOccupied(res);
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