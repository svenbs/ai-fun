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
	if (!memory.body) {
		memory.body = {
			move: 0,
			carry: 0,
			work: 0,
			attack: 0,
			ranged_attack: 0,
			heal: 0,
			claim: 0,
			tough: 0,
			set partSetter (input) {
				this[input] += 1;
			},
		};
	}
	if (options.body) {
		for (let i in options.body) {
			var part = options.body[i];

			memory.body.partSetter = part;
		}
	}

	// Generate creep name.
	if (!Memory.creepCounter) {
		Memory.creepCounter = {};
	}
	if (!Memory.creepCounter[memory.role]) {
		Memory.creepCounter[memory.role] = 0;
	}
	var newName = memory.role + Memory.creepCounter[memory.role];

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
					if (room.energyCapacityAvailable <= 300) {
						maxTransporters--;
					}
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
						totalWork += harvester.memory.body.work;
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
			maxUpgraders = 1 + numSources + Math.floor(gameState.getStoredEnergyAll(room) / 2000);
		}
		else {
			if (gameState.getStoredEnergyAll(room) < 100000) {
				maxUpgraders = 0;
			}
			else if (gameState.getStoredEnergyAll(room) < 500000) {
				maxUpgraders = 1;
			}
			else {
				// @todo Have maximum depend on number of work parts.
				// @todo Make sure enough energy is brought by.
				maxUpgraders = 2;
			}
		}
		if (maxUpgraders == 0 && room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[room.controller.level] * 0.5 && upgraders.length <= 0 ) {
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

		// Only spawn builders befitting the room level and room energy
		if (constructionSites && constructionSites.length > 0) {
			// With controller level below 3 and no extensions build Spawn only 2 Builders.
			var maxBuilderLevel = 0;
			/*if (room.controller.level < 3 && room.energyCapacityAvailable < 300) {
				console.log('MaxBuilders Set'); // Debug
				maxBuilderLevel = 3;
			}*/
			maxBuilders = Math.min(1 + numSources, Math.ceil(constructionSites.length / 5));

			if (maxBuilderLevel > 0) {
				maxBuilders = Math.min(maxBuilders, maxBuilderLevel);
			}
		}

		var tried_spawning = false;
		var energyAvail = gameState.getStoredEnergyAll(room);

		if (numHarvesters < 1 /*|| (room.energyAvailable < 300 && room.energyCapacityAvailable > 500 && numHarvesters < 1)*/) {
			if (spawn.spawnHarvester(true, maxHarvesterSize, spawnHarvesterTarget)) {
				return true;
			}
			tried_spawning = true;
		}
		else if (numTransporters < 1 && containers.length > 0) {
			if (spawn.spawnTransporter(true)) {
				return true;
			}
			tried_spawning = true;
		}
		else if (spawnHarvester && numHarvesters < maxHarvesters) {
			if (spawn.spawnHarvester(false, maxHarvesterSize, spawnHarvesterTarget)) {
				return true;
			}
			tried_spawning = true;
		}
		else if ((numTransporters < (maxTransporters / 2)) && containers.length > 0) {
			if (spawn.spawnTransporter()) {
				return true;
			}
			tried_spawning = true;
		}
		else if (upgraders.length < maxUpgraders || (room.energyAvailable < 300 && room.energyCapacityAvailable > 300 && maxUpgraders < 0)) {
			if (spawn.spawnUpgrader()) {
				return true;
			}
			tried_spawning = true;
		}
		else if (energyAvail < room.energyCapacityAvailable * 1.5) {
			var containers = room.find(FIND_STRUCTURES, {
				filter: { structureType: STRUCTURE_CONTAINER }
			});
			if (containers && containers.length > 0) {
				return false;
			}
		}
		else if (builders.length < maxBuilders) {
			if (spawn.spawnBuilder()) {
				return true;
			}
			tried_spawning = true;
		}
		else if ((numTransporters < maxTransporters) && containers.length > 0) {
			if (spawn.spawnTransporter()) {
				return true;
			}
			tried_spawning = true;
		}
		// Spawn repairers only in Rooms above level 2
		else if (repairers.length < 2) {
			if (spawn.room.controller.level > 2) {
				// @todo Determine total decay in room and how many worker parts that would need.
				if (spawn.spawnRepairer()) return true;
			}
			// Or if structures are starting to decay
			else {
				var structures = spawn.room.find(FIND_STRUCTURES, {
					filter: (structure) => structure.hits < structure.hitsMax * 0.5
				});

				if (structures && structures.length > 0) {
					if (spawn.spawnRepairer()) return true;
				}
			}
			tried_spawning = true;
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
				if (Memory.squads[squadName].fullySpawned && !Memory.squads[squadName].refreshUnits) continue;

				// @todo Initialize Game.squads in main loop and use that.
				var squad = new Squad(squadName);
				if (squad.spawnUnit(spawn)) {
					return true;
				}
			}
		}
		// Make sure remote creeps are only spawned if this room has enough.
		if (tried_spawning) {
			return false;
			console.log('Spawning did not work for a reason - low energy?'); // Debug
		}

		// If possible claim rooms
		var numRooms = _.size(_.filter(Game.rooms, (room) => room.controller && room.controller.my));
		var maxRooms = Game.gcl.level;
		var claimFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('ClaimRoom'));

		if (claimFlags && /*numRoom < maxRooms &&*/ claimFlags.length > 0) {
			for (let i in claimFlags) {
				var flag = claimFlags[i];

				if (Game.rooms[flag.pos.roomName] && Game.rooms[flag.pos.roomName].controller.my) {
					// Room is already claimed
					continue;
				}

				// Make sure only the closest room spawns a claimer!
				var min = null;
				for (let j in Game.rooms) {
					if (Game.rooms[j].controller && Game.rooms[j].controller.my) {
						if (!min || Game.map.getRoomLinearDistance(Game.rooms[j].name, flag.pos.roomName) < min) {
							min = Game.map.getRoomLinearDistance(Game.rooms[j].name, flag.pos.roomName);
						}
					}
				}
				if (Game.map.getRoomLinearDistance(spawn.pos.roomName, flag.pos.roomName) <= min) {
					var claimers = _.filter(Game.creeps, (creep) => {
						if (creep.memory.role == 'claimer' && creep.memory.mission == 'claim' && creep.memory.target == utilities.encodePosition(flag.pos)) {
							return true
						}
						return false;
					});

					if (!claimers || claimers.length < 1) {
						var result = spawn.spawnClaimer(flag.pos, 'claim');
						if (spawn.spawnClaimer(flag.pos, 'claim')) {
							console.log('sending new claimer to ' + flag.pos.roomName);
							return true;
						}
					}
				}
			}
		}
		if (claimFlags && claimFlags.length > 0) {
			// Check for rooms that are marked for claiming and belong to us.
			for (let i in claimFlags) {
				var flag = claimFlags[i];

				if (Game.rooms[flag.pos.roomName]  && Game.rooms[flag.pos.roomName].controller.my) {
					// Make sure only the closest room spawn builders!
					var min = null;
					for (let j in Game.rooms) {
						let hasSpawn = Game.rooms[j].find(FIND_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_SPAWN });
						if (hasSpawn && hasSpawn.length > 0 && Game.rooms[j].controller && Game.rooms[j].controller.my) {
							if (!min || Game.map.getRoomLinearDistance(Game.rooms[j].name, flag.pos.roomName) < min) {
								min = Game.map.getRoomLinearDistance(Game.rooms[j].name, flag.pos.roomName);
							}
						}
					}
					if (Game.map.getRoomLinearDistance(spawn.pos.roomName, flag.pos.roomName) <= min) {
						var maxRemoteBuilders = 2;
						var builders = _.filter(Game.creepsByRole['builder.remote'] || [], (creep) => {
							if (creep.memory.target == utilities.encodePosition(flag.pos)) {
								return true;
							}
							return false;
						});

						if (!builders || builders.length < maxRemoteBuilders) {
							if (spawn.spawnRemoteBuilder(flag.pos)) {
								console.log('sending new remote builder to', utilities.encodePosition(flag.pos));
								return true;
							}
						}
					}
				}
			}
		}

		// Remote harvesting temporarily disabled until CPU is better.
		if (Game.cpu.bucket < 8000) {
			Game.notify('CPU-Bucket below 8000: '+Game.cpu.bucket);
			continue;
		}

		// Remote Harvesting
		var harvestFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('HarvestRemote'));
		for (var i in harvestFlags) {
			let flag = harvestFlags[i];
			let isSpecificFlag;
			var maxRemoteHarvesters;

			// Don't harvest from claimed rooms
			if (flag.name.startsWith('HarvestRemote:')) {
				let part = flag.name.split(':');
				if (part[1] && part[1] != spawn.pos.roomName) {
					continue;
				}
				isSpecificFlag = true;
			}
			if (flag.name.startsWith('HarvestRemote:')) {
				let part = flag.name.split(':');
				if (part[2]) {
					maxRemoteHarvesters = part[2];
				}
			}
			stats.initRemoteHarvestMemory(spawn.pos.roomName, utilities.encodePosition(flag.pos));

			if (Game.map.getRoomLinearDistance(spawn.pos.roomName, flag.pos.roomName) > 1 && !isSpecificFlag) {
				continue;
			}

			// Send bruiser to clean up unsafe rooms
			var roomMemory = Memory.rooms[flag.pos.roomName];
			if (roomMemory && roomMemory.enemies && !roomMemory.enemies.safe) {
				var position = spawn.pos;
				if (spawn.room.storage) {
					position = spawn.room.storage.pos;
				}

				// Since we just want a brawler in the room - not one per remoteharvest source - generalize target position.
				var brawlPosition = new RoomPosition(25, 25, flag.pos.roomName);

				var maxBrawlers = 1;
				var brawlers = _.filter(Game.creepsByRole.brawler || [], (creep) => {
					if (creep.memory.storage == utilities.encodePosition(position) && creep.memory.target == utilities.encodePosition(brawlPosition)) {
						return true;
					}
					return false;
				});

				if (!brawlers || brawlers.length < maxBrawlers) {
					let result = spawn.spawnBrawler(brawlPosition, 4);
					if (result) {

						if (result) {
							let position = utilities.encodePosition(flag.pos);
							console.log('Spawning new brawler to defend', position, ':', result);

							let cost = 0;
							for (let partType in Memory.creeps[result].body) {
								cost += BODYPART_COST[partType] * Memory.creeps[result].body[partType];
							}
							stats.addRemoteHarvestDefenseCost(spawn.room.name, position, cost);
						}
					}
					// Do not continue trying to spawn other creeps when defense is needed.
					return true;
				}
			}

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
				Game.notify('Error in pathfinding:', e);
				Game.notify(e.stack);
			}

			if (spawn.room.memory.remoteHarvesting && spawn.room.memory.remoteHarvesting[flagPosition]) {
				var memory = spawn.room.memory.remoteHarvesting[flagPosition];
				doSpawn = false;

				memory.harvesters = [];
				var haulCount = 0;
				var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester.remote' && creep.memory.storage == position && creep.memory.source == flagPosition);
				var haulers = _.filter(Game.creeps, (creep) => creep.memory.role == 'hauler' && creep.memory.storage == position && creep.memory.source == flagPosition);

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
				/*if (flag.pos.roomName == 'E49S46')*/
				//console.log('--', flagPosition, 'harvesters:', memory.harvesters.length, '/', maxRemoteHarvesters);//
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

		// No harvester spawned? How about some claimers?
		var reserveFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('ReserveRoom'));
		for (var i in reserveFlags) {
			var flag = reserveFlags[i];
			let isSpecificFlag = false;

			// Make sure not to harvest from wrong rooms.
			if (flag.name.startsWith('ReserveRoom:')) {
				let parts = flag.name.split(':');
				if (parts[1] && parts[1] != spawn.pos.roomName) {
					continue;
				}
				isSpecificFlag = true;
			}

			if (Game.map.getRoomLinearDistance(spawn.pos.roomName, flag.pos.roomName) > 1 && !isSpecificFlag) {
				continue;
			}

			let doSpawn = false;

			var claimerIds = [];
			var claimers = _.filter(Game.creepsByRole.claimer || [], (creep) => creep.memory.mission == 'reserve');
			var maxClaimers = 1;

			for (var j in claimers) {
				var creep = claimers[j];

				if (creep.memory.target == utilities.encodePosition(flag.pos)) {
					claimerIds.push(creep.id);
				}
			}
			if (claimerIds.length < maxClaimers) {
				doSpawn = true;
			}
			if (Memory.rooms[flag.pos.roomName]
				&& Memory.rooms[flag.pos.roomName].lastClaim
				&& Memory.rooms[flag.pos.roomName].lastClaim.value + (Memory.rooms[flag.pos.roomName].lastClaim.time - Game.time) > CONTROLLER_RESERVE_MAX * 0.5
			) {
				doSpawn = false;
			}

			if (doSpawn) {
				let result = spawn.spawnClaimer(flag.pos, 'reserve');
				if (result) {
					// Add cost to a random harvest flag in the room.
					let harvestFlags = _.filter(Game.flags, (flag2) => {
						if (flag2.name.startsWith('HarvestRemote') && flag2.pos.roomName == flag.pos.roomName) {
							// Make sure not to harvest from wrong rooms.
							if (flag2.name.startsWith('HarvestRemote:')) {
								let parts = flag2.name.split(':');
								if (parts[1] && parts[1] != spawn.pos.roomName) {
									return false;
								}
							}
							return true;
						}
						return false;
					});

					if (harvestFlags.length > 0) {
						let cost = 0;
						for (let part in Memory.creeps[result].body) {
							let count = Memory.creeps[result].body[part];
							cost += BODYPART_COST[part] * count;
						}

						stats.addRemoteHarvestCost(spawn.room.name, utilities.encodePosition(_.sample(harvestFlags).pos), cost);
					}
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
			if (part == 'partSetter') continue;
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

StructureSpawn.prototype.spawnBrawler = function (targetPosition, maxAttackParts) {
	var maxParts = null;
	if (maxAttackParts) {
		maxParts = {attack: maxAttackParts};
	}

	var position = this.pos;
	if (this.room.storage) {
		position = this.room.storage.pos;
	}

	return this.createManagedCreep({
		role: 'brawler',
		bodyWeights: {move: 0.4, tough: 0.1, attack: 0.4, heal: 0.1},
		maxParts: maxParts,
		memory: {
			storage: utilities.encodePosition(position),
			target: utilities.encodePosition(targetPosition),
		},
	});
};

/**
 * Spawns a new claimer.
 */
StructureSpawn.prototype.spawnClaimer = function (targetPosition, mission) {
	//var minSize = BODYPART_COST[CLAIM] * 2 + BODYPART_COST[MOVE] * 3;
	//if (this.room.energyAvailable < minSize) return false;

	return this.createManagedCreep({
		role: 'claimer',
		bodyWeights: {move: 0.5, claim: 0.5},
		maxParts: {claim: 5},
		memory: {
			target: utilities.encodePosition(targetPosition),
			mission: mission,
		},
	});
};

/**
 * Spawns a new remote builder.
 */
StructureSpawn.prototype.spawnRemoteBuilder = function (targetPosition) {
	return this.createManagedCreep({
		role: 'builder.remote',
		bodyWeights: {move: 0.5, carry: 0.3, work: 0.2},
		//maxParts: {work: 5},
		memory: {
			target: utilities.encodePosition(targetPosition),
			starting: true,
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
