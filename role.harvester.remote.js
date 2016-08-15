var utilities = require('utilities');

/**
 * Brainstorming
 * - Decide when to harvest a room (Flags?)
 * - - Create maxHarvesters for room
 * - Move Harvesters to room
 * - - Create Roads
 * - Find and Harvest nearest source logic of harvester to define if needed harvesters are already harvesting
 * - - Define Container Positions
 * - perform delivery // decide where to deliver (Game.room.controller.my?)
 */

/**
 * Build roads on the way home (TODO)
 */
Creep.prototype.performBuildRoad = function() {
	var creep = this;
	var workParts = creep.memory.body.work;
	var targetPosition = utilities.decodePosition(creep.memory.storage);
	var harvestMemory = Memory.rooms[targetPosition.roomName].remoteHarvesting[creep.memory.source];


	if (workParts < 1) {
		return false;
	}

	//var hasRoad = false;
	var actionTaken = false;


	if (creep.pos.roomName != targetPosition.roomName) {
		// @todo: Check if on cachedPath and if on road if not create construction site
		var structures = creep.pos.lookFor(LOOK_STRUCTURES);
		var constructionSites = creep.pos.lookFor(LOOK_CONSTRUCTION_SITES);
		for (let i in structures) {
			var structure = structures[i];
			if (structure.structureType != STRUCTURE_ROAD && constructionSites.length <= 0) {
				creep.room.createConstructionSite(creep.pos, STRUCTURE_ROAD);
			}
			if (structure.structureType == STRUCTURE_ROAD && structure.hits < structure.hitsMax - workParts * 100) {
				creep.repair(structure);
				actionTaken = true;
				// If structure is especially damaged, stay here to repair
				if (structure.hits < structure.hitsMax - workParts * 2 * 100) {
					return true;
				}
			}
		}
		if (constructionSites && constructionSites.length > 0) {
			creep.build(constructionSites[0]);
			//harvestMemory.workCost += workParts;
			Memory.rooms[targetPosition.roomName].remoteHarvesting[creep.memory.source].buildCost += workParts;
			actionTaken = true;
			// Stay for building
			//return true;
		}
	}
};

/**
 * Creep gathers resource in remote room.
 */
Creep.prototype.performRemoteHarvest = function() {
	var creep = this;
	var source;
	var sourcePosition = utilities.decodePosition(creep.memory.source);

	if (this.hasCachedPath()) {
        if (this.hasArrived() || this.pos.getRangeTo(sourcePosition) < 3) {
            this.clearCachedPath();
        }
        else {
            this.followCachedPath();
            return;
        }
    }

	// Move creep to source position.
	if (sourcePosition.roomName != creep.pos.roomName) {
		creep.moveTo(sourcePosition);
		return true;
	}

	// Check source
	var sources = creep.room.find(FIND_SOURCES, {
		filter: (source) => source.pos.x == sourcePosition.x && source.pos.y == sourcePosition.y
	});
	if (sources && sources.length > 0) {
		source = sources[0];
	}
	else {
		//Game.notify('Remote Source is not available');
		creep.setRemoteHarvesterState(false);
		return false;
	}

	if (source.energy <= 0 && creep.carry.energy > 0) {
		// Source is depleted start delivering early
		creep.setRemoteHarvesterState(false);
		return false;
	}
	if (creep.pos.getRangeTo(source) > 1) {
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
Creep.prototype.performRemoteHarvesterDelivery = function() {
	var creep = this;
	var targetPosition = utilities.decodePosition(creep.memory.storage);
	var harvestMemory = Memory.rooms[targetPosition.roomName].remoteHarvesting[creep.memory.source];

	try {
		if (creep.performBuildRoad()) {
			return true;
		}
	}
	catch (e) {
		console.log('Error in performBuildRoad: ' + e);
	}

	if (targetPosition.roomName != creep.pos.roomName) {
		creep.moveTo(targetPosition);
		return true;
	}

	// @todo: performBuildRoad on the way back

	// @todo: Use default delivery method if no storage defined
	var target = creep.room.storage;

	harvestMemory.revenue += creep.carry.energy;
	if (!target || _.sum(target.store) + creep.carry.energy >= target.storeCapacity) {
		// Container is full, drop energy
		if (creep.drop(RESOURCE_ENERGY) == OK) {
			Memory.rooms[targetPosition.roomName].remoteHarvesting[creep.memory.source].revenue = harvestMemory.revenue;
			return true;
		}
	}

	if (creep.pos.getRangeTo(target) > 1) {
		creep.moveTo(target);
	}
	else {
		if (creep.transfer(target, RESOURCE_ENERGY)){
			 Memory.rooms[targetPosition.roomName].remoteHarvesting[creep.memory.source].revenue = harvestMemory.revenue;
		}
	}

	return true;
}

/**
 * Change harvesting state of this creep
 */
Creep.prototype.setRemoteHarvesterState = function(harvesting) {
	// Setze den Harvester State (true/false)
	this.memory.harvesting = harvesting;

	var targetPosition = utilities.decodePosition(this.memory.storage);
	var harvestMemory = Memory.rooms[targetPosition.roomName].remoteHarvesting[this.memory.source];

	if (harvestMemory.cachedPath) {
		this.setCachedPath(harvestMemory.cachedPath.path, !harvesting, 1);
	}
}

/**
 * Make Creep behave like a harvester
 */
Creep.prototype.runRemoteHarvesterLogic = function() {
	if (!this.memory.harvesting && _.sum(this.carry) <= 0) {
		this.setHarvesterState(true);
	}
	else if (this.memory.harvesting && _.sum(this.carry) >= this.carryCapacity) {
		this.setHarvesterState(false);
	}

	if (this.memory.harvesting) {
		return this.performRemoteHarvest();
	}
	else {
		return this.performRemoteHarvesterDelivery();
	}
}