import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const ActionLogEntry = new Schema({
    timestamp: { type: Date, required: true },
    type: {
        type: String,
        required: true,
        enum: ['broadcast', 'knock', 'doorbell', 'alarm'],
    },
    message: {
        type: String,
        required: function() {
            return this.type === 'broadcast';
        },
    },
    result: {
        type: Boolean,
        required: true
    }
}, {
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
});

ActionLogEntry.virtual('unixtime').get(function () {
    return (new Date(this.timestamp)).valueOf();
});

export default mongoose.model('ActionLog', ActionLogEntry);