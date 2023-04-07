import chalk from 'chalk';
import express, { Express, Response, Request} from 'express'
import config from '../config.json';

const server: Express = express();
const serverConfig = config.server

const initServer = ()=>{
    server.use(express.static('public'));

    server.listen(serverConfig.port, ()=>{
        console.info(chalk.green(`[server] listening on port ${serverConfig.port}`))
    
    })

}


export default initServer