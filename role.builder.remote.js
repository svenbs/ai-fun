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
 * Creep gathers resource in remote room.
 */
Creep.prototype.performRemoteBuild = function() {
	var creep = this;
	var targetPosition = utilities.decodePosition(creep.memory.target);

	// Move creep to source position.
	if (targetPosition.roomName != creep.pos.roomName) {
		creep.moveTo(targetPosition);
		return true;
	}

	if (creep.memory.building && creep.carry.energy <= 0) {
		creep.memory.building = false;
		creep.memory.buildingTarget = null;
		creep.memory.tempRole = null;
	}
	else if (!creep.memory.building && creep.carry.energy >= creep.carryCapacity) {
		creep.memory.building = true;
		creep.memory.buildingTarget = null;
		creep.memory.tempRole = null;
	}

	if (!creep.memory.building) {
		//creep.memory.tempRole = 'builder';

		if (!creep.performGetEnergy()) {
			creep.performHarvest();
			//creep.memory.tempRole = 'harvester';
		}
	}
	else if (creep.memory.building) {
		var claimFlags = creep.room.find(FIND_FLAGS, {
			filter: (flag) => flag.name.startsWith('ClaimRoom')
		});
		if (claimFlags && claimFlags.length > 0) {
			var spawners = creep.room.find(FIND_STRUCTURES, {
				filter: (structure) => structure.structureType == STRUCTURE_SPAWN
			});
			if (!spawners || spawners.length <= 0) {
				// Check if room has a spawner construction site by now.
				var spawners = creep.room.find(FIND_CONSTRUCTION_SITES, {
					filter: (site) => site.structureType == STRUCTURE_SPAWN
				});

				if (!spawners || spawners.length <= 0) {
					// Create construction site for spawner.
					claimFlags[0].pos.createConstructionSite(STRUCTURE_SPAWN);
				}
				creep.memory.buildTarget = utilities.getClosest(creep, spawners);
				creep.performBuild();
			}
			else {
				// Spawner exists, claim flag can be removed.
				claimFlags[0].remove();
				// Help filling spawn with energy;
				creep.memory.tempRole = 'harvester';
			}
		}
	}

}


/**
 * Make Creep behave like a remote builder
 */
Creep.prototype.runRemoteBuilderLogic = function() {
	return this.performRemoteBuild();
}
