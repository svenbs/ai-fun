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
Creep.prototype.performBuildRoads = function() {
};

/**
 * Creep gathers resource in remote room.
 */
Creep.prototype.performRemoteHarvest = function() {
	var creep = this;
	var source;
	var sourcePosition = utilities.decodePosition(creep.memory.source);

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
	var harvestMemory = Memory.rooms[utilities.decodePosition(creep.memory.storage).roomName].remoteHarvesting[creep.memory.source];

	if (targetPosition.roomName != creep.pos.roomName) {
		creep.moveTo(targetPosition);
		return true;
	}

	// @todo: performBuildRoads on the way back

	// @todo: Use default delivery method if no storage defined
	var target = creep.room.storage;

	if (!target || _.sum(target.store) + creep.carry.energy >= target.storeCapacity) {
		// Container is full, drop energy
		if (creep.drop(RESOURCE_ENERGY) == OK) {
			harvestMemory.revenue += creep.carry.energy;
			return true;
		}
	}

	if (creep.pos.getRangeTo(target) > 1) {
		creep.moveTo(target);
	}
	else {
		if (creep.transfer(target, RESOURCE_ENERGY)){
			// @todo: Muss wahrscheinlich zurück in den Speicher geschrieben werden?
			harvestMemory.revenue = creep.carry.energy;
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