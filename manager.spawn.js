StructureSpawn.prototype.createManagedCreep =
    function(options) {
        if (!options) {
            throw "No options for creep spawning defined.";
        }

        if (this.spawning) {
            return false;
        }

        var enoughEnergy = true;
        if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
            enoughEnergy = false;
        }

        if (!options.body) {
            if (!options.bodyWeights) {
                throw "No body definition for creep found.";
            }

            // Creep might be requested with a maximum energy cost.
            var maxCost = this.room.energyCapacityAvailable * 0.9;
            if (options.maxCost) {
                maxCost = Math.min(maxCost, options.maxCost);
            }

            // Creep might be requested with a part limit.
            if (options.maxParts) {
                var maxPartsCost = 0;
                var tempBody = utitilites.generateCreepBody(options.)
            }
        }
    }


/**
 * Handles logic for spawning creeps in rooms, and spawning creeps to go
 * outside of these rooms.
 */
var spawnManager = {

    /**
     * Manages spawning logic for all spawns.
     */
    manageSpawns: function () {
        for (var roomName in Game.rooms) {
            var room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                room.manageSpawns();
            }
        }
    },

};

module.exports = spawnManager;