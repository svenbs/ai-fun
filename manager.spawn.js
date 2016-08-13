var gameState = require('game.state');
var utilities = require('utilities');
var intelManager = require('manager.intel');
var stats = require('stats');

var Squad = require('manager.squads');

StructureSpawn.prototype.createManagedCreep = function(options) {
	if (!options) {
		throw "No options for creep spawning defined.";
	}

	if (this.spawning) {
		return false;
	}

	var enoughEnergy = true;
	if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
		enoughEnergy = false;
	}

	if (!options.body) {
		if (!options.bodyWeights) {
			throw "No body definition for creep found.";
		}

		// Creep might be requested with a maximum energy cost.
		var maxCost = this.room.energyCapacityAvailable * 0.9;
		if (options.maxCost) {
			maxCost = Math.min(maxCost, options.maxCost);
		}

		// Creep might be requested with a part limit.
		if (options.maxParts) {
			var maxPartsCost = 0;
			var tempBody = utilities.generateCreepBody(options.bodyWeights, this.room.energyCapacityAvailable, options.maxParts);
			for (var i in tempBody) {
				maxPartsCost += BODYPART_COST[tempBody[i]];
			}

			maxCost = Math.min(maxCost, maxPartsCost);
		}

		if (this.room.energyAvailable >= maxCost) {
			enoughEnergy = true;
		}
		options.body = utilities.generateCreepBody(options.bodyWeights, maxCost, options.maxParts);
	}

	if (!enoughEnergy || this.canCreateCreep(options.body) !== OK) {
		return false;
	}

	// Prepare creep memory.
	var memory = options.memory;
	if (!memory) {
		memory = {};
	}
	if (!memory.role) {
		memory.role = 'unknown';
		if (options.role) {
			memory.role = options.role;
		}
	}

	// Generate creep name.
	if (!Memory.creepCounter) {
		Memory.creepCounter = {};
	}
	if (!Memory.creepCounter[memory.role]) {
		Memory.creepCounter[memory.role] = 0;
	}
	var newName = memory.role + '.' + Memory.creepCounter[memory.role];

	// Actually try to spawn this creep.
	var result = this.createCreep(options.body, newName, memory);

	if (result == newName) {
		// Spawning successful.
		Memory.creepCounter[memory.role]++;
		console.log(this.room.name, 'Spawning new creep:', newName);

		return result;
	}

	return false;
}

Room.prototype.manageSpawns = function() {
	if (!this.controller || !this.controller.my) {
		return;
	}
	var username = this.controller.owner.username;

	var roomSpawns = this.find(FIND_STRUCTURES, {
		filter: (structure) => structure.structureType == STRUCTURE_SPAWN
	});

	var room = this;

	// Gather some information.
	// @todo This could be done on script startup and partially kept in room memory.
	var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder' && creep.pos.roomName == room.name);
	var harvesters = gameState.getHarvesters(room.name);
	var numHarvesters = gameState.getNumHarvesters(room.name);
	var repairers = _.filter(Game.creeps, (creep) => creep.memory.role == 'repairer' && creep.pos.roomName == room.name);
	var numTransporters = gameState.getNumTransporters(room.name);
	var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader' && creep.pos.roomName == room.name);

	var spawnerUsed = false;
	for (let spawnID in roomSpawns) {
		if (spawnerUsed) break;

		var spawn = roomSpawns[spawnID];

		// @todo Stop spawning for a bit if creeps are queued for renewing.

		// If spawning was just finished, scan the room again to assign creeps.
		if (spawn.spawning) {
			spawn.memory.wasSpawning = true;
			continue;
		}
		else if (spawn.memory.wasSpawning) {
			spawn.memory.wasSpawning = false;
			room.scan();
		}
		spawnerUsed = true;

		var numSources = 0;
		var spawnHarvester = false;
		var spawnHarvesterTarget = null;
		var maxHarvesters = 3;
		var maxTransporters = 2; // @todo Find a good way to gauge needed number of transporters by measuring distances.
		var maxHarvesterSize;

		// Spawn new creeps.

		if (room.memory.sources) {
			numSources = _.size(room.memory.sources);
			maxHarvesters = 0;
			maxTransporters = 2 + 2 * numSources;
			for (var id in room.memory.sources) {
				if (room.controller.level <= 3) {
					maxHarvesters += room.memory.sources[id].maxHarvesters;
				}
				else {
					maxHarvesters++;
				}

				if (!maxHarvesterSize || maxHarvesterSize < room.memory.sources[id].maxWorkParts) {
					maxHarvesterSize = room.memory.sources[id].maxWorkParts;
				}

				var assignedHarvesters = _.filter(harvesters, (creep) => creep.memory.fixedSource == id);
				var totalWork = 0;
				for (var i in assignedHarvesters) {
					var harvester = assignedHarvesters[i];
					if (harvester) {
						totalWork += harvester.body.work;
					}
				}

				if (totalWork < room.memory.sources[id].maxWorkParts && room.memory.sources[id].harvesters.length < room.memory.sources[id].maxHarvesters) {
					spawnHarvester = true;
					spawnHarvesterTarget = id;
				}

				// If we have a link to beam energy around, we'll need less transporters.
				if (room.memory.sources[id].targetLink && room.memory.controllerLink) {
					maxTransporters--;
				}
			}
		}

		// Need less transporters if energy gets beamed around the place a lot.
		if (room.memory.controllerLink && room.memory.storageLink) {
			maxTransporters--;
		}

		var maxUpgraders = 0;
		if (room.controller.level <= 3) {
			maxUpgraders = 1 + numSources;
		}
		else {
			if (gameState.getStoredEnergy(room) < 100000) {
				maxUpgraders = 0;
			}
			else if (gameState.getStoredEnergy(room) < 500000) {
				maxUpgraders = 1;
			}
			else {
				// @todo Have maximum depend on number of work parts.
				// @todo Make sure enough energy is brought by.
				maxUpgraders = 2;
			}
		}
		if (maxUpgraders == 0 && room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[room.controller.level] * 0.5) {
			console.log('trying to spawn upgrader because controller is close to downgrading', room.controller.ticksToDowngrade, '/', CONTROLLER_DOWNGRADE[room.controller.level]);
			// Even if no upgraders are needed, at least create one when the controller is getting close to being downgraded.
			maxUpgraders = 1;
		}

		// Only spawn an amount of builders befitting the amount of construction to be done.
		var maxBuilders = 0;
		var constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);

		var containers = room.find(FIND_STRUCTURES, {
				filter: (structure) => structure.structureType == STRUCTURE_CONTAINER || structure.structureType == STRUCTURE_STORAGE
			});

		if (constructionSites) {
			maxBuilders = Math.min(1 + numSources, Math.ceil(constructionSites.length / 5));
		}

		if (numHarvesters < 1 || (room.energyAvailable < 300 && room.energyCapacityAvailable > 500 && numHarvesters < 3)) {
			if (spawn.spawnHarvester(true, maxHarvesterSize)) {
				return true;
			}
		}
		else if (numTransporters < 1 && containers.length > 0) {
			if (spawn.spawnTransporter(true)) {
				return true;
			}
		}
		else if (builders.length < maxBuilders || (room.energyAvailable < 300 && room.energyCapacityAvailable > 500 && builders.length < maxBuilders)) {
			if (spawn.spawnBuilder(true)) {
				return true;
			}
		}
		else if (spawnHarvester && numHarvesters < maxHarvesters) {
			if (spawn.spawnHarvester(false, maxHarvesterSize, spawnHarvesterTarget)) {
				return true;
			}
		}
		else if ((numTransporters < (maxTransporters / 2)) && containers.length > 0) {
			if (spawn.spawnTransporter()) {
				return true;
			}
		}
		else if (upgraders.length < maxUpgraders || (room.energyAvailable < 300 && room.energyCapacityAvailable > 300 && maxUpgraders < 0)) {
			if (spawn.spawnUpgrader()) {
				return true;
			}
		}
		else if (builders.length < maxBuilders) {
			if (spawn.spawnBuilder()) {
				return true;
			}
		}
		else if ((numTransporters < maxTransporters) && containers.length > 0) {
			if (spawn.spawnTransporter()) {
				return true;
			}
		}
		else if (repairers.length < 2) {
			// @todo Determine total decay in room and how many worker parts that would need.
			if (spawn.spawnRepairer()) {
				return true;
			}
		}
		else {
			// Spawn squads.
			var spawnFlags = room.find(FIND_FLAGS, {
				filter: (flag) => flag.name.startsWith('SpawnSquad:')
			});
			for (var i in spawnFlags) {
				var flag = spawnFlags[i];
				var commandParts = flag.name.split(':');
				var squadName = commandParts[1];

				if (!Memory.squads[squadName]) var squad = new Squad(squadName);
				if (Memory.squads[squadName].fullySpawned) continue;

				// @todo Initialize Game.squads in main loop and use that.
				var squad = new Squad(squadName);
				if (squad.spawnUnit(spawn)) {
					return true;
				}
			}
		}

		// Remote harvesting temporarily disabled until CPU is better.
		if (Game.cpu.bucket < 8000) {
			continue;
		}

		// Remote Harvesting
		var harvestFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('HarvestRemote'));
		for (var i in harvestFlags) {
			let flag = harvestFlags[i];
			let isSpecificFlag;

			// Don't harvest from claimed rooms
			if (flag.name.startsWith('HarvestRemote:')) {
				let part = flag.name.split(':');
				if (part[1] && part[1] != spawn.pos.roomName) {
					continue;
				}
				isSpecificFlag = true;
			}

			if (Game.map.getRoomLinearDistance(spawn.pos.roomName, flag.pos.roomName) > 1 && !isSpecificFlag) {
				continue;
			}

			// @todo: Send bruiser to clean up unsafe rooms

			// it's safe to harvest
			var doSpawn = true;
			var flagPosition = utilities.encodePosition(flag.pos);
			var position = spawn.pos;
			if (spawn.room.storage) {
				position = spawn.room.storage.pos;
			}
			position = utilities.encodePosition(position);

			// Cache path when possible.
			try {
				utilities.precalculatePaths(spawn.room, flag);
			}
			catch (e) {
				console.log('Error in pathfinding:', e);
				console.log(e.stack);
			}

			if (spawn.room.memory.remoteHarvesting && spawn.room.memory.remoteHarvesting[flagPosition]) {
				var memory = spawn.room.memory.remoteHarvesting[flagPosition];
				doSpawn = false;

				memory.harvesters = [];
				var haulCount = 0;
				var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester.remote' && creep.memory.storage == position && creep.memory.source == flagPosition);
				var haulers = _.filter(Game.creeps, (creep) => creep.memory.role == 'hauler' && creep.memory.storage == position && creep.memory.source == flagPosition);

				var maxRemoteHarvesters = 1;
				var maxRemoteHaulers = 0;
				if (memory.revenue > 0 || memory.hasContainer) {
					// @todo Calculate number of needed haulers.
					maxRemoteHaulers = 1;

					if (Game.rooms[flag.pos.roomName]) {
						let room = Game.rooms[flag.pos.roomName];
						if (room.controller && (room.controller.my || (room.controller.reservation && room.controller.reservation.username == username))) {
							maxRemoteHaulers = 2;
						}
					}
				}
				var maxCarryParts = null;
				if (memory.travelTime) {
					maxCarryParts = Math.ceil(memory.travelTime * SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME / CARRY_CAPACITY);
					//console.log('Need', maxCarryParts, 'carry parts when transporting remotely harvested energy from', flagPosition);
				}

				for (var j in harvesters) {
					var creep = harvesters[j];
					if (!memory.travelTime || creep.ticksToLive > memory.travelTime || creep.ticksToLive > 500 || creep.spawning) {
						memory.harvesters.push(creep.id);
					}
				}
				/*if (flag.pos.roomName == 'E49S46')
				console.log('--', flagPosition, 'harvesters:', memory.harvesters.length, '/', maxRemoteHarvesters);//*/
				if (memory.harvesters.length < maxRemoteHarvesters) {
					doSpawn = true;
				}

				for (var j in haulers) {
					let creep = haulers[j];
					//console.log(creep.memory.storage, position, creep.memory.source, flagPosition);
					if (!memory.travelTime || creep.ticksToLive > memory.travelTime || creep.ticksToLive > 500 || creep.spawning) {
						haulCount++;
					}
				}
				/*if (flag.pos.roomName == 'E49S46')
				console.log('--', flagPosition, 'haulers:', haulCount, '/', maxRemoteHaulers, '@', maxCarryParts);//*/
				// @todo: Define SpawnHauler
				/*if (haulCount < maxRemoteHaulers && !doSpawn) {
					// Spawn hauler if necessary, but not if harvester is needed first.
					if (spawn.spawnHauler(flag.pos, maxCarryParts)) {
						return true;
					}
				}*/
			}

			if (doSpawn) {
				if (spawn.spawnRemoteHarvester(flag.pos)) {
					spawn.room.memory.remoteHarvesting[flagPosition] = memory;
					return true;
				}
			}
		}

		// Last but not least: Scouts.
		// @todo Spawn scout closest to where we're gonna send it.
		/*
		var maxScouts = 1;
		var scouts = _.filter(Game.creeps, (creep) => creep.memory.role == 'scout');
		if (scouts.length < maxScouts) {
			if (spawn.spawnScout()) {
				return true;
			}
		}*/

		// Let only one spawner spawn each tickt to prevent confusion.
		break;
	}
};

/**
 * Spawn a remote harvester
 */
StructureSpawn.prototype.spawnRemoteHarvester = function (targetPosition) {
	var bodyWeights = {move: 0.5, work: 0.2, carry: 0.3};
	var maxParts = {work: 3};
	if (this.room.controller.my) {
		var username = this.room.controller.owner.username;
	}

	// Use less work parts if room is not reserved yet.
	if (Game.rooms[targetPosition.roomName]) {
		let room = Game.rooms[targetPosition.roomName];
		if (room.controller && (room.controller.my || (room.controller.reservation && room.controller.reservation.username == username))) {
			maxParts.work = 6;
		}
	}

	// Use less move parts if a road has already been established.
	if (this.room.memory.remoteHarvesting && this.room.memory.remoteHarvesting[utilities.encodePosition(targetPosition)] && this.room.memory.remoteHarvesting[utilities.encodePosition(targetPosition)].revenue > 0) {
		// @todo Use calculated max size like normal harvesters.
		bodyWeights = {move: 0.35, work: 0.55, carry: 0.1};
	}

	var position = this.pos;
	if (this.room.storage) {
		position = this.room.storage.pos;
	}

	var result = this.createManagedCreep({
		role: 'harvester.remote',
		bodyWeights: bodyWeights,
		maxParts: maxParts,
		memory: {
			storage: utilities.encodePosition(position),
			source: utilities.encodePosition(targetPosition),
		},
	});

	if (result) {
		var cost = 0;
		for (var part in Memory.creeps[result].body) {
			var count = Memory.creeps[result].body[part];
			cost += BODYPART_COST[part] * count;
		}
		stats.addRemoteHarvestCost(this.room.name, utilities.encodePosition(targetPosition), cost);
	}

	return result;
};

/**
 * Spawns a new builder.
 */
StructureSpawn.prototype.spawnBuilder = function (force) {
	if (force && this.room.energyAvailable >= 200) {
		var maxCost = this.room.energyAvailable;
	}
	return this.createManagedCreep({
		role: 'builder',
		bodyWeights: {move: 0.35, work: 0.35, carry: 0.3},
		maxParts: {work: 5},
		memory: {
			singleRoom: this.pos.roomName,
		},
	});
};

/**
 * Spawns a new harvester.
 */
StructureSpawn.prototype.spawnHarvester = function (force, maxSize, sourceID) {
	var maxCost = null;
	if (force && this.room.energyAvailable >= 200) {
		maxCost = this.room.energyAvailable;
	}

	return this.createManagedCreep({
		role: 'harvester',
		bodyWeights: {move: 0.1, work: 0.7, carry: 0.2},
		maxCost: maxCost,
		maxParts: maxSize ? {work: maxSize} : null,
		memory: {
			singleRoom: this.pos.roomName,
			fixedSource: sourceID,
		},
	});
};

/**
 * Spawns a new repairer.
 */
StructureSpawn.prototype.spawnRepairer = function () {
	return this.createManagedCreep({
		role: 'repairer',
		bodyWeights: {move: 0.35, work: 0.35, carry: 0.3},
		maxParts: {work: 5},
		memory: {
			singleRoom: this.pos.roomName,
		},
	});
};

/**
 * Spawns a new transporter.
 */
StructureSpawn.prototype.spawnTransporter = function (force) {
	var maxCost = 600;
	if (force && this.room.energyAvailable >= 250) {
		maxCost = Math.min(maxCost, this.room.energyAvailable);
	}

	return this.createManagedCreep({
		role: 'transporter',
		bodyWeights: {move: 0.35, carry: 0.65},
		maxCost: maxCost,
		memory: {
			singleRoom: this.pos.roomName,
		},
	});
};

/**
 * Spawns a new upgrader.
 */
StructureSpawn.prototype.spawnUpgrader = function () {
	var bodyWeights = {move: 0.35, work: 0.3, carry: 0.35};
	if (this.room.memory.controllerContainer || this.room.memory.controllerLink) {
		bodyWeights = {move: 0.2, work: 0.75, carry: 0.05};
	}

	return this.createManagedCreep({
		role: 'upgrader',
		bodyWeights: bodyWeights,
		maxParts: {work: 15},
		memory: {
			singleRoom: this.pos.roomName,
		},
	});
};

/**
 * Spawns a new scout.
 */
StructureSpawn.prototype.spawnScout = function () {
	return this.createManagedCreep({
		role: 'scout',
		body: [MOVE],
		memory: {},
	});
};

/**
 * Handles logic for spawning creeps in rooms, and spawning creeps to go
 * outside of these rooms.
 */
var spawnManager = {

	/**
	 * Manages spawning logic for all spawns.
	 */
	manageSpawns: function () {
		for (var roomName in Game.rooms) {
			var room = Game.rooms[roomName];
			if (room.controller && room.controller.my) {
				room.manageSpawns();
			}
		}
	},

};

module.exports = spawnManager;