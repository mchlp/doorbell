import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const UserSchema = new Schema({
    username: { type: String, required: true, unique: true },
    password: {
        type: String,
        required: function () {
            return this.type === 'user';
        },
    },
    type: {
        type: String,
        required: true,
        enum: ['user', 'admin']
    },
    perms: {
        type: [String],
        enum: ['admin'],
        required: function () {
            return this.type === 'user';
        },
    }
});

export default mongoose.model('User', UserSchema);