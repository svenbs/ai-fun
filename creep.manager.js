var utilities = require('utilities');

module.exports = function() {
    // a function to run the logic for this role
    // @todo: Queue renewings
    // @todo: Do not renew creeps if above limit
	Creep.prototype.renew = 
		function(spawn) {
        	if (!spawn) {
            	throw "No spawn for renewing defined."
        	}

            if (this.room.energyAvailable < spawn.room.energyCapacityAvailable * 0.1) {
                // Send creeps back to work if not enough energy
                delete this.memory.renewing;
                return 0;
            }

            var cost = utilities.getBodyCost(this);
            if (cost < spawn.room.energyCapacityAvailable * 0.75) {
                // Do not renew cheap creeps, they'll be replaced with better ones
                return 0;
            }

        	if (spawn.spawning) {
                // if spawning don't renew creeps, send them back to work
                delete this.memory.renewing;
        		return 0;
        	}
        	// stop renewing early
        	if (this.ticksToLive > CREEP_LIFE_TIME * 0.3 && spawn.room.energyAvailable <= spawn.room.energyCapacityAvailable * 0.1) {
        		delete this.memory.renewing;
        		// breaking out of renewing
        		return 1;
        	}

        	var renewState = spawn.renewCreep(this);
			if (renewState == ERR_NOT_IN_RANGE) {
				this.moveTo (spawn);
				// breaking out of renewing
				return 1;
			}
			if (renewState == OK) {
				return 1;
			}
			else if (renewState == ERR_FULL) {
				delete this.memory.renewing;
			}
    	}
}