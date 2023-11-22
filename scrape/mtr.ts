import axios from 'axios'
import axiosRetry from 'axios-retry'
import chalk from 'chalk'
import papa from 'papaparse'
import { MTRRoute, MTRStop } from '../typescript/interfaces'
import { createMTRStop, createMTRRoute } from './create'
// For Dev purpose only

axiosRetry(axios, { retries: 3 })

const PAPACONFIG = {
    header: true,
    skipEmptyLines: true,
}

const fetchMTR = async () => {
    console.info(chalk.blue(`[mtr] Start fetching MTR`))
    try {
        const mtrResponse = await axios(
            'https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv'
        ) //Get all mtr information from data.gov.hk
        const mtrCSV = mtrResponse?.data.replaceAll(',,,,,,\r\n', '')
        let mtrData = papa.parse(mtrCSV, PAPACONFIG).data
        let mtr: MTRRoute[] = mtrData.reduce(function (
            mtr: MTRRoute[],
            item: any
        ) {
            const newStop: MTRStop = createMTRStop(item)
            const directionString = item['Direction']
            const direction =
                directionString == 'DT'
                    ? 1
                    : directionString == 'UT'
                      ? 2
                      : directionString.includes('DT')
                        ? 3
                        : directionString.includes('UT')
                          ? 4
                          : undefined
            const checkIndex = mtr.findIndex(
                (route) =>
                    route.direction == direction &&
                    route.routeId == item['Line Code']
            )
            if (checkIndex !== -1) {
                mtr[checkIndex].stops.push(newStop)
            } else {
                const newRoute: MTRRoute = createMTRRoute(item)
                newRoute.stops.push(newStop)
                mtr.push(newRoute)
            }
            return mtr
        }, [])
        for (let route of mtr) {
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
        return mtr
    } catch (err) {
        console.error(chalk.red(`[mtr] Error while scraping MTR: ${err}`))
    }
}

export default fetchMTR
