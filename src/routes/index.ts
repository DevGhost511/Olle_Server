import { Router, static as express_static } from 'express';
import { imageIdentification } from '../controller/openAIController';
import { getImages, uploadFile } from '../controller/imageUpload';

const router = Router();

router.get('/imageIdentifier', imageIdentification);

router.use('/images', express_static('images'));
router.get('/images/:path', getImages)

router.post('/files', uploadFile);

router.get('/', (req, res, next) => {
    res.send("server is running")
});


export default router;