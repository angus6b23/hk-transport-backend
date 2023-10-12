import express from 'express';
import compression from 'compression'
import fs from 'fs'

const router = express.Router();
router.use(compression());

router.use('/chunked', express.static('./public/chunked/'))

router.get('/', (req, res) => {
    res.status(200).send({
        status: 'success',
        data: 'Please see https://github.com/angus6b23/hk-transport-backend for usage'
    });
})


router.get('/get-hash', async (req, res) => {
    const hash = await fs.promises.readFile('./public/hash.json', 'utf-8');
    res.status(200).json(JSON.parse(hash));
})


export default router;
