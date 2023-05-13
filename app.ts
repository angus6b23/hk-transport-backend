import fs from 'fs';
import yaml from 'yaml';
import chalk from 'chalk'
import { Config } from './typescript/interfaces';
import cron from 'node-cron'

import { fetchAll, createHashes } from './scrape/controller'
import initServer from "./express-modules/create-server";

let config: Config


fs.promises.readFile('./config.yaml', 'utf-8').then(async(data) => {
    config = yaml.parse(data);
    if (!fs.existsSync('./public/hash.json')){
        fs.mkdirSync('public');
        fs.mkdirSync('public/chunked')
        console.info(chalk.yellow(`[app] Hashes not found, rebuilding chunks and hashses`))
        fetchAll(config)
    }
    await createHashes();
    initServer(config);
    cron.schedule('5 3 * * *' , async ()=>{
        console.log(chalk.grey('task run'));
        await fetchAll(config);
        await createHashes();
    })
}).catch(err => {
    console.error(chalk.red(`[app] Error while loading config: ${err}`))
    console.error(chalk.red(`[app] Exiting due to error`))
    return
})
