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
    await createHashes();
    initServer(config);
    if (fs.existsSync('./public/hash.json')){
        console.info(chalk.yellow(`[app] Hashes not found, rebuilding chunks and hashses`))
        fetchAll(config)
    }
    cron.schedule('5 3 * * *' , ()=>{
        console.log(chalk.grey('task run'));
        fetchAll(config)
    })
}).catch(err => {
    console.error(chalk.red(`[app] Error while loading config: ${err}`))
    console.error(chalk.red(`[app] Exiting due to error`))
    return
})
