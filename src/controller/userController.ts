import { Request, Response } from "express";
import userModel from "../models/userModel";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signUp = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await userModel.findOne({ email, googleId: { $exists: false } });
    if (user) {
        return res.status(400).json({ message: "User already exists" });
    }
    const newUser = await userModel.create({ email, password });
    res.status(201).json(newUser);
}

export const signIn = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign(JSON.stringify(user), process.env.JWT_SECRET as string);
    res.status(200).json({ token, user });
}

export const googleSignUp = async (req: Request, res: Response) => {
    const { googleToken } = req.body;
    
    try {
        // Use access token to get user info from Google
        const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${googleToken}`);
        const userInfo = await userInfoResponse.json();
        
        if (!userInfo.email) {
            return res.status(400).json({ message: "Failed to get user info from Google" });
        }
        
        const user = await userModel.findOne({ email: userInfo.email, googleId: userInfo.id });
        if (user) {
            return res.status(409).json({ message: "User already exists" });
        }
        
        const newUser = await userModel.create({ 
            email: userInfo.email, 
            googleId: userInfo.id,
            emailVerified: true // Google accounts are pre-verified
        });
        const token = jwt.sign(JSON.stringify(newUser), process.env.JWT_SECRET as string);
        res.status(201).json({ user: newUser, token });
    } catch (error) {
        console.error('Google signup error:', error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const googleSignIn = async (req: Request, res: Response) => {
    const { googleToken } = req.body;
    
    try {
        // Use access token to get user info from Google
        const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${googleToken}`);
        const userInfo = await userInfoResponse.json();
        
        if (!userInfo.email) {
            return res.status(400).json({ message: "Failed to get user info from Google" });
        }
        
        const user = await userModel.findOne({ 
            $or: [
                { email: userInfo.email },
                { googleId: userInfo.id }
            ]
        });
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        const token = jwt.sign(JSON.stringify(user), process.env.JWT_SECRET as string);
        res.status(200).json({ token, user });
    } catch (error) {
        console.error('Google signin error:', error);
        res.status(500).json({ message: "Internal server error" });
    }
}