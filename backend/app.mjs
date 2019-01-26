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
const state = {
    inUse: false,
    lastMotion: 0,
    occupied: false,
};
let tokens = {};
let motionLog = [];

// set up motion sensor serial steram
const motionSerial = fs.createReadStream(config['occupancy-status-stream']);
motionSerial.on('data', function (chunk) {
    if (chunk.toString().includes('1')) {
        state.lastMotion = Date.now();
    }
});

// set interval to update occupancy status
setInterval(() => {
    const curStatus = Date.now() <= state.lastMotion + (config['motion-delay-sec'] * 1000);
    if (curStatus != state.occupied) {
        state.occupied = curStatus;
        io.emit('occupancy-update', {
            occupied: state.occupied
        });
        updateMotionLog(curStatus);
    }
}, 1000);

// check if tokens file exists and import if exists
if (fs.existsSync('tokens.json')) {
    const rawTokens = fs.readFileSync('tokens.json').toString();
    tokens = JSON.parse(rawTokens);
}

// check if motion log file exists and import if exists
if (fs.existsSync('motionLog.json')) {
    const rawMotionLog = fs.readFileSync('motionLog.json').toString();
    motionLog = JSON.parse(rawMotionLog);
}

function updateTokens() {
    fs.writeFileSync('tokens.json', JSON.stringify(tokens), { mode: 0o666 });
}

function updateMotionLog(status) {
    motionLog.push({
        'time': Date.now(),
        status
    });
    const now = Date.now();
    const newMotionLog = [];
    let lastStatus = false;
    let lastStatusTime = 0;
    for (const log of motionLog) {
        if (log.time + (1000 * 60 * 60 * 24 * config['log-length-days']) > now) {
            newMotionLog.push(log);
        } else {
            if (log.time > lastStatusTime) {
                lastStatusTime = log.time;
                lastStatus = log.status;
            }
        }
    }
    newMotionLog.push({
        time: lastStatusTime,
        lastStatus: lastStatus
    });
    newMotionLog.sort((a, b) => {
        return a.time - b.time;
    });
    motionLog = newMotionLog;
    fs.writeFileSync('motionLog.json', JSON.stringify(motionLog), { mode: 0o666 });
}


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

function authenticate(token) {
    if (!token) {
        return false;
    }
    if (token in tokens) {
        if (tokens[token] < Date.now()) {
            delete tokens[token];
            updateTokens();
            return false;
        }
        return true;
    }
}

function logout(token) {
    if (token in tokens) {
        delete tokens[token];
        updateTokens();
        return true;
    }
    return false;
}

async function startSoundAction(actionFunc, actionName, socket) {
    logAction(actionName + ' attempted.', socket);
    if (!state.inUse) {
        state.inUse = actionName;
        try {
            await actionFunc();
            logAction(actionName + ' succeeded.', socket);
        } catch (e) {
            logAction(actionName + ' failed.', socket);
            console.error(e);
        }
        state.inUse = null;
        socket.emit(actionName + '-reply', {
            'status': 'success'
        });
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
        tokens[token] = Date.now() + (config['token-expiry-sec'] * 1000);
        updateTokens();
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

app.post('/api/logout', async (req, res, next) => {
    if (req.body.token) {
        if (logout(req.body.token)) {
            res.json({
                'status': 'success',
            });
            return;
        }
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

            socket.on('doorbell', async () => {
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

            socket.on('alarm', async () => {
                await startSoundAction(async () => {
                    await exec('./actions/alarm.sh');
                }, 'alarm', socket);
            });

            socket.on('knock', async () => {
                await startSoundAction(async () => {
                    await exec('./actions/notify.sh');
                    await talk('If you hear this, please pace the room.');
                }, 'knock', socket);
            });

            socket.on('occupancy-log-get', () => {
                socket.emit('occupancy-log-reply', motionLog);
            });

            socket.on('occupancy-check', async () => {
                socket.emit('occupancy-update', {
                    occupied: state.occupied
                });
            });

            socket.emit('authenticate-reply', {
                status: 'success'
            });
            socket.emit('occupancy-log-reply', motionLog);
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
