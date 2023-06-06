import axios from 'axios';
import axiosRetry from 'axios-retry'
import axiosThrottle from 'axios-request-throttle'
import chalk from 'chalk';
import { MinibusRoute, Stop } from '../typescript/interfaces';
import { createStop, createRoute } from './create'

axiosRetry(axios, { retries: 3 });
axiosThrottle.use(axios, { requestsPerSecond: 10 });

const fetchMinibus = async () => {
	console.info(chalk.blue(`[minibus] Start fetching minibuses`));
	try {
		const minibusesResponse = await axios('https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json'); //Get all buses information from data.gov.hk
		const minibusesObj = minibusesResponse.data.features
		// const busesObj = busesResponse.features;
		let minibuses: MinibusRoute[] = minibusesObj.reduce(function (minibuses: MinibusRoute[], item: any) {
			//reduce(function (accumulator, currentValue) { ... }, initialValue)
			const newStop = createStop<Stop>(item);
			const checkIndex = minibuses.findIndex(minibus => minibus.routeId == item.properties.routeId && minibus.direction == item.properties.routeSeq); //Check if route of current stop is stored
			if (checkIndex == -1) { //Create route if not found
				const newMinibusRoute = createRoute<MinibusRoute>(item, 'minibus');
				newMinibusRoute.stops.push(newStop);
				minibuses.push(newMinibusRoute);
			} else { //Push the new stop to pre-existing route
				minibuses[checkIndex].stops.push(newStop);
			}
			return minibuses;
		}, []); //Initial value for reduce

		// Get all stops of minibuses
		minibuses = await getRouteStops(minibuses);
		// Get all stop coords
		minibuses = await getStopCoords(minibuses)
		return minibuses
	} catch (err) {
		console.error(chalk.red(`[minibus] Error while scraping minibus: ${err}`));
	}
}

const getRouteStops = async (minibuses: MinibusRoute[]) => {
	try {
		console.info(chalk.blue(`[minibus] Start fetching minibus route-stops`));
		const stopReq = minibuses.map(route => axios.get(`https://data.etagmb.gov.hk/route-stop/${route.routeId}/${route.direction}`))
		const stopRes = await axios.all(stopReq);
		for (let i = 0; i < stopRes.length; i++) {
			const data = stopRes[i].data.data.route_stops;
			const newStopList: Stop[] = [];
			if (data) {
				for (let item of data) {
					const newStop: Stop = {
						seq: item.stop_seq,
						stopId: item.stop_id,
						nameEN: item.name_en,
						nameTC: item.name_tc,
						etas: []
					}
					newStopList.push(newStop);
				}
			}
			if (newStopList.length == 0) {
				console.warn(chalk.yellow(`[minibus] Minibus No ${minibuses[i].routeNo} stops not found`))
			}
			minibuses[i].stops = (newStopList.length > 0) ? newStopList : minibuses[i].stops;
		}
	} catch (err) {
		console.error(chalk.red(`[minibus] Error while getting minibuses stops: ${err}`))
	}
	return minibuses;
}

const getStopCoords = async (minibuses: MinibusRoute[]) => {

	try {
		console.info(chalk.blue('[minibus] Start fetching minibus stop coords'))
		let stopIdList = new Set();
		for (const minibus of minibuses) {
			for (let stop of minibus.stops) {
				stopIdList.add(stop.stopId)
			}
		}
		let batchSize = 0
		/*
			 const allReq = Array.from(stopIdList).map(async(id) => {
			 if (batchSize % 3 == 0){ //Try to wait for certain period for every 10 request
			 await sleep(1 * 1000)
			 }
			 batchSize++
			 return axios.get(`https://data.etagmb.gov.hk/stop/${id}`);
			 });
		 */
		const allReq = Array.from(stopIdList).map(id => axios.get(`https://data.etagmb.gov.hk/stop/${id}`));
			const allRes = await axios.all(allReq);
		for (const res of allRes) {
			const id = res.request.path.replace('/stop/', '');
			if (res.data.data.coordinates){
				const long = res.data.data.coordinates.wgs84.longitude;
				const lat = res.data.data.coordinates.wgs84.latitude;
				const coord = [long, lat];
				const matchingRoute = minibuses.filter(route => {
					return route.stops.some(stop => stop.stopId == id)
				});
				for (let route of matchingRoute){
					const index = route.stops.findIndex(stop => stop.stopId == id);
					route.stops[index].coord = coord;
				}
			}
		}
		return minibuses
	} catch (err) {
		console.log(chalk.red(`[minibus] Error while getting minibus stops coord: ${err}`))
		return minibuses
	}
}

export default fetchMinibus
