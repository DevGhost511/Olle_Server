import { Router, static as express_static } from 'express';
import { imageIdentification, olleAIChatting, olleChat } from '../controller/openAIController';
import { getImages, uploadFile } from '../controller/imageUpload';

const router = Router();

router.post('/image-identify', imageIdentification);
router.post('/openai/chat', olleChat);

router.use('/images', express_static('images'));
router.get('/images/:path', getImages)

router.get('/olle-chat', olleAIChatting);


router.post('/files', uploadFile);

router.get('/', (req, res, next) => {
    res.send("server is running")
});


export default router;