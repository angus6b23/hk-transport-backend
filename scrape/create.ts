import { BusRoute, FerryRoute, MTRRoute, MinibusRoute, Route, Stop, TramRoute, MTRStop } from '../typescript/interfaces';
import { TransportType } from '../typescript/types';

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
    let { companyCode, routeNameE: routeNo, routeId, serviceMode, specialType, hyperlinkE: infoLinkEN, hyperlinkC: infoLinkTC, fullFare, routeSeq: direction, journeyTime, district, routeNameC: routeNameTC } = item.properties; //Deconstruct item;
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
        infoLinkEN: infoLinkEN,
        infoLinkTC: infoLinkTC,
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
    if (type == 'minibus'){
        let newMinibusRoute: MinibusRoute = {
            ...newRoute,
            district: district,
            stops: []
        }
        return newMinibusRoute as T;
    }
    if (type == 'ferry'){
        let newFerryRoute: FerryRoute = {
            ...newRoute,
            district: district,
            routeNameEN: routeNo,
            routeNameTC: routeNameTC,
            stops: []
        }
        return newFerryRoute as T;
    }
    if (type == 'tram'){
        let newTramRoute: TramRoute = {
            ...newRoute,
            routeNameEN: routeNo,
            routeNameTC: routeNameTC,
            originTC: originTC.replace(/\(持有.*\)$/, ''),
            originEN: originEN.replace(/\(\$2.*\)$/, ''),
            destTC: destTC.replace(/\(持有.*\)$/, ''),
            destEN: destEN.replace(/\(\$2.*\)$/, ''),
            stops: []
        }
        return newTramRoute as T;
    }
    return newRoute as T
}

const createMTRRoute = (item: any): MTRRoute => {
    let newMTRRoute: MTRRoute = {
        type: 'mtr',
        routeId: item['Line Code'],
        routeNameTC: getMTRRouteNameTC(item['Line Code']),
        routeNameEN: getMTRRouteNameEN(item['Line Code']),
        color: getMTRColor(item['Line Code']),
        direction: (item['Direction'] === 'DT' ? 1 : 2),
        stops: []
    }
    return newMTRRoute
}

const createLRRoute = (item: any): MTRRoute => {
    let newLRRoute: MTRRoute = {
        type: 'lightRail',
        routeId: item['Line Code'],
        routeNameTC: item['Line Code'],
        routeNameEN: item['Line Code'],
        direction: item['Direction'],
        stops: []
    }
    return newLRRoute
}

const createMTRStop = (item: any): MTRStop => {
    return {
        stopId: item['Station ID'],
        seq: Number(item['Sequence']),
        nameTC: item['Chinese Name'],
        nameEN: item['English Name'],
        code: item['Station Code'],
        etas: []
    }
}

const getMTRRouteNameTC = (code: string): string => {
    switch(code){
        case 'AEL':
            return '機場快綫'
        case 'DRL':
            return '迪士尼綫'
        case 'EAL':
            return '東鐵綫'
        case 'ISL':
            return '港島綫'
        case 'KTL':
            return '觀塘綫'
        case 'TML':
            return '屯馬綫'
        case 'TCL':
            return '東涌綫'
        case 'TKL':
            return '將軍澳綫'
        case 'TWL':
            return '荃灣綫'
        case 'SIL':
            return '南港島綫'
        default:
            return '未知'
    }
}
const getMTRRouteNameEN = (code: string): string => {
    switch(code){
        case 'AEL':
            return 'Airport Express'
        case 'DRL':
            return 'Disneyland Resort Line'
        case 'EAL':
            return 'East Rail Line'
        case 'ISL':
            return 'Island Line'
        case 'KTL':
            return 'Kwun Tong Line'
        case 'TML':
            return 'Tuen Ma Line'
        case 'TCL':
            return 'Tung Chung Line'
        case 'TKL':
            return 'Tseung Kwan O Line'
        case 'TWL':
            return 'Tsuen Wan Line'
        case 'SIL':
            return 'South Island Line'
        default:
            return 'Unknown'
    }
}

const getMTRColor = (code: string): string => {
    switch (code) {
        case 'AEL':
            return '00888e'
        case 'DRL':
            return 'eb6ea5'
        case 'EAL':
            return '5eb7e8'
        case 'ISL':
            return '0075c2'
        case 'KTL':
            return '00a040'
        case 'TML':
            return '9c2e00'
        case 'TCL':
            return 'f3982d'
        case 'TKL':
            return '7e3c93'
        case 'TWL':
            return 'e60012'
        case 'SIL':
            return 'cbd300'
        default:
            return 'ffffff'
    }
}
export {createStop, createRoute, createMTRRoute, createMTRStop, createLRRoute}