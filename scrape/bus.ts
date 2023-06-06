import axios from 'axios';
import axiosRetry from 'axios-retry'
import axiosThrottle from 'axios-request-throttle'
import chalk from 'chalk';
import papa from 'papaparse';
import sleep from './sleep'
import { BusRoute, BusStop, Timetable } from '../typescript/interfaces';
import { createStop, createRoute } from './create'
// For Dev purpose only
/*
import busesResponse from '../dev/JSON_BUS.json';
import fs from 'fs'
*/

const PAPACONFIG = {
    header: true,
    skipEmptyLines: true,
}
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
            if (item.properties.companyCode == 'NLB' || item.properties.companyCode == 'LRTFeeder' || item.properties.routeNameC.indexOf('K') == 0){ //NLB and LRTFeeder buses will be implemented later
                return buses                
            }
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
        // Changes company of buses starting with K into mtr
        buses = await implementMTR(buses);
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
    axiosThrottle.use(axios, { requestsPerSecond: 10 });
    const ctbBuses = buses.filter(bus => bus.company.length == 1 && (bus.company.includes('CTB') || bus.company.includes('NWFB')));
    console.info(chalk.blue(`[bus] Now implementing CTB routes`))
    try {
        // Create Array for fetching all route data
        const ctbIdReq = ctbBuses.map(async (ctbBus) => {
            const company =
                (ctbBus.company.includes('CTB')) ? 'CTB' :
                    (ctbBus.company.includes('NWFB')) ? 'NWFB' : null;
            const direction = (ctbBus.direction == 1) ? 'outbound' : 'inbound'; //Direction 1 = outbound, 2 = inbound
            await sleep(100);
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
        console.info(chalk.blue(`[bus] Now getting all CTB and NWFB stop ids`))
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
/*
const implementNLB = async (buses: BusRoute[]): Promise<BusRoute[]> => {
    const checkParenthesis = /\(.*$/; // Remove parenthesis due to different naming
    try {
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
                        altId: route.routeId,
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
                    const { data: newRouteStops } = await axios(`https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=${route.altId}`);
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
        // Supplement stop ids from NLB buses
        const NLBBuses = buses.filter(route => route.company.includes('NLB'));
        console.log(NLBBuses.length)
        const stopReq = NLBBuses.map(route => axios(`https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=${route.altId}`));
        let stopData = await axios.all(stopReq);
        for (let i = 0; i < NLBBuses.length; i++) {
            let targetStops = NLBBuses[i].stops
            if (stopData[i].data.stops.length == 0) {
                console.log(`${NLBBuses[i].routeNo} with id ${NLBBuses[i].altId} not found`)
                continue
            }
            for (let j = 0; j < targetStops.length; j++) {
                if (stopData[i].data.stops[j]) {
                    targetStops[j].altId = stopData[i].data.stops[j].stopId
                } else {
                    // console.log(`${NLBBuses[i].routeNo} stop ${j} not found`)
                }
            }
        }
        return buses
    } catch (err) {
        console.error(chalk.red(`[bus] Error while implementing NLB API: ${err}`));
        return buses
    }
}
*/ 

const implementNLB = async(buses:BusRoute[]): Promise<BusRoute[]> => {
    try{
        console.log(chalk.blue('[bus] Now implementing NLB routes'))
        let NLBBuses: BusRoute[] = [];
        const originRegex = /^.*\>/;
        const destRegex = /\>.*$/;
        const {data: NLBRoutes} = await axios('https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list');
        for (let route of NLBRoutes.routes){
            let sameRouteNoExist = NLBBuses.some(bus => bus.routeNo == route.routeNo)
            let newRoute: BusRoute = {
                type: 'bus',
                company: ['NLB'],
                routeId: route.routeId,
                routeNo: route.routeNo,
                direction: sameRouteNoExist ? 2 : 1,
                specialType: 0,
                serviceMode: (route.overnightRoute == 1) ? 'N' : (route.specialRoute == 1) ? 'T' : 'R',
                originTC: route.routeName_c.match(originRegex)[0].replace(' >', ''),
                originEN: route.routeName_e.match(originRegex)[0].replace(' >', ''),
                destTC: route.routeName_c.match(destRegex)[0].replace('> ', ''),
                destEN: route.routeName_e.match(destRegex)[0].replace('> ', ''),
                infoLinkEN: `https://www.nlb.com.hk/route/detail/${route.routeId}`,
                infoLinkTC: `https://www.nlb.com.hk/route/detail/${route.routeId}`,
                starred: false,
                stops: []
            }
            NLBBuses.push(newRoute);
        }
        const NLBStopsReq = NLBBuses.map(bus => axios(`https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=${bus.routeId}`))
        const NLBStopData = await axios.all(NLBStopsReq);
        for (let i = 0; i < NLBStopData.length; i++){
            let data = NLBStopData[i].data.stops;
            let stops: BusStop[] = [];
            for (let j = 0; j < data.length; j++){
                let newStop: BusStop = {
                    stopId: data[j].stopId,
                    seq: j + 1,
                    nameTC: data[j].stopName_c,
                    nameEN: data[j].stopName_e,
                    coord: [data[j].longitude, data[j].latitude],
                    etas: []
                }
                stops.push(newStop);
            }
            NLBBuses[i].stops = stops
        }
        buses = [...buses, ...NLBBuses];
        return buses
    } catch (err){
        console.error(chalk.red('[bus] Error while implementing NLB Buses: ' + err))
        return buses
    }
}
/*
const implementMTR = async (buses: BusRoute[]): Promise<BusRoute[]> => {
    try {
        console.info(chalk.blue('[bus] Now implementing MTR bus routes'))
        const { data: mtrBusResponse } = await axios('https://opendata.mtr.com.hk/data/mtr_bus_stops.csv')
        const mtrBusData: any[] = papa.parse(mtrBusResponse, PAPACONFIG).data;
        let mtrBuses: BusRoute[] = buses.filter(bus => (bus.routeNo.indexOf('K') == 0 && bus.routeNo.length <= 5) || bus.company.includes('LRTFeeder'))
        mtrBuses.forEach(route => {
            route.company = ['LRTFeeder']
        })
        for (let item of mtrBusData) {
            let { ROUTE_ID: routeNo, DIRECTION: direction, STATION_ID: stationId, STATION_SEQNO: seq, STATION_LATITUDE: latitude, STATION_LONGITUDE: longitude, STATION_NAME_CHI: nameTC, STATION_NAME_ENG: nameEN } = item;
            direction = (direction == 'I') ? 1 : 2;
            let index = mtrBuses.findIndex(route => route.routeNo == routeNo && route.direction == direction);
            if (index == -1) {
                index = mtrBuses.findIndex(route => route.routeNo == routeNo && route.direction == 1)
            }
            let targetBus = mtrBuses[index];
            targetBus.stops[seq - 1] = {
                seq: seq,
                coord: [longitude, latitude],
                stopId: stationId,
                nameTC: nameTC,
                nameEN: nameEN,
                etas: []
            }
        }
        return buses;
    } catch (err) {
        console.error(chalk.red(`[bus] Error while implementing MTR buses API: ${err}`));
        return buses
    }
}
*/

const implementMTR = async (buses: BusRoute[]): Promise<BusRoute[]> => {
    try {
        console.info(chalk.blue('[bus] Now implementing MTR bus routes'));
        const mtrBuses: BusRoute[] = [];
        const { data: mtrBusResponse } = await axios('https://opendata.mtr.com.hk/data/mtr_bus_stops.csv')
        const mtrBusData: any[] = papa.parse(mtrBusResponse, PAPACONFIG).data;
        for (let item of mtrBusData){
            let {ROUTE_ID: routeNo, DIRECTION: direction, STATION_SEQNO: seq, STATION_ID: stopId, STATION_LATITUDE: latitude, STATION_LONGITUDE: longitude, STATION_NAME_CHI: nameTC, STATION_NAME_ENG: nameEN} = item;
            direction = (direction == 'O') ? 1 : 2;
            const index = mtrBuses.findIndex(bus => bus.routeNo == routeNo && bus.direction == direction)
            let newStop: BusStop = {
                coord: [longitude, latitude],
                seq: seq,
                nameEN: nameEN,
                nameTC: nameTC,
                stopId: stopId,
                etas: []
            }
            if (index != -1){
                mtrBuses[index].stops.push(newStop)
            }else {
                let newRoute: BusRoute = {
                    type: 'bus',
                    company: ['LRTFeeder'],
                    routeId: 'mtr' + routeNo,
                    routeNo: routeNo,
                    direction: direction,
                    serviceMode: 'R',
                    specialType: 1,
                    originEN: '',
                    originTC: '',
                    destEN: '',
                    destTC: '',
                    infoLinkEN: `https://www.mtr.com.hk/en/customer/services/searchBusRouteDetails.php?routeID=${routeNo}`,
                    infoLinkTC: `https://www.mtr.com.hk/ch/customer/services/searchBusRouteDetails.php?routeID=${routeNo}`,
                    stops: [newStop],
                    starred: false
                }
                mtrBuses.push(newRoute);
            };
        };
        const {data: mtrBusRouteResponse}  = await axios('https://opendata.mtr.com.hk/data/mtr_bus_routes.csv')
        const mtrBusRouteData: any[] = papa.parse(mtrBusRouteResponse, PAPACONFIG).data;
        const tcOriginRegex = /^.*至/;
        const tcDestRegex = /至.*$/;
        const enOriginRegex = /^.*to/;
        const enDestRegex = /to.*$/;
        let mtrBusRoute:any [] = []
        for (const item of mtrBusRouteData){
            let {ROUTE_ID: routeNo, ROUTE_NAME_CHI: nameTC, ROUTE_NAME_ENG: nameEN} = item;
            mtrBusRoute.push({
                routeNo: routeNo,
                originTC: nameTC.match(tcOriginRegex)[0].replace('至', ''),
                originEN: nameEN.match(enOriginRegex)[0].replace(' to', ''),
                destTC: nameTC.match(tcDestRegex)[0].replace('至', ''),
                destEN: nameEN.match(enDestRegex)[0].replace('to ', '')
            })
        }
        for (let bus of mtrBuses){
            let targetBus = mtrBusRoute.find(item => item.routeNo == bus.routeNo);
            if (bus.direction == 1){
                bus.originTC = targetBus.originTC;
                bus.originEN = targetBus.originEN;
                bus.destTC = targetBus.destTC;
                bus.destEN = targetBus.destEN;
            } else {
                bus.originTC = targetBus.destTC;
                bus.originEN = targetBus.destEN;
                bus.destTC = targetBus.originTC;
                bus.destEN = targetBus.originEN;
            }
        }
        buses = [...buses, ...mtrBuses];
        return buses
    } catch (err) {
        console.error(chalk.red(`[bus] Error while implementing MTR buses API: ${err}`));
        return buses
    }
}

export default fetchBuses
