import axios from 'axios'
import fs from 'fs'

let memory: any = {}

fs.readFile('./coord.json', 'utf-8', (err, data) => {
    if (!err && data) {
        memory = JSON.parse(data)
    }
})

const toWSG = async (northings: number, eastings: number) => {
    const key = `N${Number(northings)}E${Number(eastings)}`
    if (memory[key]) {
        return memory[key]
    } else {
        const { data: wsgData } = await axios(
            `http://www.geodetic.gov.hk/transform/v2/?inSys=hkgrid&outSys=wgsgeog&n=${northings}&e=${eastings}`
        )
        saveResult(key, wsgData)
        return [wsgData.wgsLong, wsgData.wgsLat]
    }
}

const saveResult = async (key: string, data: any) => {
    memory[key] = data
    fs.writeFile('./coord.json', 'utf-8', () => {})
}

export default toWSG
