var utilities = require('utilities');

/**
 * Creep gathers resource in current room.
 */
Creep.prototype.performHarvest = function() {
	// Search for suitable source.
	var creep = this;
	var source;
	if (creep.memory.fixedSource) {
		source = Game.getObjectById(creep.memory.fixedSource);
	}
	else if (creep.memory.fixedMineralSource) {
		source = Game.getObjectById(creep.memory.fixedMineralSource);
	}
	else {
		// This should only trigger if harvesterscount gets below 1,
		// and a free harvester is spawned
		if (!creep.memory.resourceTarget) {
			// Room has no resources.
			// @todo: creep.room.sources define this object
			if (!creep.room.sources || creep.room.sources.length <= 0) {
			  return false;
			}

			// Find closest source
			let source = creep.pos.findClosestByPath(FIND_SOURCES, {
				filter: (source) => source.energy > 0
			});
			if (!source || source.length < 1) {
				return false;
			}
			creep.memory.resourceTarget = source.id;
		}
		var best = creep.memory.resourceTarget;
		if (!best) {
			return false;
		}
		source = Game.getObjectById(best);
		if (!source) {
			creep.memory.resourceTarget = null;
		}
	}
	// Move to source
	if (creep.pos.getRangeTo(source) > 1) {
		// @todo: Pathfinding und wiederverwenden des Pfads
		creep.moveTo(source);
	}
	else {
		var result = creep.harvest(source);
	}

	// Wenn Container oder Link in der Nähe (Range 1), direkt zustellen
	var targets = creep.pos.findInRange(FIND_STRUCTURES, 1, {
		filter: (structure) => structure.structureType == STRUCTURE_LINK && structure.energy < structure.energyCapacity
	});
	if (targets.length <= 0) {
		targets = creep.pos.findInRange(FIND_STRUCTURES, 1, {
			filter: (structure) => structure.structureType == STRUCTURE_CONTAINER && structure.store[RESOURCE_ENERGY] < structure.storeCapacity
		});
	}
	if (targets.length > 0) {
		creep.transfer(targets[0], RESOURCE_ENERGY);
	}
}

/**
 * Deliver gathered resources
 */
Creep.prototype.performHarvesterDelivery = function() {
	var creep = this;
	var target;

	// Search target if not already set
	if (!creep.memory.deliverTarget) {
		var targets = creep.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				return (structure.structureType == STRUCTURE_EXTENSION  ||
						structure.structureType == STRUCTURE_SPAWN ||
						structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
			}
		});
		// Fill containers if everything else is full
		if (targets.length <= 0) {
			targets = creep.room.find(FIND_STRUCTURES, {
				filter: (structure) => {
					return structure.structureType == STRUCTURE_CONTAINER && structure.energy < structure.energyCapacity;
				}
			});
			// Drop energy if no suitable target is found - someone will pick it up
			if (targets.length <= 0) {
				if (creep.memory.fixedDropoffSpot) {
					var dropoffSpot = creep.memory.fixedDropoffSpot;
					if (creep.pos.getRangeTo(dropoffSpot.x, dropoffSpot.y) <= 0) {
						creep.drop(RESOURCE_ENERGY);
						return true;
					}
					else {
						creep.moveTo(dropoffSpot.x, dropoffSpot.y);
						return true;
					}
				}
				creep.drop(RESOURCE_ENERGY);
				creep.memory.deliverTarget = null;
				return true;
			}
		}

		// get closest target.
		creep.memory.deliverTarget = utilities.getClosest(creep, targets);
	}

	var best = creep.memory.deliverTarget;
	if (!best) {
		return false;
	}

	// Deliver Resources
	target = Game.getObjectById(best);
	if (creep.pos.getRangeTo(target) > 1) {
		creep.moveTo(target);
	}
	else {
		creep.transfer(target, RESOURCE_ENERGY);
	}

	// delete deliverTarget if target is at capacity
	if (target.energy >= target.energyCapacity) {
		creep.memory.deliverTarget = null;
	}
}

/**
 * Change harvesting state of this creep
 */
Creep.prototype.setHarvesterState = function(harvesting) {
	// Setze den Harvester State (true/false)
	this.memory.harvesting = harvesting;
	delete this.memory.resourceTarget;
	delete this.memory.tempRole;
}

/**
 * Make Creep behave like a harvester
 */
Creep.prototype.runHarvesterLogic = function() {
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
	console.log('find');
}
