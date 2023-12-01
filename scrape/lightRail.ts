import axios from 'axios'
import axiosRetry from 'axios-retry'
import chalk from 'chalk'
import papa from 'papaparse'
import { GeocomData, MTRRoute, MTRStop } from '../typescript/interfaces'
import { createMTRStop, createLRRoute } from './create'
import fs from 'fs'
import {HK80ToWGS84} from '../utils/coordsConvert'

axiosRetry(axios, { retries: 3 })

const PAPACONFIG = {
    header: true,
    skipEmptyLines: true,
}

const fetchLightRail = async () => {
    console.info(chalk.blue(`[light-rail] Start fetching Light Rail`))
    try {
        let lightRailStationsCoordinates: {name: string, coordinates: number[]}[] = []
        const lrResponse = await axios(
            'https://opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv'
        ) //Get all light rail information from data.gov.hk
        const lrCSV = lrResponse?.data.replaceAll(',,,,,,\r\n', '') // Remove all empty record
        let lrData = papa.parse(lrCSV, PAPACONFIG).data // Parse the data with papa parser
        if (fs.existsSync('scrape/geocom.csv')){
            const geocomCSV = await fs.promises.readFile('scrape/geocom.csv', 'utf8');
            let geocomData: GeocomData[] = papa.parse<GeocomData>(geocomCSV, PAPACONFIG).data
            geocomData = geocomData.filter(entry => entry.TYPE === 'LRA')
            lightRailStationsCoordinates = geocomData.map((data: GeocomData) => {
                return {
                    name: data.ENGLISHNAME.replace(/^LR\-/, ''),
                    coordinates: HK80ToWGS84({ x: Number(data.EASTING), y: Number(data.NORTHING) }),
                }
            })
        }
        let lr: MTRRoute[] = lrData.reduce(function (
            lr: MTRRoute[],
            item: any
        ) {
            const newStop: MTRStop = createMTRStop(item, lightRailStationsCoordinates) // Create a stop for each Station
            const checkIndex = lr.findIndex( // Find if current line and direction exists
                                            (route) =>
                                                route.direction == item['Direction'] &&
                                                route.routeId == item['Line Code']
                                           )
                                           if (checkIndex !== -1) { // Simply push the stop to existing line
                                               lr[checkIndex].stops.push(newStop)
                                           } else { // Create a new route if the line does not exist 
                                               const newRoute: MTRRoute = createLRRoute(item)
                                               newRoute.stops.push(newStop) // Then push the stop to the new route
                                               lr.push(newRoute) // Add the route to the data set
                                           }
                                           return lr
        }, [])

        // Hydrate the origin and destination for every route
        for (let route of lr) {
            // Get the code and name from first and last station
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
            // Set the data into corresponding slot of the route
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
