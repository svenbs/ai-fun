// @todo: rewrite logic
module.exports = function() {
    // Create Function
    Creep.prototype.collectEnergy =
        function(creep) {
            if (!creep.memory.source && !creep.memory.container) {
                var sources = creep.room.find(FIND_DROPPED_ENERGY);
                if (sources) {
                    // select random source
                    var random = Math.floor(Math.random() * (sources.length - 1 + 1)) + 0;
                    creep.memory.source = sources[random];    
                }
            }
            // if no dropped energy try storage
            if (!creep.memory.container) {
                creep.memory.container = creep.pos.findClosestByPath(FIND_STRUCTURES, { 
                    filter: (s) => (s.structureType == STRUCTURE_CONTAINER &&
                                    s.store[RESOURCE_ENERGY] > 0 )
                });
            }

            // if source is set
            if (creep.memory.source) {
                var source = Game.getObjectById(creep.memory.source.id);
                // stop to pick up energy if at least 80% full
                if ( creep.carry.energy >= creep.carryCapacity*0.8 ) {
                    creep.memory.working = true;
                }
                // source is depleted search a new one
                if (creep.pickup(source) == ERR_INVALID_TARGET) {
                    delete creep.memory.source;
                    return;
                }
                // collect or
                if (creep.pickup(source) == ERR_NOT_IN_RANGE) {
                    // move towards the source
                    creep.moveTo(source);
                }
            }
            else if (creep.memory.container) {
                var container = Game.getObjectById(creep.memory.container.id)
                if (creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_ENOUGH_RESOURCES) {
                    delete creep.memory.container;
                    return;
                }

                if ( creep.carry.energy >= creep.carryCapacity*0.8 ) {
                    creep.memory.working = true;
                    delete creep.memory.container;
                    return;
                }

                if (creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container);
                }
            }
        }
}