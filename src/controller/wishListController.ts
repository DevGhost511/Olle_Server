import { Request, Response } from "express";
import { IUser } from "../types/user";
import WishList from "../models/wishListModel";

export const addWishList = async (req: Request, res: Response) => {
    const { name, category, valuation, description, imageURL, categories, threadId, price, rarerate } = req.body;
    const user = req.user as IUser;
    const wishList = new WishList({ name, category, valuation, description, imageURL, categories, threadId, user: user._id, price, rarerate  });
    try {
        await wishList.save();
        res.status(200).json({ message: "WishList added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to add WishList", error: error });
    }
}

export const getAllWishLists = async (req: Request, res: Response) => {
    const user = req.user as IUser;
    try {
        const wishLists = await WishList.find({ user: user._id });
        res.status(200).json(wishLists);
    } catch (error) {
        res.status(500).json({ message: "Failed to get wishLists", error: error });
    }
}
export const getWishList = async (req: Request, res: Response) => {
    const user = req.user as IUser;
    const { id } = req.params;
    try {
        const wishList = await WishList.findById(id).where({ user: user._id });
        res.status(200).json(wishList);
    } catch (error) {
        res.status(500).json({ message: "Failed to get wishList", error: error });
    }
}
export const deleteWishList = async (req: Request, res: Response) => {
    const user = req.user as IUser;
    const { id } = req.params;
    try {
        await WishList.findByIdAndDelete(id).where({ user: user._id });
        res.status(200).json({ message: "WishList deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete WishList", error: error });
    }
}