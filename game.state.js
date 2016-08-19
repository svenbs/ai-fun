var utilities = require('utilities');

var cache = {};

var gameState = {

	getStoredEnergy: function (room) {
		if (room.storage) {
			return room.storage.store[RESOURCE_ENERGY];
		}

		var storageLocation = room.getStorageLocation();
		var resources = room.find(FIND_DROPPED_ENERGY, {
			filter: (resource) => resource.resourceType == RESOURCE_ENERGY && resource.pos.x == storageLocation.x && resource.pos.y == storageLocation.y
		});
		if (resources && resources.length > 0) {
			return resources[0].amount;
		}

		return 0;
	},

	getStoredEnergyAll: function (room) {
		if (room.storage) {
			return room.storage.store[RESOURCE_ENERGY];
		}

		var avail_resources = 0;

		// Find dropped energy and add to avail_resources
		var resources = room.find(FIND_DROPPED_ENERGY, {
			filter: (resource) => resource.resourceType == RESOURCE_ENERGY
		});
		for (let i in resources) {
			avail_resources += resources[i].amount;
		}

		// Find all container stored energy and add to avail_resources
		var containers = room.find(FIND_STRUCTURES, {
			filter: (structure) => structure.structureType == STRUCTURE_CONTAINER && structure.store[RESOURCE_ENERGY] > 0
		})
		for (let i in containers) {
			avail_resources += containers[i].store[RESOURCE_ENERGY];
		}

		if (avail_resources && avail_resources > 0) {
			return avail_resources;
		}

		return 0;
	},

	getNumHarvesters: function (roomName) {
		return gameState.getHarvesters(roomName).length;
	},

	getHarvesters: function (roomName) {
		if (!cache.harvesters[roomName]) {
			cache.harvesters[roomName] = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester' && (!roomName || creep.pos.roomName == roomName));
		}
		return cache.harvesters[roomName];
	},

	getNumTransporters: function (roomName) {
		return gameState.getTransporters(roomName).length;
	},

	getTransporters: function (roomName) {
		if (!cache.transporters[roomName]) {
			cache.transporters[roomName] = _.filter(Game.creeps, (creep) => creep.memory.role == 'transporter' && (!roomName || creep.pos.roomName == roomName));
		}
		return cache.transporters[roomName];
	},

	getHostiles: function (roomName) {
		if (!cache.hostiles[roomName]) {
			cache.hostiles[roomName] = Game.rooms[roomName].find(FIND_HOSTILE_CREEPS);
		}
		return cache.hostiles[roomName];
	},

	getHostileStructures: function (roomName) {
		if (!cache.hostileStructures[roomName]) {
			cache.hostileStructures[roomName] = Game.rooms[roomName].find(FIND_HOSTILE_STRUCTURES);
		}
		return cache.hostileStructures[roomName];
	},

	getFriendlyCreeps: function (roomName) {
		if (!cache.friendlies[roomName]) {
			cache.friendlies[roomName] = Game.rooms[roomName].find(FIND_MY_CREEPS);
		}
		return cache.friendlies[roomName];
	},

	clearCache: function() {
		cache = {
			harvesters: {},
			transporters: {},
			hostiles: {},
			hostileStructures: {},
			friendlies: {},
		};
	}

};

module.exports = gameState;
