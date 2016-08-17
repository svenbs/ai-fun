var utilities = require('utilities');

/**
 * Makes creep use energy to build structures
 */
Creep.prototype.performBuild = function() {
	if (Game.cpu.bucket < 500) {
		return false;
	}

	if (!this.memory.buildTarget) {
		var targets = this.room.find(FIND_CONSTRUCTION_SITES);
		if (targets.length <= 0) {
			return false;
		}
		else {
			var options = [];
			for (let i in targets) {
				var constructionSite = targets[i];
				var option = {};
				if (this.constructionSite && this.constructionSite.structureType == STRUCTURE_EXTENSION) {
					option = {
						priority: 5,
						weight: 1,
						type: 'constructionSite',
						object: target,
					}
				}
				else {
					option = {
						priority: 2,
						weight: 1,
						type: 'constructionSite',
						object: target,
					}
				}
				options.push(option);
			}
		}
		var best = utilities.getBestOption(options);

		if (best) {
			this.memory.buildTarget = utilities.encodePosition(best);
		}
	}
	var best = this.memory.buildTarget;
	if (!best) {
		return false;
	}
	var target = Game.getObjectById(best);
	if (!target) {
		this.memory.buildTarget = null;
	}

	if (this.build(target) == ERR_NOT_IN_RANGE) {
		this.moveTo(target);
	}
	return true;
}

/**
 * Set this creep into or out of build mode
 */
Creep.prototype.setBuilderState = function(building) {
	this.memory.building = building;
	delete this.memory.buildTarget;
	delete this.memory.resourceTarget;
	delete this.memory.tempRole;
}

/**
 * Make creep behave like a builder
 */
Creep.prototype.runBuilderLogic = function() {
	if (this.memory.building && this.carry.energy == 0) {
		this.setBuilderState(false);
	}
	else if (!this.memory.building && this.carry.energy == this.carryCapacity) {
		this.setBuilderState(true);
	}

	if (this.memory.building) {
		if (!this.performBuild()) {
			this.memory.tempRole = 'upgrader';
		}
	}
	else {
		if (!this.performGetEnergy()) {
			this.memory.tempRole = 'harvester';
		}
	}
}
