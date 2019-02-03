import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const MotionLogEntrySchema = new Schema({
    timestamp: { type: Date, required: true },
    occupied: { type: Boolean, required: true },
}, {
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
});

MotionLogEntrySchema.virtual('time').get(function () {
    return (new Date(this.timestamp)).valueOf();
});

export const MotionLogEntry = mongoose.model('MotionLog', MotionLogEntrySchema);

const TokenSchema = new Schema({
    created: { type: Date, required: true },
    expiry: { type: Date, required: true },
    token: { type: String, required: true },
});

export const Token = mongoose.model('Token', TokenSchema);