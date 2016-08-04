// @todo: Stop renewing better creeps

module.exports = function() {
    // a function to run the logic for this role
	Creep.prototype.renew = 
		function(spawn) {
        	if (!spawn) {
            	throw "No spawn for renewing defined."
        	}

        	// if spawning don't renew creeps
        	if (spawn.spawning) {
        		return 1;
        	}
        	// stop renewing early
        	if (spawn.energy <= spawn.energyCapacity * 0.1) {
        		this.memory.renewing = false;
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
				this.memory.renewing = false;
			}
    	}
}