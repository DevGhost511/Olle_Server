import mongoose, { Schema, model } from "mongoose";

const collectionSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    valuation: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    imageURL: {
        type: String,
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    categories: {
        type: [
            {
                name: {
                    type: String,
                    required: true,
                },
                value: {
                    type: String,
                    required: true,
                },
            }
        ],
        required: true,
    },
    threadId: {
        type: String,
        required: true,
    },
}, { timestamps: true });

const Collection = mongoose.models.Collection || model("Collection", collectionSchema);

export default Collection;