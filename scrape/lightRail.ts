import axios from 'axios'
import axiosRetry from 'axios-retry'
import chalk from 'chalk'
import papa from 'papaparse'
import { MTRRoute, MTRStop } from '../typescript/interfaces'
import { createMTRStop, createLRRoute } from './create'
// For Dev purpose only

axiosRetry(axios, { retries: 3 })

const PAPACONFIG = {
    header: true,
    skipEmptyLines: true,
}

const fetchLightRail = async () => {
    console.info(chalk.blue(`[light-rail] Start fetching Light Rail`))
    try {
        const lrResponse = await axios(
            'https://opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv'
        ) //Get all light rail information from data.gov.hk
        const lrCSV = lrResponse?.data.replaceAll(',,,,,,\r\n', '')
        let lrData = papa.parse(lrCSV, PAPACONFIG).data
        let lr: MTRRoute[] = lrData.reduce(function (
            lr: MTRRoute[],
            item: any
        ) {
            const newStop: MTRStop = createMTRStop(item)
            const checkIndex = lr.findIndex(
                (route) =>
                    route.direction == item['Direction'] &&
                    route.routeId == item['Line Code']
            )
            if (checkIndex !== -1) {
                lr[checkIndex].stops.push(newStop)
            } else {
                const newRoute: MTRRoute = createLRRoute(item)
                newRoute.stops.push(newStop)
                lr.push(newRoute)
            }
            return lr
        }, [])
        for (let route of lr) {
            let {
                code: originCode,
                nameEN: originEN,
                nameTC: originTC,
            } = route.stops[0]
            let {
                code: destCode,
                nameEN: destEN,
                nameTC: destTC,
            } = route.stops[route.stops.length - 1]
            route.originCode = originCode
            route.originEN = originEN
            route.originTC = originTC
            route.destCode = destCode
            route.destEN = destEN
            route.destTC = destTC
        }
        return lr
    } catch (err) {
        console.error(
            chalk.red(`[light-rail] Error while scraping Light Rail: ${err}`)
        )
    }
}

export default fetchLightRail
