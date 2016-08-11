// import modules
// Screeps profiler stuff
var profiler = require('screeps-profiler');

require('utilities');

require('role.harvester');
require('role.harvester.remote');
require('role.transporter');
require('role.upgrader');
require('role.builder');
require('role.repairer');


var spawnManager = require('manager.spawn');
var intelManager = require('manager.intel');
var gameState = require('game.state');

Room.prototype.enhanceData = function () {
	this.sources = [];

	if (this.memory.intel) {
		let intel = this.memory.intel;

		if (intel.sources) {
			for (let i in intel.sources) {
				this.sources.push(Game.getObjectById(intel.sources[i]));
			}
		}
	}

	this.bays = {};
	let flags = this.find(FIND_FLAGS, {
		filter: (flag) => flag.name.startsWith('Bay:')
	});
	for (let i in flags) {
		try {
			this.bays[flags[i].name] = new Bay(flags[i].name);
		}
		catch (e) {
			console.log('Error when initializing Bays:', e);
			console.log(e.stack);
		}
	}
};


Creep.prototype.runLogic = function() {
	var creep = this;
	let role;

	if (creep.memory.tempRole) {
		role = creep.memory.tempRole;
	}
	else {
		role = creep.memory.role;
	}

	switch (role) {
			case "harvester":
				creep.runHarvesterLogic();
				break;
			case "harvester.remote":
				creep.runRemoteHarvesterLogic();
				break;
			case "transporter":
				creep.runTransporterLogic();
				break;
			case "upgrader":
				creep.runUpgraderLogic();
				break;
			case "builder":
				creep.runBuilderLogic();
				break;
			case "repairer":
				creep.runRepairerLogic();
				break;
			default:
				console.log('Error when managing creep', creep.name, ':');
				break;
		}
};


var main = {
	defendRoom: function(roomName) {

		var hostiles = Game.rooms[roomName].find(FIND_HOSTILE_CREEPS);

	if(hostiles.length > 0) {
			var username = hostiles[0].owner.username;
			Game.notify(`User ${username} spotted in room ${roomName}`);
			var towers = Game.rooms[roomName].find(
				FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}});
			towers.forEach(tower => tower.attack(hostiles[0]));
		}
	},

	manageCreeps: function () {
		for (let name in Game.creeps) {
			var creep = Game.creeps[name];

			if (creep.spawning) {
				continue;
			}

			creep.runLogic();
		}
	},

	/**
	 * Manage Structure (TODO)
	 */
	manageStructures: function() {
		//@TODO
	},

	/**
	 * Manage Towers (TODO)
	 */
	manageTowers: function() {
		//@TODO
	},

	/**
	 * Manage Links
	 */
	manageLinks: function() {
		for (let roomName in Game.rooms) {
			let room = Game.rooms[roomName];

			// Pump energy into controllerLink when possible
			if (room.memory.controllerLink) {
				var controllerLink = Game.getObjectById(room.memory.controllerLink);
				if (controllerLink && controllerLink.energy <= controllerLink.energyCapacity * 0.5) {
					var upgradeControllerSupplied = false;

					if (room.memory.sources){
						for (let id in room.memory.sources) {
							if (room.memory.sources[id].targetLink) {

								// There's a Link next to a source
								var link = Game.getObjectById(room.memory.sources[id].targetLink);

								if (!link) continue;

								if (link.energy >= link.energyCapacity * 0.5 && link.cooldown <= 0) {
									link.transferEnergy(controllerLink);
									upgradeControllerSupplied = true;
								}
							}
						}
					}

					if (!upgradeControllerSupplied && room.memory.storageLink) {
						var storageLink = Game.getObjectById(room.memory.storageLink);
						if (storageLink.energy >= storageLink.energyCapacity * 0.5 && storageLink.cooldown <= 0) {
							var result = storageLink.transferEnergy(controllerLink);
							upgradeControllerSupplied = true;
						}
					}
				}
			}
		}
	},
}

// Enable profiling of all methods in Game object protitypes defined up to now.
profiler.enable();

module.exports.loop = function () {
	profiler.wrap(function() {
		if (Game.time % 10 == 0 && Game.cpu.bucket < 9800) {
			console.log('Bucket:', Game.cpu.bucket);
		}

		var time = Game.cpu.getUsed();

		// Clear gameState cache variable, since it seems to persist between Ticks from time to time.
		gameState.clearCache();

		// Add data to room objects.
		for (let roomName in Game.rooms) {
			Game.rooms[roomName].enhanceData();
		}


		// check for memory entries of died creeps by iterating over Memory.creeps
		for (let name in Memory.creeps) {
			// and checking if the creep is still alive
			if (Game.creeps[name] == undefined) {
				// if not, delete the memory entry
				delete Memory.creeps[name];
			}
		}

		// Make sure memory structure is available.
		if (!Memory.timers) {
			Memory.timers = {};
		}

		var initCPUUsage = Game.cpu.getUsed() - time;
		time = Game.cpu.getUsed();

		spawnManager.manageSpawns();

		var spawnCPUUsage = Game.cpu.getUsed() - time;
		time = Game.cpu.getUsed();

		// @todo
		//main.manageStructures();

		var linksCPUUsage = Game.cpu.getUsed() - time;
		time = Game.cpu.getUsed();

		main.manageCreeps();

		var creepsCPUUsage = Game.cpu.getUsed() - time;
		time = Game.cpu.getUsed();

		// @todo
		//main.manageTowers();

		var towersCPUUsage = Game.cpu.getUsed() - time;
		time = Game.cpu.getUsed();

		main.manageLinks();

		var linksCPUUsage = Game.cpu.getUsed() - time;
		time = Game.cpu.getUsed();

		// Gather intel
		try {
			intelManager.scout();
		}
		catch (e) {
			console.log('Error in intelManager.scout:', e);
		}

		// @todo: put into manageTowers
		for (let roomName in Game.rooms) {
			main.defendRoom(roomName);
		}

	});
};
