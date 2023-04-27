import axios from 'axios';
import axiosRetry from 'axios-retry'
import chalk from 'chalk'
import { FerryRoute, Stop } from '../typescript/interfaces'
import { createStop, createRoute } from './create'

// For Dev purpose only
// import busesResponse from '../dev/JSON_BUS.json';

axiosRetry(axios, { retries: 3 });

const fetchFerry = async () => {
    console.info(chalk.blue(`[scrape] Start fetching ferries`))
    try {
        const ferryResponse = await axios('https://static.data.gov.hk/td/routes-fares-geojson/JSON_FERRY.json'); //Get all ferry information from data.gov.hk
        const ferryObj = ferryResponse.data.features
        // const busesObj = busesResponse.features;
        let ferries: FerryRoute[] = ferryObj.reduce(function (ferries: FerryRoute[], item: any) {
            //reduce(function (accumulator, currentValue) { ... }, initialValue)
            const newStop = createStop<Stop>(item);
            const checkIndex = ferries.findIndex(ferry => ferry.routeId == item.properties.routeId && ferry.direction == item.properties.routeSeq); //Check if route of current stop is stored
            if (checkIndex == -1) { //Create route if not found
                const newFerryRoute = createRoute<FerryRoute>(item, 'ferry');
                newFerryRoute.stops.push(newStop);
                ferries.push(newFerryRoute as FerryRoute);
            } else { //Push the new stop to pre-existing route
                ferries[checkIndex].stops.push(newStop);
            }
            return ferries;
        }, []); //Initial value for reduce
        return ferries;
    }
    catch (err) {
        console.error(chalk.red(`[scrape] Error while scraping ferry: ${err}`));
    }
}

export default fetchFerry