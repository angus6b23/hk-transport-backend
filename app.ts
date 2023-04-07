import initServer from "./express-modules/create-server";
import fetchBuses from "./scrape/bus";
initServer();

fetchBuses().then(buses => {
    // console.log(buses);
})