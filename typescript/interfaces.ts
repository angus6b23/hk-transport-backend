import * as ts from './types'

// Response related interface
export interface genericResponse {
    success: boolean;
    data?: any | any[]
}

export interface Config {
    server: {
        port: number;
    },
    scraper: {
        cron: string;
        forceRebuild: number;
        chunkSize: number;
    }
}

// Route related interface
export interface Route {
    type: ts.TransportType;
    routeId: ts.RouteId;
    routeNo: string;
    direction: number;
    serviceMode: string;
    specialType: number;
    journeyTime: number;
    fullFare: string;
    originTC: string;
    originEN: string;
    destTC: ts.StopName;
    destEN: ts.StopName;
    infoLinkEN: string;
    infoLinkTC: string;
    starred: boolean;
}

export interface BusRoute extends Route {
    company: string[];
    altId?: string | number;
    stops: BusStop[];
    timetable?: Timetable[]
}

export interface MinibusRoute extends Route {
    district: string;
    stops: Stop[]
}

export interface FerryRoute extends Route {
    district: string;
    routeNameEN: string;
    routeNameTC: string;
    stops: Stop[];
}

export interface TramRoute extends Route {
    routeNameEN: string;
    routeNameTC: string;
    stops: Stop[];
}

export interface MTRRoute {
    type: ts.TransportType;
    routeId: ts.RouteId;
    routeNameTC: string;
    routeNameEN: string;
    direction: number;
    originCode?: string;
    originTC?: string;
    originEN?: string;
    destCode?: string;
    destTC?: string;
    destEN?: string;
    stops: MTRStop[];
    color?: string;
}

export interface Stop {
    stopId: ts.StopId;
    coord?: number[];
    seq: number;
    nameTC: ts.StopName;
    nameEN: ts.StopName;
    etas?: {
        message: string;
        value: number
    }[]
}

export interface BusStop extends Stop {
    altId?: number | string;
}

export interface MTRStop extends Stop{
    code: string;
}

export interface Timetable {
    title: string;
    details: {
        period: string;
        freq: string | number;
    }[]
}