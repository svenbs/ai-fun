var utilities = require('utilities');

/**
 * Brainstorming
 */
var structureManager = {

	/**
	 * Build a room after defined variables.
	 * Connects all structures with roads and builds @todo containers, storage, @todo extensions, @todo links
	 */
	buildRoom: function(room) {
		// Don't try building in unowned rooms
		if (!room.controller && !room.controller.my) {
			return;
		}

		// Only build rooms if enough CPU is available.
		if (Game.cpu.bucket < 8000) {
			Game.notify('CPU-Bucket below 8000: '+Game.cpu.bucket);
			return;
		}

		// Only recheck roomStructures every 100 Game-Ticks (this is about 6 to 7 minutes (20.08.2016))
		if (room.memory.lastStructureCheck > Game.time - 100) {
			return false;
		}

		if (!room.memory.lastStructureCheck) {
			room.memory.lastStructureCheck = Game.time;
		}



		// Build Roads to every major structure in this room.
		structureManager.buildRoads(room);


		// Build HarvesterContainers
		if (!room.memory.sources) {
			// Make sure room is scanned.
			room.scan();
		}

		var sources = room.memory.sources;
		for (let i in sources) {
			var source = sources[i];
			// If source has no container build,
			if (!source.targetContainer && source.dropoffSpot) {
				// build one at designated dropoffSpot.
				room.createConstructionSite(source.dropoffSpot.x, source.dropoffSpot.y, STRUCTURE_CONTAINER);
			}
		};


		// Build a Storage if controller is above level 3.
		var storage = room.find(FIND_MY_STRUCTURES, {
			filter: { structureType: STRUCTURE_STORAGE }
		});
		var storagePosition = room.getStorageLocation();
		if (room.controller.level > 3 && room.memory.storage && storage.length <= 0) {
			var contents = room.lookAt(storagePosition.x, storagePosition.y);
			for (let i in contents) {
				var content = contents[i];
				var buildStorage = false;
				if (content.type == LOOK_STRUCTURES && content.structure.structureType != STRUCTURE_ROAD || content.type != LOOK_CONSTRUCTION_SITES) {
					buildStorage = true;
					break;
				}
				else {
					buildStorage = false;
					break;
				}
			}
			if (buildStorage) {
				room.createConstructionSite(storagePosition.x, storagePosition.y, STRUCTURE_STORAGE);
			}
		}

		room.memory.lastStructureCheck = Game.time;

		// Build extensions around spawn?

		// Where to place towers? - from level 3 controller
	},

	/**
	 * Builds a road to every major structure in the room.
	 */
	buildRoads: function(room) {
		if (!room.controller && !room.controller.my) {
			return;
		}

		var storage = room.storage;
		var sources = room.memory.sources;
		var controller = room.controller;
		var spawns = room.find(FIND_MY_STRUCTURES, {
			filter: { structureType: STRUCTURE_SPAWN }
		});

		for (let i in spawns) {
			var spawn = spawns[i];

			for (let source_id in sources) {
				var source = Game.getObjectById(source_id);
				if (storage) {
					structureManager.checkRoad(room, storage, source);
				}
				else {
					structureManager.checkRoad(room, spawn, source);
				}
			}

			if (room.storage && storage) {
				structureManager.checkRoad(room, storage, controller);
				structureManager.checkRoad(room, spawn, storage);
				// Build roads around storage for better accessibility.
				structureManager.checkRoadAtArea(room, storage.pos, 3);
			}
			else {
				structureManager.checkRoad(room, spawn, controller);
			}

			// Build roads around spawn for better accessibility.
			structureManager.checkRoadAtArea(room, spawn.pos, 3);
		}
	},

	/**
	 * Check and build a road between two points.
	 */
	checkRoad: function(room, source, target) {
		var path = source.pos.findPathTo(target.pos, {
			ignoreCreeps: true,
			//avoid: storagePosition,
		});

		for (let i in path) {
			var pos = path[i];
			var contents = room.lookAt(pos.x, pos.y);
			var buildRoad = false;
			for (let i in contents) {
				var content = contents[i];
				if (content.type != LOOK_STRUCTURES && content.type != LOOK_CONSTRUCTION_SITES) {
					buildRoad = true;
					break;
				}
				else {
					buildRoad = false;
					break;
				}
			}
			if (buildRoad) room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
		}
	},

	/**
	 * Check for roads around an RoomPosition.
	 */
	checkRoadAtArea: function(room, pos, area) {
		if (!room || !pos || !area) {
			throw new Error("structureManager.checkRoadAtArea: Some Variable is not defined (room, pos, area): " + room + ', ' + pos + ', ' + area);
			return;
		}
		pos.x = pos.x + (Math.floor(area / 2));
		pos.y = pos.y + (Math.floor(area / 2));
		for (var i = 0; i < area; i++) {
			for (var j = 0; j < area; j++) {
				var contents = room.lookAt(pos.x - i, pos.y - j);
				var buildRoad = true;
				for (let c in contents) {
					let content = contents[c];
					if (content.type == LOOK_CONSTRUCTION_SITES || content.type == LOOK_STRUCTURES || content.structureType == STRUCTURE_SPAWN || content.structureType == STRUCTURE_STORAGE) {
						buildRoad = false;
					}
				}
				if (buildRoad) room.createConstructionSite(pos.x - i, pos.y - j, STRUCTURE_ROAD);
			}
		}
	},
}

module.exports = structureManager;
