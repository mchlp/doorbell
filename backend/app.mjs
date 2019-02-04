import util from 'util';
import express from 'express';
import http from 'http';
import bodyParser from 'body-parser';
import config from './config.json';
import childProcess from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import socketIO from 'socket.io';
import mongoose from 'mongoose';
import * as schema from './schema';

const exec = util.promisify(childProcess.exec);

const mongooseOptions = {};
if (config.db.username && config.db.password) {
    mongooseOptions.auth = {};
    mongooseOptions.auth.user = config.db.username;
    mongooseOptions.auth.password = config.db.password;
    mongooseOptions.auth.authdb = config.db.authSource;
}
mongooseOptions.useNewUrlParser = true;
mongooseOptions.dbName = config.db.database;

mongoose.connect('mongodb://' + config.db.host + ':' + (config.db.port ? config.db.port : 27017) + '/', mongooseOptions);

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const state = {};

async function start() {

    const beforeStartLastMotion = await schema.MotionLogEntry.findOne({ occupied: true }).sort({ timestamp: -1 }).exec();
    const beforeStartOccupied = await schema.MotionLogEntry.findOne().sort({ timestamp: -1 }).exec();

    state.inUse = false;
    state.lastMotion = beforeStartLastMotion ? beforeStartLastMotion.time : 0;
    state.occupied = beforeStartOccupied ? beforeStartOccupied.occupied : false;

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

    async function updateMotionLog(status) {
        await schema.MotionLogEntry.create({
            timestamp: Date.now(),
            occupied: status
        });
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

    async function authenticate(token) {
        if (!token) {
            return false;
        }
        const foundToken = await schema.Token.findOne({ token }).exec();
        if (foundToken) {
            if (Date.now() <= new Date(foundToken.expiry).valueOf()) {
                return true;
            } else {
                await schema.Token.deleteMany({ token }).exec();
                return false;
            }
        } else {
            return false;
        }
    }

    async function logout(token) {
        return !!await schema.Token.deleteMany({ token }).exec();
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
            console.log(await schema.Token.create({
                created: Date.now(),
                expiry: Date.now() + (config['token-expiry-sec'] * 1000),
                token
            }));
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
        socket.on('authenticate', async (data) => {
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

                socket.on('occupancy-log-get', async () => {
                    socket.emit('occupancy-log-reply', await schema.MotionLogEntry.find().sort({ timestamp: 1 }).exec());
                });

                socket.on('occupancy-check', async () => {
                    socket.emit('occupancy-update', {
                        occupied: state.occupied
                    });
                });

                socket.emit('authenticate-reply', {
                    status: 'success'
                });
                socket.emit('occupancy-log-reply', await schema.MotionLogEntry.find().sort({ timestamp: 1 }).exec());
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
}

start();