import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, validate: {
        validator: function (email: string) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Invalid email address"
    } },
    password: { type: String, required: false },
    googleId: { type: String, required: false },
    emailVerified: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.pre("save", async function (this: any, next: any) {
    if (!this.isModified("password") || !this.password) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (password: string) {
    return await bcrypt.compare(password, this.password);
};

//For gmail accounts, we need to ignore dot's in the email, we need to validate the email
const userModel = mongoose.models.User || mongoose.model("User", userSchema);

export default userModel;