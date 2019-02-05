import mongoose from 'mongoose';
import * as schema from './schema/index.mjs';
import bcrypt from 'bcrypt';
import config from './config.json';

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

const saltRounds = config['password-salt-rounds'];

const newUser = {
    username: 'user',
    password: 'pass',
    perms: 'some perms'
};

function bcryptHash(password, saltRounds) {
    return new Promise(function bcryptHashPromise(resolve, reject) {
        bcrypt.hash(password, saltRounds, function (err, res) {
            if (err) return reject(err);
            resolve(res);
        });
    });
}

async function start() {
    newUser.hashedPassword = await bcryptHash(newUser.password, saltRounds);
    await schema.User.create({
        username: newUser.username,
        password: newUser.hashedPassword,
        perms: newUser.perms
    });
    console.log('User added.');
}

start();