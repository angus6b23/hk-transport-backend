import axios, { AxiosResponse } from 'axios'
import { Route, Stop } from '../typescript/interfaces'
import { setupCache } from 'axios-cache-interceptor/dev'
import fs from 'fs'

const axiosCache = setupCache(axios, {
    debug: console.log
})
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
                axiosCache.get(
                    `https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${id}`,
                    {
                        cache: {
                            ttl: 1000 * 20,
                        },
                    }
                )
            )
        const startTime = performance.now()
            const resList = await Promise.all(promiseList)
            const cacheCount = resList.reduce((acc, cur) => {
                if (cur.cached){
                    return acc + 1
                } else {
                    return acc
                }
            }, 0)
            const endTime = performance.now()
            console.log(`Time spent: ${endTime - startTime}, cahced: ${cacheCount}`)
            let resData = resList.map((res: AxiosResponse) => {
                // Grab Station id for identification
                const stationId = res.config.url?.replace(
                    'https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=',
                    ''
                )
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
        console.error(err)
        return []
    }
}
