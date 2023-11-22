import fs from 'fs'
import chalk from 'chalk'
import axios from 'axios'
import sha256 from 'sha256'
import axiosRetry from 'axios-retry'

axiosRetry(axios, { retries: 3 })

// Search for file in cache folder, return true if file is readable and writable
const cacheExist = async (filename: string) => {
    try {
        await fs.promises.access(
            `./cache/${filename}`,
            fs.constants.R_OK | fs.constants.W_OK
        )
        return true
    } catch {
        return false
    }
}

const getRes = async (filename: string, url: string) => {
    //Fetch remote resources then compare with local cache with hash, will return both cacheUpdated(boolean) and data
    if (await cacheExist(filename)) {
        try {
            const cacheRes = await fs.promises.readFile(
                `./cache/${filename}`,
                'utf-8'
            )
            const { data: remoteRes } = await axios(url)
            const resType = typeof remoteRes === 'object' ? 'json' : 'txt'
            const cacheHash = sha256(cacheRes)
            const remoteHash =
                resType === 'json'
                    ? sha256(JSON.stringify(remoteRes))
                    : sha256(remoteRes)
            if (cacheHash === remoteHash) {
                if (resType === 'json') {
                    return {
                        cacheUpdate: true,
                        data: JSON.parse(cacheRes),
                    }
                } else {
                    return {
                        cacheUpdate: true,
                        data: cacheRes,
                    }
                }
            } else {
                if (resType === 'json') {
                    await fs.promises.writeFile(
                        `./cache/${filename}`,
                        JSON.stringify(remoteRes),
                        'utf-8'
                    )
                } else {
                    await fs.promises.writeFile(
                        `./cache/${filename}`,
                        remoteRes,
                        'utf-8'
                    )
                }
                return {
                    cacheUpdate: false,
                    data: remoteRes,
                }
            }
        } catch (err) {
            console.error(chalk.red(`[cache] err`))
            return {
                cacheUpdated: false,
                data: {},
            }
        }
    } else {
        let res: any
        try {
            const data = await axios(url)
            res = data.data
        } catch (err) {
            console.error(chalk.red(`[axios] err`))
        }
        if (res) {
            if (typeof res === 'object') {
                await fs.promises.writeFile(
                    `./cache/${filename}`,
                    JSON.stringify(res),
                    'utf-8'
                )
            } else {
                await fs.promises.writeFile(`./cache/${filename}`, res, 'utf-8')
            }
        }
        return {
            cacheUpdate: false,
            data: res,
        }
    }
}

export default getRes
