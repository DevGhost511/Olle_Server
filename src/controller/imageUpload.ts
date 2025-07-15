import { Request, Response, NextFunction } from 'express';
import Busboy from 'busboy';
import { createWriteStream } from 'fs';
import { generate } from 'randomstring';

const upload = "/Upload/"

export const getImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { path } = req.params;
        res.sendFile(upload + path)
    } catch (err) {
        next(err)
    }
}

export const uploadFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const info = await savefile(req);
        res.status(200).json({
            info,
            ok: true
        })
    } catch (err) {
        next(err)
    }
}

const savefile = async (req: Request) => {
    const bb = Busboy({ 
        headers: req.headers,
        limits: { files: 1 } 
    });
    req.pipe(bb);

    return new Promise<{name: string, path: string, type: string}>((resolve, reject) => {
        bb.on('file', (name, file, fileinfo) => {
            const ext = fileinfo.filename.split('.')[1];
            const path = generate({length:16}) + "_" + Date.now() + (ext ? '.' + ext : '');
            console.log(path)
            const stream = createWriteStream(upload + path);
            file.pipe(stream);
            stream.on('close', () => {
                resolve({
                    name: fileinfo.filename,
                    path,
                    type: fileinfo.mimeType
                });
            });
            stream.on('error', (err) => {
                console.error(err);
                reject(null);
            });
        });
    });
}