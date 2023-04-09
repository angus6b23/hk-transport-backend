import axios from 'axios';
import chalk from 'chalk'
import { BusRoute, BusStop, Route, Stop, Timetable } from '../typescript/interfaces';
import { TransportType } from '../typescript/types';
// For Dev purpose only
import busesResponse from '../dev/JSON_BUS.json';
// import { routes as nlbRoutes } from '../dev/nlb-route.json'

const createStop = <T>(item: any): T => {
    let { stopNameC: nameTC, stopNameE: nameEN, stopId: id, stopSeq: seq } = item.properties;
    let { coordinates: coord } = item.geometry;
    let newStop: Stop = {
        nameTC: nameTC.replace('<br>', ''),
        nameEN: nameEN.replace('<br>', ''),
        stopId: id,
        seq: seq,
        coord: coord,
        etas: []
    };
    return newStop as T
}

const createRoute = <T>(item: any, type: TransportType): T => {
    let { companyCode, routeNameE: routeNo, routeId, serviceMode, specialType, hyperlinkE: infoLink, fullFare, routeSeq: direction, journeyTime } = item.properties; //Deconstruct item;
    let originEN, originTC, destEN, destTC;
    if (item.properties.routeSeq == 1) { //Direction 1 = Inbound
        destTC = item.properties.locEndNameC;
        destEN = item.properties.locEndNameE;
        originTC = item.properties.locStartNameC;
        originEN = item.properties.locStartNameE;
    } else { //Direction 2 = Outbound
        destTC = item.properties.locStartNameC;
        destEN = item.properties.locStartNameE;
        originTC = item.properties.locEndNameC;
        originEN = item.properties.locEndNameE;
    }
    let newRoute: Route = {
        type: type,
        routeId: routeId,
        routeNo: routeNo,
        serviceMode: serviceMode,
        specialType: specialType,
        infoLink: infoLink,
        fullFare: fullFare,
        direction: direction,
        journeyTime: journeyTime,
        destTC: destTC,
        destEN: destEN,
        originTC: originTC,
        originEN: originEN,
        starred: false,
    }
    if (type == 'bus') {
        const company = companyCode.split('+');
        let newBusRoute: BusRoute = {
            ...newRoute,
            company: company,
            stops: []
        }
        return newBusRoute as T;
    }
    return newRoute as T
}

const fetchBuses = async () => {
    console.log(chalk.blue(`[scrape] Start fetching buses`))
    try {
        // const busesResponse = await axios('https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json'); //Get all buses information from data.gov.hk
        // const busesObj = busesResponse.data.features;
        const busesObj = busesResponse.features
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
        // Implement altId and additional routes from NLB API
        buses = await implementNLB(buses)

        return buses;
    }
    catch (err) {
        console.error(err);
    }
}

const implementKMB = async (buses: BusRoute[]): Promise<BusRoute[]> => {
    // Get service modes from kmb
    try {
        console.info(chalk.blue(`[scrape] Now implementing KMB routes`));
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
            console.log(chalk.grey(`Fetching ${kmbBus.routeNo}: ${kmbBus.originTC} > ${kmbBus.destTC}`))
            const specialType = (kmbBus.specialType == 0) ? 1 : kmbBus.specialType;
            const timetable = timetableResponse.data.data[`0${specialType}`];
            const newTimeTable: Timetable[] = [];
            if (timetable) {
                for (const slot of timetable) {
                    const checkIndex = newTimeTable.findIndex(nslot => nslot.title === slot.DayType.replaceAll(' ', ''));
                    if (checkIndex === -1) {
                        newTimeTable.push({
                            title: slot.DayType.replaceAll(' ', ''),
                            details: [{
                                period: slot.BoundTest1,
                                freq: slot.BoundTime1
                            }]
                        })
                    } else {
                        newTimeTable[checkIndex].details.push({
                            period: slot.BoundTest1,
                            freq: slot.BoundTime1
                        })
                    }
                }
                kmbBus.timetable = newTimeTable;
            }
        }
        return buses
    } catch (err) {
        console.error(chalk.red(`[scrape] Error while implementing KMB API: ${err}`));
        return buses
    }
}

const implementNLB = async (buses: BusRoute[]): Promise<BusRoute[]> => {
    const checkParenthesis = /\(.*$/; // Remove parenthesis due to different naming
    try {
        // axiosRetry(axios, { retry: 3 });
        console.info(chalk.blue(`[scrape] Now implementing NLB routes`))
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
                        infoLink: 'https://www.nlb.com.hk/route?q=' + route.routeNo,
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
                    for (let i = 0; i < newRouteStops.length; i++) {
                        const newStop: BusStop = {
                            nameTC: newRouteStops[i].stopName_c,
                            nameEN: newRouteStops[i].stopName_w,
                            stopId: newRouteStops[i].stopId,
                            seq: i + 1,
                            coord: [newRouteStops[i].latitude, newRouteStops[i].longitude],
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
        console.error(chalk.red(`[scrape] Error while implementing NLB API: ${err}`));
        return buses
    }
}

export default fetchBuses