import { Router, static as express_static } from 'express';
import { getChats, imageIdentification, olleAIChatsStreamWithoutImageAnalysis, olleAIChatting, olleChat } from '../controller/openAIController';
import { getImages, uploadFile } from '../controller/imageUpload';
import { sendOtp, verifyOtp } from '../controller/otpController';
import { signUp, signIn, googleSignUp, googleSignIn } from '../controller/userController';
import { addCollection, deleteCollection, getAllCollections, getCollection } from '../controller/collectionController';
import { addWishList, deleteWishList, getAllWishLists, getWishList } from '../controller/wishListController';
import { auth } from '../middlewares/errorHandler';

const router = Router();

//Collection Routes
router.post('/collections', auth, addCollection);
router.get('/collections', auth, getAllCollections);
router.get('/collections/:id', auth, getCollection);
router.delete('/collections/:id', auth, deleteCollection);
//WishList Routes
router.post('/wishlists', auth, addWishList);
router.get('/wishlists', auth, getAllWishLists);
router.get('/wishlists/:id', auth, getWishList);
router.delete('/wishlists/:id', auth, deleteWishList);
router.post('/image-identify', imageIdentification);
router.post('/openai/chat', olleChat);
//OTP Routes
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
//User Routes
router.post('/auth/signup', signUp);
router.post('/auth/signin', signIn);
router.post('/auth/google-signup', googleSignUp);
router.post('/auth/google-signin', googleSignIn);
//Image Routes
router.use('/images', express_static('images'));
router.get('/images/:path', getImages)

//Olle Chat Routes
router.get('/olle-chat', olleAIChatting);
router.get('/chats/:threadId', getChats);
router.get('/olle-chat-without-image-analysis', olleAIChatsStreamWithoutImageAnalysis);
//File Routes
router.post('/files', uploadFile);
//Root Route
router.get('/', (req, res, next) => {
    res.send("server is running")
});


export default router;