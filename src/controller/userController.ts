import { Request, Response } from "express";
import userModel from "../models/userModel";

export const signUp = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await userModel.findOne({ email });
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
}