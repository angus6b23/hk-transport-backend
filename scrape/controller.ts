import fs from 'fs';
import chalk from 'chalk';
import { Config } from '../typescript/interfaces'
import fetchBuses from "./bus";
import fetchMinibus from './minibus';
import fetchFerry from './ferry';
import fetchTram from './tram';
import fetchMTR from './mtr';
import fetchLightRail from "./lightRail";
import { TransportType } from '../typescript/types';
import sha256 from 'sha256';


const fetchAll = async (config: Config, types: TransportType[] = []) => {
    const chunkSize = config.scraper.chunkSize;
    if (types.length > 0){ //Arguments will be passed from rebuildCache.ts
        let promiseArray = []
        for (let type of types){
            const newPromise = createPromise(type, chunkSize);
            promiseArray.push(newPromise);
        }
        await Promise.all(promiseArray)
    } else { //Default action
        // Create Promises for all transport types
        const busPromise = createPromise('bus', chunkSize);
        const minibusPromise = createPromise('minibus', chunkSize);
        const ferryPromise = createPromise('ferry', chunkSize);
        const mtrPromise = createPromise('mtr', chunkSize)
        const tramPromise = createPromise('tram', chunkSize)
        const lrPromise = createPromise('lightRail', chunkSize)
        // Wait all promises to be fullfilled
        await Promise.all([busPromise, minibusPromise, ferryPromise, mtrPromise, tramPromise, lrPromise])
    }
    // Read Dir of chunked folder and create hash for all json;
    await createHashes();
    console.info(chalk.green(`[scrape] Finished fetching and creating all transport type`));
}

const createHashes = async () => {
    const files = await fs.promises.readdir('./public/chunked');
    let hash: any = {}
    for (let file of files) {
        const content = await fs.promises.readFile(`./public/chunked/${file}`);
        const key = file.replace('.json', '');
        hash[key] = sha256(content);
    }
    await fs.promises.writeFile('./public/hash.json', JSON.stringify(hash), 'utf-8')
}

const chunk = (array: any[], chunkSize: number) => {
    let res: any[] = []
    for (let i = 0; i < array.length; i += chunkSize) {
        let chunk = array.slice(i, i + chunkSize);
        res = [...res, chunk]
    }
    return res
}

const writeChunked = async (array: any[], prefix: string) => {
    for (let i = 0; i < array.length; i++) {
        await fs.promises.writeFile(`./public/chunked/${prefix}-chunk${i}.json`, JSON.stringify(array[i]), 'utf-8');
    }
}

const createPromise = async (type: TransportType, chunkSize: number) => {
    return new Promise(async (resolve, reject) => {
        let data;
        try {
            switch (type) {
                case 'bus':
                    data = await fetchBuses();
                    break;
                case 'minibus':
                    data = await fetchMinibus();
                    break;
                case 'ferry':
                    data = await fetchFerry();
                    break;
                case 'lightRail':
                    data = await fetchLightRail();
                    break;
                case 'mtr':
                    data = await fetchMTR();
                    break;
                case 'tram':
                    data = await fetchTram();
                    break;
                default:
                    reject
            }
            if (data && data.length > 1) {
                const chunked = chunk(data, chunkSize);
                await writeChunked(chunked, type);
                console.info(chalk.blue(`[scrape] Finish creating json for ${type}`))
                resolve(undefined)
            }
            reject
        } catch (err) {
            console.error(chalk.red(`[scrape] Error: ${err}`));
            reject
        }
    })
}

export { fetchAll, createHashes }
