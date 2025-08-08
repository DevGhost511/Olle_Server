import mongoose from "mongoose";

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URL) {
            throw new Error("MONGODB_URI environment variable is not set.");
        }
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        process.exit(1);
    }
}

export default connectDB;