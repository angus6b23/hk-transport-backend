import initServer from "./express-modules/create-server";
import fs from 'fs';
import fetchBuses from "./scrape/bus";
import fetchMinibus from './scrape/minibus';
import fetchFerry from './scrape/ferry';
import fetchTram from './scrape/tram';
import fetchMTR from './scrape/mtr';
import chalk from 'chalk'
initServer();

/*
fetchBuses().then(buses => {
    console.log(chalk.green(`Finished fetching buses`))
    fs.writeFile('./dev/generatedBus.json', JSON.stringify(buses), ()=>{})
    // const filteredBus = buses?.filter( bus => bus.routeNo === '277X');
    // console.log(filteredBus);
    // console.log(buses);
})

fetchMinibus().then(minibuses => {
    console.log(chalk.green(`Finished fetching minibuses`))
    fs.writeFile('./dev/generated/minibus.json', JSON.stringify(minibuses), () => {})
})

fetchFerry().then(ferry=>{
    console.log(chalk.green(`Finished fetching ferry`));
    fs.writeFile('./dev/generated/ferry.json', JSON.stringify(ferry), ()=>{})
})

fetchTram().then(tram => {
    console.log(chalk.green(`Finished fetching tram`));
    fs.writeFile('./dev/generated/tram.json', JSON.stringify(tram), () => { })
})
*/

fetchMTR().then(mtr => {
    console.log(chalk.green(`Finished fetching mtr`));
    fs.writeFile('./dev/generated/mtr.json', JSON.stringify(mtr), () => {});
})