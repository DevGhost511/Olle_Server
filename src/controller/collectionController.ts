import { Request, Response } from "express";
import Collection from "../models/collectionModel";
import { IUser } from "../types/user";

export const addCollection = async (req: Request, res: Response) => {
    const { name, category, valuation, description, imageURL, categories, threadId } = req.body;
    const user = req.user as IUser;
    const collection = new Collection({ name, category, valuation, description, imageURL, categories, threadId, user: user._id });
    try {
        await collection.save();
        res.status(200).json({ message: "Collection added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to add collection", error: error });
    }
}

export const getAllCollections = async (req: Request, res: Response) => {
    try {
        const collections = await Collection.find();
        res.status(200).json(collections);
    } catch (error) {
        res.status(500).json({ message: "Failed to get collections", error: error });
    }
}