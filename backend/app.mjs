import util from 'util';
import express from 'express';
import bodyParser from 'body-parser';
import config from './config.json';
import childProcess from 'child_process';
import crypto from 'crypto';

const exec = util.promisify(childProcess.exec);

const app = express();
const tokens = {};

const state = {
    inUse: false,
    occupiedCheck: {
        lastChecked: null,
        lastCheckedStatus: null,
        checkInterval: null,
        startTime: null,
        resArray: [],
        checking: false,
    }
};

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

async function startCheckOccupied(res) {
    if (Date.now() < state.occupiedCheck.lastChecked + (config['check-occupied-status-expiry'] * 1000)) {
        res.json({ 'occupied': state.occupiedCheck.lastCheckedStatus });
        return;
    }
    if (!state.inUse) {
        state.occupiedCheck.resArray.push(res);
        if (!state.occupiedCheck.checking) {
            state.inUse = true;
            state.occupiedCheck.startTime = Date.now();
            state.occupiedCheck.checking = true;
            exec('./actions/tray-open.sh');
            exec('./actions/notify.sh').then(async () => {
                const trayStatus = await checkTrayStatus();
                if (trayStatus === 'close') {
                    state.inUse = false;
                    stopCheckOccupied(true);
                    return;
                }
                exec('espeak "If you hear this, close the CD Tray." -s 160').then(() => {
                    state.inUse = false;
                });
                state.occupiedCheck.checkInterval = setInterval(checkOccupied, 500);
            });
        }
    } else {
        res.json({
            'status': 'in-use'
        });
    }
}

async function checkTrayStatus() {
    return (await exec('./actions/traystatus')).stdout;
}

function stopCheckOccupied(occupied) {
    clearInterval(state.occupiedCheck.checkInterval);
    for (const res of state.occupiedCheck.resArray) {
        res.json({ 'occupied': occupied });
    }
    state.occupiedCheck.lastChecked = Date.now();
    state.occupiedCheck.lastCheckedStatus = occupied;
    state.occupiedCheck.resArray = [];
    state.occupiedCheck.checking = false;
}

async function checkOccupied() {
    if (Date.now() <= state.occupiedCheck.startTime + (config['check-occupied-timeout'] * 1000)) {
        const trayStatus = await checkTrayStatus();
        if (trayStatus === 'close') {
            stopCheckOccupied(true);
        }
    } else {
        exec('./actions/tray-close.sh');
        stopCheckOccupied(false);
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
        });
    }
});

app.post('/api/doorbell', isAuthenticated, async function (req, res, next) {
    if (!state.inUse) {
        state.inUse = true;
        await exec('./actions/ring.sh');
        await exec('espeak "Someone is at the door." -s 160');
        state.inUse = false;
        res.json({
            'status': 'success'
        });
    } else {
        res.json({
            'status': 'in-use'
        });
    }
});

app.post('/api/broadcast', isAuthenticated, async function (req, res, next) {
    if (!state.inUse) {
        state.inUse = true;
        await exec('espeak "' + req.body.message + '" -s 160');
        state.inUse = false;
        res.json({
            'status': 'success'
        });
    } else {
        res.json({
            'status': 'in-use'
        });
    }
});

app.post('/api/check', isAuthenticated, function (req, res, next) {
    startCheckOccupied(res);
});

app.post('/api/alarm', isAuthenticated, async function (req, res, next) {
    if (!state.inUse) {
        state.inUse = true;
        await exec('./actions/alarm.sh');
        state.inUse = false;
        res.json({
            'status': 'success'
        });
    } else {
        res.json({
            'status': 'in-use'
        });
    }
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
    console.log('Started API on port ' + config.api.port);
});