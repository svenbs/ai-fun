var utilities = require('utilities');

// Makes the creep gather resources.
Creep.prototype.performHarvest = function () {
	var creep = this;
	var source;
}

// Dumps resources a harvester creep has gathered.
Creep.prototype.performHarvesterDelivery = function () {
	var creep = this;
	var target;
}


// Put this creep into or out of harvesting mode
Creep.prototype.setHarvesterState = function (harvesting) {
	this.memory.harvesting = harvesting;
}

// Makes creep behave like a harvester.
Creep.prototype.runHarvesterLogic () {
	if (!this.memory.harvesting && _.sum(this.carry) <= 0) {
		this.setHarvesterState(true);
	}
	else if (this.memory.harvesting && _.sum(this.carry) >= this.carryCapacity) {
		this.setHarvesterState(false);
	}

	if (this.memory.harvesting) {
		return this.performHarvest();
	}
	else {
		return this.performHarvesterDelivery();
	}
}