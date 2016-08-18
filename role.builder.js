var utilities = require('utilities');

/**
 * Makes creep use energy to build structures
 */
Creep.prototype.performBuild = function() {
	if (Game.cpu.bucket < 500) {
		return false;
	}

	if (!this.memory.buildTarget) {
		var options = [];
		var targets = this.room.find(FIND_CONSTRUCTION_SITES);
		if (targets.length <= 0) {
			return false;
		}
		else {
			for (let i in targets) {
				var constructionSite = targets[i];
				var option = {};
				if (constructionSite && constructionSite.structureType == STRUCTURE_EXTENSION) {
					option = {
							priority: 4,
							weight: 1 - ((constructionSite.progressTotal / constructionSite.progress) - (this.pos.getRangeTo(constructionSite))) / 100,
							type: 'constructionsite',
							object: constructionSite,
					}
				}
				else if (constructionSite && constructionSite.structureType == STRUCTURE_CONTAINER) {
					option = {
							priority: 5,
							weight: 1 - ((constructionSite.progressTotal / constructionSite.progress) - (this.pos.getRangeTo(constructionSite))) / 100,
							type: 'constructionsite',
							object: constructionSite,
					}
				}
				else {
					option = {
							priority: 2,
							weight: 1 - (this.pos.getRangeTo(constructionSite) / 100),
							type: 'constructionsite',
							object: constructionSite,
					}
				}
				options.push(option);
			}
		}
		var best = utilities.getBestOption(options);

		if (best) {
			this.memory.buildTarget = best.object.id;
		}
		else {
			this.memory.buildTarget = utilities.getClosest(this, targets);
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
			//this.memory.tempRole = 'upgrader';
		}
	}
	else {
		if (!this.performGetEnergy()) {
			/*if (this.room.controller.level < 3) {
				var source = this.pos.findClosestByRange(FIND_SOURCES);
				if (this.pos.getRangeTo(source) > 1) {
					if (this.moveTo(source) == ERR_NO_PATH && _.sum(creep.carry.energy) > 0) {
						this.setBuilderState(true);
					}
				}
				else {
					if (this.harvest(source) != OK && creep.carry.energy > 0) {
						this.setBuilderState(true);
					}
				}
			}*/
		}
	}
}