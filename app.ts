import fs from 'fs'
import yaml from 'yaml'
import chalk from 'chalk'
import { Config } from './typescript/interfaces'
import cron from 'node-cron'

import { fetchAll } from './scrape/controller'
import initServer from './express-modules/create-server'
import fetchRthkNews from './scrape/rthk-news'

let config: Config

fs.promises
    .readFile('./config.yaml', 'utf-8')
    .then(async (data) => {
        config = yaml.parse(data)
        // Create folder if hashes not found
        if (!fs.existsSync('./public/hash.json')) {
            fs.mkdirSync('public')
            fs.mkdirSync('public/chunked')
            if (!fs.existsSync('./public/fullJSON')) {
                fs.mkdirSync('public/fullJSON')
            }
            console.info(
                chalk.yellow(
                    `[app] Hashes not found, rebuilding chunks and hashses`
                )
            )
            await fetchAll(config)
        }
        initServer(config)
        cron.schedule(config.scraper.cron, async () => {
            console.log(chalk.grey('[app] Cron job task run'))
            await fetchAll(config)
        })
        cron.schedule(config.scraper.newsCron, async () => {
            await fetchRthkNews()
        })
    })
    .catch((err) => {
        console.error(chalk.red(`[app] Error while loading config: ${err}`))
        console.error(chalk.red(`[app] Exiting due to error`))
        return
    })
