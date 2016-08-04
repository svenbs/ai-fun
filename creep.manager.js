module.exports = function() {
    // a function to run the logic for this role
	Creep.prototype.renew = 
		function(spawn) {
        	if (!spawn) {
            	throw "No spawn for renewing defined."
        	}

        	// stop renewing early
        	if (spawn.energy <= spawn.energyCapacity * 0.1) {
        		this.memory.renewing = false;
        		return;
        	}

        	var renewState = spawn.renewCreep(this);
			if (renewState == ERR_NOT_IN_RANGE) {
				this.moveTo (spawn);
				return 1;
			}
			else if (renewState == ERR_FULL) {
				this.memory.renewing = false;
			}
    	}
}