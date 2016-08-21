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
 * Makes the creep build a road under itself on its way home.
 */
Creep.prototype.performBuildRoad = function() {
	var creep = this;
	// @todo Cache this in creep memory.
	var workParts = 0;
	for (let j in creep.body) {
		if (creep.body[j].type == WORK && creep.body[j].hits > 0) {
			workParts++;
		}
	}

	if (workParts < 1) {
		return false;
	}

	// Check if creep is travelling on a road.
	var hasRoad = false;
	var actionTaken = false;
	var structures = creep.pos.lookFor(LOOK_STRUCTURES);
	if (structures && structures.length > 0) {
		for (var i in structures) {
			if (structures[i].structureType == STRUCTURE_ROAD) {
				hasRoad = true;
				break;
			}
		}
	}

	// Also repair structures in passing.
	var needsRepair = creep.pos.findClosestByRange(FIND_STRUCTURES, {
		filter: (structure) => (structure.structureType == STRUCTURE_ROAD || structure.structureType == STRUCTURE_CONTAINER) && structure.hits < structure.hitsMax - workParts * 100
	});
	if (needsRepair && creep.pos.getRangeTo(needsRepair) <= 3) {
		Memory.rooms[utilities.decodePosition(creep.memory.storage).roomName].remoteHarvesting[creep.memory.source].buildCost += workParts;
		creep.repair(needsRepair);
		actionTaken = true;
		// If structure is especially damaged, stay here to keep repairing.
		if (needsRepair.hits < needsRepair.hitsMax - workParts * 2 * 100) {
			return true;
		}
	}

	if (!hasRoad) {
		// Make sure there is a construction site for a road on this tile.
		var constructionSites = creep.pos.lookFor(LOOK_CONSTRUCTION_SITES);
		_.filter(constructionSites, (site) => site.structureType == STRUCTURE_ROAD);
		if (constructionSites.length <= 0) {
			if (creep.pos.createConstructionSite(STRUCTURE_ROAD) != OK) {
				hasRoad = true;
			}
		}
	}

	var needsBuilding = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
		filter: (site) => site.structureType == STRUCTURE_ROAD || site.structureType == STRUCTURE_CONTAINER
	});
	if (needsBuilding && creep.pos.getRangeTo(needsBuilding) <= 3) {
		if (actionTaken) {
			// Try again next time.
			return true;
		}
		creep.build(needsBuilding);

		var buildCost = Math.min(creep.carry.energy, workParts * 5, needsBuilding.progressTotal - needsBuilding.progress);
		Memory.rooms[utilities.decodePosition(creep.memory.storage).roomName].remoteHarvesting[creep.memory.source].buildCost += buildCost;
		actionTaken = true;

		// Stay here if more building is needed.
		if (needsBuilding.progressTotal - needsBuilding.progress > workParts * 10) {
			return true;
		}
	}

	if (!hasRoad) {
		return true;
	}
	return false;

	var needsBuilding = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
		filter: (site) => site.structureType == STRUCTURE_ROAD || site.structureType == STRUCTURE_CONTAINER
	});
	if (needsBuilding && creep.pos.getRangeTo(needsBuilding) <= 3) {
		if (actionTaken) {
			// Try again next time.
			return true;
		}
		creep.build(needsBuilding);

		var buildCost = Math.min(creep.carry.energy, workParts * 5, needsBuilding.progressTotal - needsBuilding.progress);
		Memory.rooms[utilities.decodePosition(creep.memory.storage).roomName].remoteHarvesting[creep.memory.source].buildCost += buildCost;
		actionTaken = true;

		// Stay here if more building is needed.
		if (needsBuilding.progressTotal - needsBuilding.progress > workParts * 10) {
			return true;
		}
	}

	if (!hasRoad) {
		return true;
	}
	return false;
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

	// @todo: Use default delivery method if no storage defined
	var target = creep.room.storage;

	harvestMemory.revenue += creep.carry.energy;
	if (!target || _.sum(target.store) + creep.carry.energy >= target.storeCapacity) {
		// Container is full, drop energy
		var containers = creep.pos.findInRange(STRUCTURE_CONTAINER,3, {
			filter: (container) => _.sum(container.store) < container.storeCapacity + _.sum(creep.carry.energy)
		});
		if (containers && containers.length > 0) {
			 target = container[0];
		}
		else if (creep.drop(RESOURCE_ENERGY) == OK) {
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

	// Check if there is a container near the source, and save it.
	var container = this.pos.findClosestByRange(FIND_STRUCTURES, {
		filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
	});
	if (container && this.pos.getRangeTo(container) <= 3) {
		//console.log('container found and recorded');
		harvestMemory.hasContainer = true;
		harvestMemory.containerId = container.id;
	}
	else {
		harvestMemory.hasContainer = false;
		delete harvestMemory.containerId;
	}

	if (harvestMemory.cachedPath) {
		this.setCachedPath(harvestMemory.cachedPath.path, !harvesting, 1);
	}

	Memory.rooms[targetPosition.roomName].remoteHarvesting[this.memory.source] = harvestMemory;
}

/**
 * Make Creep behave like a harvester
 */
Creep.prototype.runRemoteHarvesterLogic = function() {
	if (!this.memory.harvesting && _.sum(this.carry) <= 0) {
		this.setRemoteHarvesterState(true);
	}
	else if (this.memory.harvesting && _.sum(this.carry) >= this.carryCapacity) {
		this.setRemoteHarvesterState(false);
	}

	if (this.memory.harvesting) {
		return this.performRemoteHarvest();
	}
	else {
		return this.performRemoteHarvesterDelivery();
	}
}
