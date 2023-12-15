import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { Route, Stop } from '../typescript/interfaces'
import fs from 'fs'
import sha256 from 'sha256'

interface Cache {
    timestamp: number
    data: AxiosResponse
}
const cache = new Map()
const simpleCache = (axios: AxiosInstance) => {
    return async (url: string) => {
        const key = sha256(url)
        if (cache.has(key)) {
            const value: Cache = cache.get(key)
            const timeNow = Date.now()
            if (Number(timeNow) - Number(value.timestamp) <= 20 * 1000) {
                return value.data
            }
        }
        const res = await axios.get(url)
        cache.set(key, { timestamp: Date.now(), data: res })
        return cache.get(key).data
    }
}

const axiosCache = simpleCache(axios)
const convertTime = (string: string) => {
    if (string === 'Arriving' || string === '-') {
        return 0
    } else {
        return parseInt(string.replace(' min', ''))
    }
}

export default async function fetchLightRailETA(
    routeId: string,
    direction: 1 | 2
) {
    try {
        const lightRailRaw = await fs.promises.readFile(
            './public/fullJSON/lightRail.json',
            { encoding: 'utf-8' }
        )
        const lightRailData = await JSON.parse(lightRailRaw)
        const targetRoute = lightRailData.filter(
            (route: Route) =>
                route.routeId === routeId && route.direction == direction
        )
        if (targetRoute.length > 0) {
            const { destEN, stops } = targetRoute[0]
            const stopIdList = stops.map((stop: Stop) => stop.stopId)
            const promiseList = stopIdList.map((id: string) =>
                axiosCache(
                    `https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${id}`
                )
            )
            const resList = await Promise.all(promiseList)
            let resData = resList.map((res: AxiosResponse) => {
                // Grab Station id for identification
                const stationId = res.config.url?.replace(
                    'https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=',
                    ''
                )
                // Throw error if platform_list is undefined
                if (res.data.platform_list === undefined) {
                    throw new Error('platform_list is undefined')
                }
                // Get route_list from platform_list and then flatten the array
                const resData = res.data.platform_list
                    .map((item: any) => item.route_list)
                    .flat()
                // Filter every route to find target Data, then map relevant data into array
                const targetData = resData
                    .filter(
                        (item: any) =>
                            item['route_no'] === routeId &&
                            item['dest_en'] === destEN
                    )
                    .map((item: any) => convertTime(item.time_en))
                return { stationId: stationId, etas: targetData }
            })
            return resData
        } else {
            throw new Error('Route Number not found')
        }
    } catch (err) {
        // console.error(err)
        return []
    }
}
