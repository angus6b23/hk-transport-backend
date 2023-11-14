import express from 'express';
import compression from 'compression'
import fs from 'fs'
import fetchLightRailETA from './fetchLightRail';
import { Query } from 'express-serve-static-core'

interface LightRailRequest<T extends Query> extends Express.Request{
    query: T
}

interface LightRailQuery{
    routeNo: string;
    direction: 1 | 2
}
const router = express.Router();
router.use(compression());

router.use('/chunked', express.static('./public/chunked/'))

router.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        data: 'Please see https://github.com/angus6b23/hk-transport-backend for usage'
    });
})


router.get('/get-hash', async (req, res) => {
    const hash = await fs.promises.readFile('./public/hash.json', 'utf-8');
    res.status(200).json(JSON.parse(hash));
})

router.get('/lightRailEta', async(req, res) =>{ 
    const routeNo = req.query.routeNo as string
    const directionString = req.query.direction as string;
    const direction = parseInt(directionString)
    if ( !routeNo || !direction || ((direction) !== 1 && direction !== 2)){
        res.status(400).send('Bad Request - Must include both parameters: <br />routeNo (see https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.0.pdf)<br />direction (1 or 2)')
    } else {
        const data = await fetchLightRailETA(routeNo, direction)
        res.status(200).json(data)
    }
})

router.get('/get-news', async(req, res) => {
    try{
        const news = await fs.promises.readFile('./public/rthk-news.json', 'utf-8')
        res.status(200).json(JSON.parse(news))
    } catch(err){
        res.status(500).send('Server Error - currently no news fetched')
    }

})

export default router;
