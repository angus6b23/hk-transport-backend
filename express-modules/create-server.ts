import chalk from 'chalk';
import cors from 'cors'
import express, { Express } from 'express';
import { Config } from '../typescript/interfaces'
import routes from './routes'
const server: Express = express();

const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200
}

const initServer = (config: Config) => {
    server.use(cors(config.server.cors))
    server.use(config.server.basePath, routes);
    server.listen(config.server.port, () => {
        console.info(chalk.green(`[server] listening on port ${config.server.port}`))
    })

}


export default initServer
