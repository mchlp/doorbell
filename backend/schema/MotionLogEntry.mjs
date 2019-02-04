import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const MotionLogEntrySchema = new Schema({
    timestamp: { type: Date, required: true },
    occupied: { type: Boolean, required: true },
}, {
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
});

MotionLogEntrySchema.virtual('unixtime').get(function () {
    return (new Date(this.timestamp)).valueOf();
});

export default mongoose.model('MotionLog', MotionLogEntrySchema);