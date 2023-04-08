"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var create_server_1 = require("./express-modules/create-server");
var bus_1 = require("./scrape/bus");
var chalk_1 = require("chalk");
(0, create_server_1.default)();
(0, bus_1.default)().then(function (buses) {
    console.log(chalk_1.default.green("Finished fetching buses"));
    // console.log(buses);
});
