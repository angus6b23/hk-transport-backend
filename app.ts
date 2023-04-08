import initServer from "./express-modules/create-server";
import fetchBuses from "./scrape/bus";
import chalk from 'chalk'
initServer();

fetchBuses().then(buses => {
    console.log(chalk.green(`Finished fetching buses`))
    const filteredBus = buses?.filter( bus => bus.routeNo === '3R');
    console.log(filteredBus);
    // console.log(buses);
})