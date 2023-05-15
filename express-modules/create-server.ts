import chalk from 'chalk';
import cors from 'cors'
import express, { Express } from 'express';
import { Config } from '../typescript/interfaces'
import routes from './routes'
const server: Express = express();

const corsOptions = {
    origin: '*'
}

const initServer = (config: Config) => {
    // server.use(express.static('public'));
    server.use(cors(corsOptions))
    server.use('/hk-transport', routes);
    server.listen(config.server.port, () => {
        console.info(chalk.green(`[server] listening on port ${config.server.port}`))
    })

}


export default initServer