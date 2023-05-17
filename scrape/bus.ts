import axios from 'axios';
import axiosRetry from 'axios-retry'
import chalk from 'chalk'
import { BusRoute, BusStop, Timetable } from '../typescript/interfaces';
import { createStop, createRoute } from './create'
// For Dev purpose only
// import busesResponse from '../dev/JSON_BUS.json';
// import fs from 'fs'

axiosRetry(axios, { retries: 3 });

const fetchBuses = async () => {
    console.info(chalk.blue(`[bus] Start fetching buses`))
    try {
        const busesResponse = await axios('https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json'); //Get all buses information from data.gov.hk
        const busesObj = busesResponse.data.features
        // For Dev purpose only
        /*
        const busesResponseClone: any = busesResponse
        const busesObj = busesResponseClone.features;
        */
        let buses: BusRoute[] = busesObj.reduce(function (buses: BusRoute[], item: any) {
            //reduce(function (accumulator, currentValue) { ... }, initialValue)
            const newStop = createStop<BusStop>(item);
            const checkIndex = buses.findIndex(bus => bus.routeId == item.properties.routeId && bus.direction == item.properties.routeSeq); //Check if route of current stop is stored
            if (checkIndex == -1) { //Create route if not found
                const newBusRoute = createRoute<BusRoute>(item, 'bus');
                newBusRoute.stops.push(newStop);
                buses.push(newBusRoute as BusRoute);
            } else { //Push the new stop to pre-existing route
                buses[checkIndex].stops.push(newStop);
            }
            return buses;
        }, []); //Initial value for reduce
        // Implement Special Routes, timetable and detailed map route from KMB API
        buses = await implementKMB(buses);
        // Implement CTB buses with changes in stop and stopId for ETA
        buses = await implementCTB(buses);
        // Implement altId and additional routes from NLB API
        buses = await implementNLB(buses);

        return buses;
    }
    catch (err) {
        console.error(chalk.red(`[bus] Error while scraping bus: ${err}`));
    }
}

const implementKMB = async (buses: BusRoute[]): Promise<BusRoute[]> => {
    // Get service modes from kmb
    try {
        console.info(chalk.blue(`[bus] Now implementing KMB routes`));
        const checkParenthesis = /\(.*$/; // Remove parenthesis due to different naming
        // Download all Kmb routes
        // Bind KMB / LMB specialType into existing routes
        const kmbResponse = await axios('https://data.etabus.gov.hk/v1/transport/kmb/route/');
        const { data: kmbJson } = kmbResponse;
        const kmbFiltered = kmbJson.data.filter((kmb: any) => kmb.serviceType != '1');
        // Search for kmb service mode != 1
        for (const specialRoute of kmbFiltered) {
            const checkIndex = buses.findIndex(bus => bus.serviceMode != 'R' && bus.routeNo === specialRoute.route && bus.destEN.replace(checkParenthesis, '').replaceAll(' ', '') == specialRoute.dest_en.replace(checkParenthesis, '').replaceAll(' ', ''));
            if (checkIndex != -1) {
                buses[checkIndex].specialType = specialRoute.service_type;
            }
        }
        // Try to bind timetable and detailed route
        const kmbBuses = buses.filter(bus => bus.company.includes('KMB') || bus.company.includes('LWB'));
        for (let kmbBus of kmbBuses) {
            const timetableResponse = await axios(`https://search.kmb.hk/KMBWebSite/Function/FunctionRequest.ashx?action=getschedule&route=${kmbBus.routeNo}&bound=${kmbBus.direction}`);
            // console.log(chalk.grey(`Fetching ${kmbBus.routeNo}: ${kmbBus.originTC} > ${kmbBus.destTC}`))
            const specialType = (kmbBus.specialType == 0) ? 1 : kmbBus.specialType;
            const timetable = timetableResponse.data.data[`0${specialType}`];
            const newTimeTable: Timetable[] = [];
            if (timetable) {
                for (const slot of timetable) {
                    const checkIndex = newTimeTable.findIndex(nslot => nslot.title === slot.DayType.replaceAll(' ', ''));
                    if (checkIndex === -1 && slot.BoundText1 && slot.BoundTime1) { // Only add to timetable if all fields are satisfied
                        newTimeTable.push({
                            title: slot.DayType.replaceAll(' ', ''),
                            details: [{
                                period: slot.BoundText1,
                                freq: slot.BoundTime1
                            }]
                        })
                    } else if (slot.BoundText1 && slot.BoundTime1) {
                        newTimeTable[checkIndex].details.push({
                            period: slot.BoundText1,
                            freq: slot.BoundTime1
                        })
                    }
                }
                kmbBus.timetable = newTimeTable;
            }
        }
        return buses
    } catch (err) {
        console.error(chalk.red(`[bus] Error while implementing KMB API: ${err}`));
        return buses
    }
}

const implementCTB = async (buses: BusRoute[]): Promise<BusRoute[]> => {
    const warningCount = {
        targetWarn: 0,
        routeWarn: 0
    }
    const ctbBuses = buses.filter(bus => bus.company.length == 1 && (bus.company.includes('CTB') || bus.company.includes('NWFB')));
    console.info(chalk.blue(`[bus] Now implementing CTB routes`))
    try {
        // Create Array for fetching all route data
        const ctbIdReq = ctbBuses.map(ctbBus => {
            const company =
                (ctbBus.company.includes('CTB')) ? 'CTB' :
                    (ctbBus.company.includes('NWFB')) ? 'NWFB' : null;
            const direction = (ctbBus.direction == 1) ? 'outbound' : 'inbound'; //Direction 1 = outbound, 2 = inbound
            return axios(`https://rt.data.gov.hk/v1.1/transport/citybus-nwfb/route-stop/${company}/${ctbBus.routeNo}/${direction}`)
        })
        // Fetch all routes,
        const ctbIdRes = (await axios.all(ctbIdReq)).map(res => res.data);
        // then map all stop ids to a single Set
        const stopSet = new Set();
        for (let res of ctbIdRes) { //Loop through all response
            for (let id of res.data) { //Loop through all stops in single response
                stopSet.add(id.stop);
            }
        }
        console.info(chalk.blue(`[bus] Now getting all ctb and nwfb stop ids`))
        // Create array for all request for stops
        const stopReq = Array.from(stopSet).map(id => axios.get(`https://rt.data.gov.hk/v1.1/transport/citybus-nwfb/stop/${id}`))
        const stopRes = await axios.all(stopReq);
        // Loop through all routes from response,
        for (let i = 0; i < ctbIdRes.length; i++) {
            let newStopList: BusStop[] = [];
            let targetRoute = ctbIdRes[i].data;
            // Then loop through all stops of corresponding route
            for (let j = 0; j < targetRoute.length; j++) {
                const targetStop = stopRes.find(axios => axios.config.url == `https://rt.data.gov.hk/v1.1/transport/citybus-nwfb/stop/${targetRoute[j].stop}`);
                const newStop: BusStop = {
                    seq: j + 1,
                    stopId: targetStop?.data.data.stop,
                    nameEN: targetStop?.data.data.name_en,
                    nameTC: targetStop?.data.data.name_tc,
                    coord: [targetStop?.data.data.long, targetStop?.data.data.lat],
                    etas: []
                }
                newStopList.push(newStop);
            }
            ctbBuses[i].stops = newStopList
            // Note: CTB api inbound and outbound is not consistent with Gov Geojson
            // Find CTB with corresponding origin and route No
            /* Old code, not working
            const checkIndex = ctbBuses.findIndex(ctbBus => ctbBus.routeNo === targetRoute[0].route && newStopList[0].nameTC.includes(ctbBus.originTC)  || ctbBus.originTC.includes(newStopList[0].nameTC.slice(0, 2)));
            if (checkIndex == -1) {
                console.log(chalk.red(`Route not found: ${ctbBuses[i].routeNo} : ${ctbBuses[i].originTC} =/= ${newStopList[0].nameTC}`));
                warningCount.routeWarn += 1;
                ctbBuses[i].stops = newStopList;
            } else {
                console.log(chalk.grey(`Found: ${ctbBuses[checkIndex].routeNo} : ${ctbBuses[checkIndex].originTC} = ${newStopList[0].nameTC} => ${ctbBuses[checkIndex].destTC}`));
                ctbBuses[checkIndex].stops = newStopList
            }
            */
        }
    } catch (err) {
        console.error(chalk.red(`[bus] Error: Implementing CTB API - ${err}`))
        return buses
    }
    // await fs.promises.writeFile('./dev/ctb.json', JSON.stringify(ctbBuses))
    return buses
}

const implementNLB = async (buses: BusRoute[]): Promise<BusRoute[]> => {
    const checkParenthesis = /\(.*$/; // Remove parenthesis due to different naming
    try {
        // axiosRetry(axios, { retry: 3 });
        console.info(chalk.blue(`[bus] Now implementing NLB routes`))
        const nlbResponse = await axios('https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list');
        const nlbRoutes = nlbResponse.data.routes
        const originRegex = /^.*\>/;
        const destRegex = /\>.*$/;
        for (const route of nlbRoutes) { //Loop for nlb Routes and try to find route with same routeNo, origin and destination
            // Route name of nlb is named as `${origin} > ${dest}`
            const origin = route.routeName_e.match(originRegex)[0].replace(' >', '').replace(checkParenthesis, '');
            const dest = route.routeName_e.match(destRegex)[0].replace('> ', '').replace(checkParenthesis, '');
            const checkIndex = buses.findIndex(bus => bus.company.includes('NLB') && bus.routeNo == route.routeNo && bus.destEN.replaceAll(' ', '').includes(dest.replaceAll(' ', '')) && bus.originEN.replaceAll(' ', '').includes(origin.replaceAll(' ', '')));
            if (checkIndex != -1) {
                buses[checkIndex].altId = route.routeId;
            } else {
                // If not found, try to reduce the restraints to bind altId
                const checkIndex = buses.findIndex(bus => bus.routeNo === route.routeNo && bus.company.includes('NLB'));
                if (checkIndex != -1) {
                    buses[checkIndex].altId = route.routeId;
                } else {
                    // Create NLB route if not found
                    const newNlbRoute: BusRoute = {
                        company: ['NLB'],
                        type: 'bus',
                        routeId: 'nlb' + route.routeId,
                        routeNo: route.routeNo,
                        serviceMode: 'S',
                        specialType: 0,
                        infoLinkEN: 'https://www.nlb.com.hk/route?q=' + route.routeNo,
                        infoLinkTC: 'https://www.nlb.com.hk/route?q=' + route.routeNo,
                        fullFare: '0',
                        direction: 1,
                        journeyTime: 0,
                        destTC: route.routeName_c.match(destRegex)[0].replace('> ', ''),
                        destEN: route.routeName_e.match(destRegex)[0].replace('> ', ''),
                        originTC: route.routeName_c.match(originRegex)[0].replace(' >', ''),
                        originEN: route.routeName_e.match(originRegex)[0].replace(' >', ''),
                        starred: false,
                        stops: []
                    }
                    // Pull stops of specific route from NLB API
                    const { data: newRouteStops } = await axios(`https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=${route.routeId}`);
                    for (let i = 0; i < newRouteStops.stops.length; i++) {
                        const newStop: BusStop = {
                            nameTC: newRouteStops.stops[i].stopName_c,
                            nameEN: newRouteStops.stops[i].stopName_e,
                            stopId: newRouteStops.stops[i].stopId,
                            seq: i + 1,
                            coord: [newRouteStops.stops[i].longitude, newRouteStops.stops[i].latitude],
                            etas: []
                        }
                        newNlbRoute.stops.push(newStop);
                    }
                    buses.push(newNlbRoute);
                }
            }
        }
        return buses
    } catch (err) {
        console.error(chalk.red(`[bus] Error while implementing NLB API: ${err}`));
        return buses
    }
}


export default fetchBuses