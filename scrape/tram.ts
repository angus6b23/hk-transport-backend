import axios from 'axios'
import axiosRetry from 'axios-retry'
import chalk from 'chalk'
import { TramRoute, Stop } from '../typescript/interfaces'
import { createStop, createRoute } from './create'
// For Dev purpose only

axiosRetry(axios, { retries: 3 })

const fetchTram = async () => {
    console.info(chalk.blue(`[tram] Start fetching trams`))
    try {
        const tramResponse = await axios(
            'https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json'
        ) //Get all tram information from data.gov.hk
        const tramObj = tramResponse.data.features
        // const busesObj = busesResponse.features;
        let trams: TramRoute[] = tramObj.reduce(function (
            trams: TramRoute[],
            item: any
        ) {
            //reduce(function (accumulator, currentValue) { ... }, initialValue)
            const newStop = createStop<Stop>(item)
            const checkIndex = trams.findIndex(
                (tram) =>
                    tram.routeId == item.properties.routeId &&
                    tram.direction == item.properties.routeSeq
            ) //Check if route of current stop is stored
            if (checkIndex == -1) {
                //Create route if not found
                const newTramRoute = createRoute<TramRoute>(item, 'tram')
                newTramRoute.stops.push(newStop)
                trams.push(newTramRoute as TramRoute)
            } else {
                //Push the new stop to pre-existing route
                trams[checkIndex].stops.push(newStop)
            }
            return trams
        }, []) //Initial value for reduce
        return trams
    } catch (err) {
        console.error(chalk.red(`[tram] Error while scraping tram: ${err}`))
    }
}

export default fetchTram
