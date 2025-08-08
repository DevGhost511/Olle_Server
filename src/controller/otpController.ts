import { Request, Response } from "express";
import userModel from "../models/userModel";
import redisClient from "../config/redisClient";
import nodemailer from "nodemailer";

export const sendOtp = async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
        return res.status(401).json({ message: "Invalid email" });
    }
    const otp = Math.floor(1000 + Math.random() * 9000);
    //Use redis to store the otp
    //send email with otp
    console.log(process.env.EMAIL_USER, process.env.EMAIL_USER_PASS);
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_USER_PASS
        }
    });
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "OTP for Olle",
        text: `Your OTP is ${otp}`
    };
    await transporter.sendMail(mailOptions);
    await redisClient.set(email, otp.toString(), { EX: 5 * 60 });
    console.log(otp);
    res.status(200).json({ message: "OTP sent to email" });
}   

export const verifyOtp = async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const storedOtp = await redisClient.get(email);
    if (!storedOtp) {
        return res.status(401).json({ message: "Invalid email" });
    }
    if (storedOtp !== otp) {
        return res.status(401).json({ message: "Invalid OTP" });
    }
    await userModel.updateOne({ email }, { $set: { emailVerified: true } });
    res.status(200).json({ message: "Email verified" });
}
