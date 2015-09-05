/**
 * Shim that exports the Simulation classes to the browser using browserify
 */

var lander = window.lander || {};

lander.simulation = require('./simulation.js');
lander.vector = require('./vector.js');

window.lander = lander;
