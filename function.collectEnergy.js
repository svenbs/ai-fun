module.exports = function() {
    // Create Function
    Creep.prototype.collectEnergy =
        function(creep) {
            if (creep.memory.sourceid) {
                var source = Game.getObjectById(creep.memory.sourceid.id);
                if (creep.pickup(source) == ERR_INVALID_TARGET) {
                    delete creep.memory.sourceid;
                    creep.memory.working = true;
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