import fs from 'fs';
import yaml from 'yaml';
import chalk from 'chalk'
import { Config } from './typescript/interfaces';
import cron from 'node-cron'

import { fetchAll } from './scrape/controller'
import initServer from "./express-modules/create-server";

let config: Config


fs.promises.readFile('./config.yaml', 'utf-8').then(async(data) => {
    config = yaml.parse(data);
    // Create folder if hashes not found
    if (!fs.existsSync('./public/hash.json')){
        fs.mkdirSync('public');
        fs.mkdirSync('public/chunked')
        console.info(chalk.yellow(`[app] Hashes not found, rebuilding chunks and hashses`))
        await fetchAll(config)
    }
    if (!fs.existsSync('./public/fullJSON')){
        fs.mkdirSync('public/fullJSON')
    }
    initServer(config);
    cron.schedule(config.scraper.cron , async ()=>{
        console.log(chalk.grey('[app] Cron job task run'));
        await fetchAll(config);
    })
}).catch(err => {
    console.error(chalk.red(`[app] Error while loading config: ${err}`))
    console.error(chalk.red(`[app] Exiting due to error`))
    return
})
