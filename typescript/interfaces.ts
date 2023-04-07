import * as ts from './types'

// Response related interface
export interface genericResponse {
    success: boolean;
    data?: any | any[]
}

// Route related interface
export interface Route {
    type: 'bus' | 'minibus' | 'ferry' | 'mtr';
    routeId: ts.RouteId;
    routeNo: string;
    direction: number;
    serviceMode: string;
    specialType: string;
    journeyTime: number;
    fullFare: string;
    originTC: string;
    originEN: string;
    destTC: ts.StopName;
    destEN: ts.StopName;
    infoLink: string;
    starred: boolean;
}

export interface BusRoute extends Route {
    company: string[];
    altId?: string | number;
    stops: BusStop[];
}

export interface Stop {
    stopId: ts.StopId;
    coord: number[];
    seq: number;
    nameTC: ts.StopName;
    nameEN: ts.StopName;
    etas?: {
        message: string;
        value: number
    }[]
}

export interface BusStop extends Stop {
    timetable?: Timetable[]
}

interface Timetable{
    title: string;
    details: {
        period: string;
        freq: string | number;
    }[]
}