(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Shim that exports the Simulation classes to the browser using browserify
 */

var lander = window.lander || {};

lander.simulation = require('./simulation.js');
lander.vector = require('./vector.js');

window.lander = lander;

},{"./simulation.js":2,"./vector.js":3}],2:[function(require,module,exports){
/**
 * Simulation module
 */
var vector = require('./vector.js');

function NoControl(commands) {
}

var DefaultParams = {
    turningSpeed: Math.PI / 100,
    thrusterAcceleration: 2,
    gravity: vector.Vector(0, -1),
    landerRadius: 5,
    landingOrientationEpsilon: 0.001,
    ladingMaxSpeed: 0.1,
};

/**
 * x: Position
 * v: Velocity
 * o: Orientation (Only direction matters, magnitude is ignored)
 * w: Angular velocity (radians per tick)
 * control: control function
 *
 * The control function is supposed to control the lander using the f
 */
function Lander(position, initialSpeed, initialOrientation, initialFuel, control) {
    var self = this;

    self.crashed = false;
    self.x = position;
    self.v = initialSpeed || new vector.Vector(0, 0);
    self.o = initialOrientation || new vector.Vector(0, 1);
    self.w = 0; // Radians per tick
    self.fuel = initialFuel || 100;
    self.control = control || NoControl;

    // These functions get passed to the control function
    self.commands = {
        // Getters
        see: {
            x: function() { return self.x },
            v: function() { return self.v },
            o: function() { return self.o },
            fuel: function() { return self.fuel },
            w: function() { return self.w },
        },

        do: {
            // Updaters
            turnLeft: function() {
                if (self.fuel <= 0) return;
                self.w -= self.params.turningSpeed;
                self.fuel -= 1;
            },
            turnRight: function() {
                if (self.fuel <= 0) return;
                self.w += self.params.turningSpeed;
                self.fuel -= 1;
            },
            thruster: function() {
                if (self.fuel <= 0) return;
                self.v = self.v.plus(self.o.resize(self.params.thrusterAcceleration));
                self.fuel -= 1;
            },
        }
    };
}

Lander.prototype.crash = function() {
    this.crashed = true;
}

Lander.prototype.doControl = function(params) {
    // This is a bit of a hacky solution to get the params into the closure we defined in the
    // constructor
    this.params = params;
    this.control(this.commands);
}

Lander.prototype.doPhysics = function(world, params) {
    this.o = this.o.rotate(this.w);

    // FIXME: Only gravity if not landed? Otherwise, it's also fine if the speed induced by gravity
    // is below the crashing threshold.
    this.v = this.v.plus(params.gravity);
    this.x = this.x.plus(this.v);

    // Horizontal wraparound on X axis
    this.x.x = (this.x.x + world.width) % world.width;
}

/**
 * A simulation drives a number of entities
 */
function Simulation(world, lander, params) {
    this.world = world;
    this.lander = lander;
    this.params = params || DefaultParams;
}

/**
 * Do a single tick of the simulation. Update all entities.
 */
Simulation.prototype.tick = function() {
    this.lander.doControl(this.params);
    this.lander.doPhysics(this.world, this.params);
    this.world.checkCollission(this.lander);
}


function FlatLand(width, h) {
    this.width = width;
    this.h = h || 0;
}

FlatLand.prototype.checkCollission = function(lander, params) {
    if (lander.crashed) return false; // No need 

    if (lander.x.y <= this.h + params.landerRadisu) {
        var landed = (lander.o.angle() < params.landingOrientationEpsilon
                && lander.v.length() < params.landingMaxSpeed);

        if (landed) {
            // Hit the ground, stay there
            lander.x = new vector.Vector(lander.x.x, this.h + params.landerRadisu);
            lander.v = new vector.Vector(0, 0);
            lander.o = new vector.Vector(0, 1);
            lander.w = 0;
        }
        else {
            lander.crash();
        }
    }
};

module.exports = {
    Lander: Lander,
    Simulation: Simulation,
    NoControl: NoControl,
    FlatLand: FlatLand,
}

},{"./vector.js":3}],3:[function(require,module,exports){
/**
 * Yep, vector class
 */

function Vector(x, y) {
    if (isNaN(x) || isNaN(y)) throw new Error('Vector arg not a number');
    this.x = x;
    this.y = y;
}

Vector.fromPolar = function(r, theta) {
    return new Vector(
        r * Math.cos(theta),
        r * Math.sin(theta));
}

Vector.make = function(x) {
    if (x instanceof Vector) return x;
    if (x instanceof Object && 0 in x)
        return new Vector(x[0], x[1]);
    if (typeof(x) == 'number')
        return new Vector(x, x);
    return null;
}

Vector.prototype.plus = function(v) {
    return new Vector(this.x + v.x, this.y + v.y);
}

Vector.prototype.minus = function(v) {
    return new Vector(this.x - v.x, this.y - v.y);
}

Vector.prototype.len = function() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
}

var TAU = 2 * Math.PI;

/**
 * Vector minus on a torus
 *
 * Will return the shortest direction vector.
 */
Vector.prototype.torus_minus = function(v, world) {
    var d = this.minus(v);
    if (d.x > world.x / 2)
        d.x -= world.x;
    else if (d.x < -world.x / 2)
        d.x += world.x;

    if (d.y > world.y / 2)
        d.y -= world.y;
    else if (d.y < -world.y / 2)
        d.y += world.y;

    return d;
}

/**
 * The square of the length. Use this if you want to avoid
 * calculating the square root.
 */
Vector.prototype.len2 = function() {
    return this.x * this.x + this.y * this.y;
}

Vector.prototype.times = function(f) {
    return new Vector(this.x * f, this.y * f);
}

/**
 * Resize the vector to a given length
 */
Vector.prototype.resize = function(l) {
    var a = this.angle();
    var x = Math.cos(a) * l;
    var y = Math.sin(a) * l;
    return new Vector(x, y);
}

/**
 * Vector modulo another vector
 */
Vector.prototype.mod = function(v) {
    if (0 <= this.x && this.x < v.x && 0 <= this.y && this.y < v.y)
        return this;

    var xx = this.x % v.x;
    if (xx < 0) xx += v.x;
    var yy = this.y % v.y;
    if (yy < 0) yy += v.y;

    return new Vector(xx, yy);
}

/**
 * Rotate by an amount of radians
 */
Vector.prototype.rotate = function(a) {
    if (isNaN(a)) throw new Error('Rotate argument not a number');
    var xx = this.x * Math.cos(a) - this.y * Math.sin(a);
    var yy = this.x * Math.sin(a) + this.y * Math.cos(a);
    return new Vector(xx, yy);
}

/**
 * Return the angle of this vector
 */
Vector.prototype.angle = function() {
    if (Math.abs(this.x) < 0.00001) return 0.5 * Math.PI;
    var d = Math.atan2(this.y, this.x);
    return d < 0 ? d + TAU : d;
}

Vector.prototype.toString = function() {
    return '(' + this.x  + ', ' + this.y + ')';
}

function clockwise(src, tgt) {
    return ((tgt - src + 2 * Math.PI) % (2 * Math.PI) > Math.PI);
}

function angle_dist(src, tgt) {
    if ((tgt - src + 2 * Math.PI) % (2 * Math.PI) > Math.PI) {
        if (src > tgt) 
            return tgt - src;
        else
            return tgt - src - 2 * Math.PI;
    }
    else {
        if (tgt > src) 
            return tgt - src;
        else
            return tgt - src + 2 * Math.PI;
    }
}

function rad(d) {
  return (d * Math.PI) / 180;
}

function deg(r) {
  return r / (2 * Math.PI) * 360;
}

module.exports = {
    Vector: Vector,
    clockwise: clockwise,
    angle_dist: angle_dist,
    rad: rad,
    deg: deg
}

},{}]},{},[1]);
