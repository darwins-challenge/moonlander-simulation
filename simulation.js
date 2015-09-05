/**
 * Simulation module
 */
var vector = require('./vector.js');
var _ = require('underscore');

function NoControl(commands) {
}

var DefaultParams = {
    turningSpeed: Math.PI / 1000,
    thrusterAcceleration: 0.05,
    gravity: new vector.Vector(0, -0.01),
    landerRadius: 10,
    landingOrientationEpsilon: Math.PI / 100,
    landingMaxSpeed: 0.2,
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
function Lander(position, control, initialSpeed, initialOrientation, initialFuel) {
    var self = this;

    self.crashed = false;
    self.landed = false;
    self.x = position;
    self.control = control || NoControl;
    self.v = initialSpeed || new vector.Vector(0, 0);
    self.o = initialOrientation || new vector.Vector(0, 1);
    self.w = 0; // Radians per tick
    self.fuel = initialFuel || 500;
    self.thrusting = false;

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
                if (self.crashed || self.landed || self.fuel <= 0) return;
                self.w += self.params.turningSpeed;
                self.fuel -= 1;
            },
            turnRight: function() {
                if (self.crashed || self.landed || self.fuel <= 0) return;
                self.w -= self.params.turningSpeed;
                self.fuel -= 1;
            },
            thruster: function() {
                if (self.crashed || self.landed || self.fuel <= 0) return;
                self.v = self.v.plus(self.o.resize(self.params.thrusterAcceleration));
                self.thrusting = true;
                self.fuel -= 3;
            },
            skip: function() {
            }
        }
    };
}

Lander.prototype.dump = function() {
    return {
        crashed: this.crashed,
        landed: this.landed,
        x: this.x,
        v: this.v,
        o: this.o,
        w: this.w,
        fuel: this.fuel,
        thrusting: this.thrusting
    }
}

Lander.prototype.crash = function() {
    this.crashed = true;
    console.log("CRASHED with v=" + this.v.toString() + " (" + this.v.len() + ") and " +
                "o=" + this.o.toString() + " (" + this.o.angle() + ")");
}

Lander.prototype.land = function() {
    this.landed = true;
    console.log("LANDED with v=" + this.v.toString() + " (" + this.v.len() + ") and " +
                "o=" + this.o.toString() + " (" + this.o.angle() + ")");
}

Lander.prototype.doControl = function(params) {
    // This is a bit of a hacky solution to get the params into the closure we defined in the
    // constructor
    this.params = params;
    this.thrusting = false;
    this.control(this.commands);
}

Lander.prototype.doPhysics = function(world, params) {
    if (this.crashed || this.landed) return;

    this.o.rotate(this.w);

    // FIXME: Only gravity if not landed? Otherwise, it's also fine if the speed induced by gravity
    // is below the crashing threshold.
    this.v.add(params.gravity);
    this.x.add(this.v);

    // Horizontal wraparound on X axis (not modulo because that's slow)
    if (this.x.x < 0)
        this.x.x += world.width;
    else if (this.x.x >= world.width)
        this.x.x -= world.width;
}

/**
 * A simulation drives a number of entities
 */
function Simulation(world, lander, params) {
    this.t = 0;
    this.world = world;
    this.lander = lander;
    this.params = _.extend({}, DefaultParams, params || {});
}

/**
 * Do a single tick of the simulation. Update all entities.
 */
Simulation.prototype.tick = function() {
    this.t++;
    this.lander.doControl(this.params);
    this.lander.doPhysics(this.world, this.params);
    this.world.checkCollission(this.lander, this.params);
}

Simulation.prototype.dump = function() {
    return { lander: this.lander.dump(), world: this.world.dump() };
}

function FlatLand(width, h, height) {
    this.width = width;
    this.horizon = h || 0;
    this.height = height || 1000;
}

FlatLand.prototype.dump = function() {
    return { horizon: this.horizon }
}

FlatLand.prototype.checkCollission = function(lander, params) {
    if (lander.crashed || lander.landed) return; // No need 

    if (lander.x.y <= this.h + params.landerRadius) {
        var landed = (vector.angle_dist(lander.o.angle(), Math.PI/2) < params.landingOrientationEpsilon
                && lander.v.len() < params.landingMaxSpeed);

        console.log("angle_dist", vector.angle_dist(lander.o.angle(), Math.PI/2));

        if (landed) {
            // Graceful landing, correct orientation
            lander.o.set(0, 1);
            lander.w = 0;
            lander.land();
        }
        else {
            // Poor you
            lander.crash();
        }

        // Hit the ground, stay there
        lander.x.set(lander.x.x, this.h + params.landerRadius);
        lander.v.set(0, 0);
    }
};

module.exports = {
    Lander: Lander,
    Simulation: Simulation,
    NoControl: NoControl,
    FlatLand: FlatLand,
}
