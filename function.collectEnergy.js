module.exports = function() {
    // Create Function
    Creep.prototype.collectEnergy =
        function(creep) {
            if (creep.memory.sourceid) {
                var source = Game.getObjectById(creep.memory.sourceid.id);
                // Search a new Source
                if (creep.pickup(source) == ERR_INVALID_TARGET) {
                    delete creep.memory.sourceid;
                    // stop to pick up energy if at least 80% full
                    if ( creep.carry.energy >= creep.carryCapacity*0.8 ) {
                        creep.memory.working = true;
                    }
                }
                if (creep.pickup(source) == ERR_NOT_IN_RANGE) {
                    // move towards the source
                    creep.moveTo(source);
                }
            }
            else {
                var sources = creep.room.find(FIND_DROPPED_ENERGY);
                var random = Math.floor(Math.random() * (sources.length - 1 + 1)) + 0;
                creep.memory.sourceid = sources[random];
            }
        }
}