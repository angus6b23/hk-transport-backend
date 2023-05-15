import fs from 'fs';
import yaml from 'yaml';
import { fetchAll } from './controller'
import chalk from 'chalk'
import { Config } from '../typescript/interfaces';
import { TransportType } from '../typescript/types';

fs.promises.readFile('./config.yaml', 'utf-8').then(async(data)=> {
    let config: Config = yaml.parse(data);
    let args = process.argv.slice(2);
    console.info(chalk.blue('[rebuild] Starting to rebuild cache'));
    await fetchAll(config, args as TransportType[]);
    console.info(chalk.blue(`[rebuild] Finished rebuilding cache`))
})