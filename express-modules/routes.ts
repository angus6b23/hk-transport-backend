import express from 'express';
import fs from 'fs'

const router = express.Router();

router.get('/', (req, res) => {
    res.status(200).send('test');
})
router.get('/get-hash', async (req, res) => {
    const hash = await fs.promises.readFile('./public/hash.json', 'utf-8');
    res.status(200).json(JSON.parse(hash));
})

export default router;