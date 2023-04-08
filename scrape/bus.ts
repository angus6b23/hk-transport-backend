import axios from 'axios';
import chalk from 'chalk'
import { BusRoute, BusStop, Route, Stop } from '../typescript/interfaces';
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

const fetchBuses = async() => {
    console.log(chalk.blue(`[scrape] Start fetching buses`))
    const checkParenthesis = /\(.*$/; // Remove parenthesis due to different naming
    try {
        // const busesResponse = await axios('https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json'); //Get all buses information from data.gov.hk
        // const busesObj = busesResponse.data.features;
        const busesObj = busesResponse.features
        const buses: BusRoute[] = busesObj.reduce(function (buses: BusRoute[], item: any) { 
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
        // Get service modes from kmb
        try {
            console.info(chalk.blue(`[scraper] Now implementing KMB routes`))
            const kmbResponse = await axios('https://data.etabus.gov.hk/v1/transport/kmb/route/');
            const {data: kmbJson} = kmbResponse;
            
            const kmbFiltered = kmbJson.data.filter((kmb: any) => kmb.serviceType != '1');
            // Search for kmb service mode != 1
            for (const specialRoute of kmbFiltered) {
                const checkIndex = buses.findIndex(bus => bus.serviceMode != 'R' && bus.routeNo === specialRoute.route && bus.destEN.replace(checkParenthesis, '') == specialRoute.dest_en.replace(checkParenthesis, ''));
                if (checkIndex != -1) {
                    buses[checkIndex].specialType = specialRoute.service_type;
                }
            }
        } catch (err) {
            console.error(err);
        }
        // Reconstruct NLB buses
        try {
            // axiosRetry(axios, { retry: 3 });
            console.info(chalk.blue(`[scrape] Now implementing NLB routes`))
            const nlbResponse = await axios('https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list');
            const nlbRoutes = nlbResponse.data.routes
            const originRegex = /^.*\>/;
            const destRegex = /\>.*$/;
            for (const route of nlbRoutes) { //Loop for nlb Routes and try to find route with same routeNo, origin and destination
                const origin = route.routeName_e.match(originRegex)[0].replace(' >', '').replace(checkParenthesis, '');
                const dest = route.routeName_e.match(destRegex)[0].replace('> ', '').replace(checkParenthesis, '');
                const checkIndex = buses.findIndex(bus => bus.company.includes('NLB') && bus.routeNo == route.routeNo && bus.destEN.replaceAll(' ', '').includes(dest.replaceAll(' ', '')) && bus.originEN.replaceAll(' ', '').includes(origin.replaceAll(' ', '')));
                if (checkIndex != -1) {
                    buses[checkIndex].altId = route.routeId;
                } else {
                    // If not found, try to loosen the restraints to bind altId
                    const checkIndex = buses.findIndex(bus => bus.routeNo === route.routeNo && bus.company.includes('NLB'));
                    if (checkIndex != -1 ){
                        console.debug(chalk.yellow(`[scrape] NLB route ${route.routeNo} with altID ${route.routeId} binded to ${buses[checkIndex].routeId}`))
                        buses[checkIndex].altId = route.routeId;
                    } else {
                        const newNlbRoute: BusRoute = {
                            company: ['NLB'],
                            type: 'bus',
                            routeId: 'nlb' + route.routeId,
                            routeNo: route.routeNo,
                            serviceMode: 'S',
                            specialType: 'S',
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
                        const { data: newRouteStops} = await axios(`https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=${route.routeId}`);
                        for (let i = 0; i < newRouteStops.length; i++){
                            const newStop:BusStop = {
                                nameTC: newRouteStops[i].stopName_c,
                                nameEN: newRouteStops[i].stopName_w,
                                stopId: newRouteStops[i].stopId,
                                seq: i + 1,
                                coord: [newRouteStops[i].latitude, newRouteStops[i].longitude],
                                etas: []
                            }
                            newNlbRoute.stops.push(newStop);
                        }
                        console.debug(chalk.yellow(`[scrape] Created NLB Route ${newNlbRoute.routeNo}: ${newNlbRoute.originTC} => ${newNlbRoute.destTC}`));
                        buses.push(newNlbRoute);
                    }
                }
            }
            // const filteredBus = buses.filter(bus => bus.routeNo.includes('11'));
            // console.log(filteredBus)
        } catch (err) {
            console.error(err)
        }
        return buses;
    }
    catch (err) {
        console.error(err);
    }
}

export default fetchBuses
/*
const createNlb = async () => {
    try{
        console.log(chalk.blue('[scrape] Fetching nlb files'))
        const nlbRoutes: busRoute[] = []
        const {data: nlbData} = await axios('https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list');
        const stopRequests = nlbData.routes.map((route: any) => axios.get(`https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=${route.routeId}`));
        const stops: any = await axios.all(stopRequests);
        console.log(stops[0].data.stops);
        for (let i = 0; i < nlbData.length; i++){
            const originRegex = /^.*\>/;
            const destRegex = /\>.*$/;
            const originTC = nlbData.routes[i].routeName_c.match(originRegex)[0]?.replace(' >', '');
            const originEN = nlbData.routes[i].routeName_e.match(originRegex)[0]?.replace(' >', '');
            const destTC = nlbData.routes[i].routeName_c.match(destRegex)[0]?.replace('> ', '');
            const destEN = nlbData.routes[i].routeName_e.match(destRegex)[0]?.replace('> ', '');
            let newRoute: busRoute = {
                type: 'bus',
                company: ['NLB'],
                routeId: `NLB${nlbData.routes[i].routeId}`,
                routeNo: nlbData.routes[i].routeNo,
                originTC: originTC,
                originEN: originEN,
                destTC: destTC,
                destEN: destEN,
                direction: 1,
                infoLink: 'http://test.com',
                starred: false,
            }
        }
    } catch(err){
        console.error(err)
    }
}

export default createNlb
*/