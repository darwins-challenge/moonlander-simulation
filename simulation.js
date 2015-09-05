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
