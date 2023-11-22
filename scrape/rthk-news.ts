import axios, { AxiosResponse } from 'axios'
import chalk from 'chalk'
import fs from 'fs'
const jsdom = require('jsdom')

class Message {
    timestamp: string
    message: string

    constructor(timestamp: string, message: string) {
        this.timestamp = timestamp
        this.message = message
    }
}
export default async function fetchRthkNews() {
    try {
        const res: AxiosResponse = await axios(
            'https://programme.rthk.hk/channel/radio/trafficnews/index.php'
        )
        const { window } = new jsdom.JSDOM(res.data)
        let messages: Message[] = []
        const messageBlock: HTMLUListElement[] =
            window.document.querySelectorAll('ul.dec')
        messageBlock.forEach((block) => {
            const message =
                block.querySelector('li.inner')?.childNodes[0].nodeValue
            const timestamp = block.querySelector('div.date')?.textContent
            messages.push(new Message(timestamp as string, message as string))
        })
        fs.promises.writeFile('public/rthk-news.json', JSON.stringify(messages))
    } catch (err) {
        console.error(chalk.red(`[news] ${err}`))
        return new Error('error while fetching')
    }
}
fetchRthkNews()
