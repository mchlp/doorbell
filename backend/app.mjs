import util from 'util';
import express from 'express';
import http from 'http';
import bodyParser from 'body-parser';
import config from './config.json';
import childProcess from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import socketIO from 'socket.io';

const exec = util.promisify(childProcess.exec);

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
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
    },
    lastMotion: Date.now()
}

const motionSerial = fs.createReadStream('/dev/ttyUSB0');
motionSerial.on('data', function (chunk) {
    state.lastMotion = Date.now();
});


function logAction(action, socket) {
    console.log('[' + new Date().toLocaleString() + '] - ' + (socket ? socket.id + ' - ' : '') + action);
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
    if (authenticate(rawToken)) {
        return next();
    } else {
        res.status(401).end('Not authorized');
        return;
    }
}

function authenticate(token) {
    if (!token) {
        return false;
    }
    if (token in tokens) {
        if (tokens[token] < Date.now()) {
            delete tokens[token];
            return false;
        }
        return true;
    }
}

function checkOccupied() {
    res.json({
        'occupied': Date.now() <= state.lastMotion + config['motion-delay']
    })
    /*if (Date.now() <= state.occupiedCheck.startTime + (config['check-occupied-timeout'] * 1000)) {
        exec('./actions/traystatus', (err, stdout, stderr) => {
            if (err) {
                console.error(err);
            } else {
                if (stderr) {
                    console.error(err);
                }
                if (stdout === 'close') {
                    clearInterval(state.occupiedCheck.checkInterval);
                    for (const res of state.occupiedCheck.resArray) {
                        res.json({ 'occupied': true });
                    }
                    state.occupiedCheck.lastChecked = Date.now();
                    state.occupiedCheck.lastCheckedStatus = true;
                    state.occupiedCheck.resArray = [];
                    state.occupiedCheck.checking = false;
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
                }
                for (const res of state.occupiedCheck.resArray) {
                    res.json({ 'occupied': false });
                }
                state.occupiedCheck.lastChecked = Date.now();
                state.occupiedCheck.lastCheckedStatus = false;
                state.occupiedCheck.checking = false;
                state.occupiedCheck.resArray = [];
            }
        });
    }*/
}

async function startSoundAction(actionFunc, actionName, socket) {
    logAction(actionName + ' attempted.', socket);
    if (!state.inUse) {
        state.inUse = actionName;
        await actionFunc();
        state.inUse = null;
        socket.emit(actionName + '-reply', {
            'status': 'success'
        });
        logAction(actionName + ' succeeded.', socket);
    } else {
        socket.emit(actionName + '-reply', {
            'status': 'in-use'
        });
        logAction(actionName + ' failed, in use.', socket);
    }
}

async function talk(message) {
    await exec('espeak "' + message + '" -s 150');
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/api/login', async (req, res, next) => {
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

app.use((req, res, next) => {
    res.status(404);
    res.end('404');
});

app.use((err, req, res, next) => {
    res.status(500);
    res.end('Internal Server Error');
    console.error(err);
});

app.listen(config.api.port, () => {
    console.log('Started API on port ' + config.api.port);
});


io.set('origins', '*:*');
io.on('connection', (socket) => {
    logAction('New client connected.', socket);
    socket.on('authenticate', (data) => {
        if (authenticate(data.token)) {

            socket.on('doorbell', async (data) => {
                await startSoundAction(async () => {
                    await exec('./actions/ring.sh');
                    await talk('Someone is at the door.');
                }, 'doorbell', socket);
            });

            socket.on('broadcast', async (data) => {
                await startSoundAction(async () => {
                    await talk(data.message);
                }, 'broadcast', socket);
            });

            socket.on('alarm', async (data) => {
                await startSoundAction(async () => {
                    await exec('./actions/alarm.sh');
                }, 'alarm', socket);
            });

            socket.emit('authenticate-reply', {
                status: 'success'
            });
            logAction('Authentication succeeded.', socket);
        } else {
            socket.emit('authenticate-reply', {
                status: 'failed'
            });
            logAction('Authentication failed.', socket);
        }
    });
    socket.on('disconnect', () => {
        logAction('Client disconnected.', socket);
    });
});

server.listen(config.socket.port, () => {
    console.log('Started Socket.IO on port ' + config.socket.port);
});