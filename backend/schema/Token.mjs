import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const TokenSchema = new Schema({
    created: { type: Date, required: true },
    expiry: { type: Date, required: true },
    token: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true}
});

export default mongoose.model('Token', TokenSchema);