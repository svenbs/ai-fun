var utilities = require('utilities');

/**
 * Brainstorming
 */
var structureManager = {

	/**
	 * Build a room after defined variables.
	 * Connects all structures with roads and builds @todo containers, storage, @todo extensions, @todo links
	 */

	// @todo Build extensions around spawn?
	// @todo Where to place towers? - from level 3 controller
	// @todo Build Links @storage and controller

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

		// Only check roomStructures every 100 Game-Ticks (this is about 6 to 7 minutes (20.08.2016))
		if (!room.memory.lastStructureCheck) {
			room.memory.lastStructureCheck = Game.time;
		}
		if (room.memory.lastStructureCheck > Game.time - 100) {
			return false;
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


		// Get Storage-Object if there is one in the room.
		var storage = room.find(FIND_MY_STRUCTURES, {
			filter: { structureType: STRUCTURE_STORAGE }
		});
		var storagePosition = room.getStorageLocation();

		// Build Ramparts above all critical structures.
		if (room.controller.level > 2) {
			var spawns = room.find(FIND_MY_STRUCTURES, {
				filter: { structureType: STRUCTURE_SPAWN }
			});
			for (let i in spawns) {
				var spawn = spawns[i];
				// API returns -7 INVALID_TARGET but with UI this works. I'll leave this in, eventually it will work?
				room.createConstructionSite(spawn.pos.x, spawn.pos.y, STRUCTURE_RAMPART);
			}
			if (room.controller.level > 3) {
				room.createConstructionSite(storagePosition.x, storagePosition.y, STRUCTURE_RAMPART);
			}

			// Build a tower.
			structureManager.buildTower(room);
		}

		// Build a Storage if controller is above level 3.
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
				// Build Rampart above storage
			}
		}


		room.memory.lastStructureCheck = Game.time;

	},

	/**
	 * Build a tower in a room.
	 */
	buildTower: function(room) {
		// calculate Tower-Position from the middle of the room.
		// Place tower and write Position into variable?

		var towers = room.find(FIND_MY_STRUCTURES, {
			filter: { structureType: STRUCTURE_TOWER }
		});

		// We need only one automatically placed tower
		if (towers && towers.length > 0) {
			return false;
		}

		// Calculate Position
		var towerPosition = structureManager.calculateTowerPosition(room);

		room.createConstructionSite(towerPosition.x, towerPosition.y, STRUCTURE_TOWER);
		console.log('create tower'); // Debug

		// Check for construction site or other structures
		/*var contents = room.lookAt(towerPosition.x, towerPosition.y);
		for (let i in contents) {
			var content = contents[i];
			console.log('create tower'); // Debug
		}*/
	},

	/**
	 * Calculates a central position for a tower.
	 */
	calculateTowerPosition: function(room) {
		if (room.memory.towerPosition) {
			return room.memory.towerPosition;
		}

		// Calculate Position from room center
		var x = 25;
		var y = 25;

		// Now that we have a base position, try to find the
		// closest spot that is surrounded by empty tiles.
		var dist = 0;
		var found = false;
		while (!found && dist < 10) {
			for (var tx = x - dist; tx <= x + dist; tx++) {
				for (var ty = y - dist; ty <= y + dist; ty++) {
					if (found) {
						continue;
					}

					if (tx == x - dist || tx == x + dist || ty == y - dist || ty == y + dist) {
						// Tile is only valid if it and all surrounding tiles are empty.
						var contents = room.lookAtArea(ty - 1, tx - 1, ty + 1, tx + 1, true);
						var clean = true;
						for (var i in contents) {
							var tile = contents[i];
							if (tile.type == 'terrain' && tile.terrain != 'plain' && tile.terrain != 'swamp') {
								clean = false;
								break;
							}
							if (tile.type == 'structure' || tile.type == 'constructionSite') {
								clean = false;
								break;
							}
						}

						if (clean) {
							found = true;
							room.memory.towerPosition = {
								x: tx,
								y: ty,
							};
						}
					}
				}
			}

			// @todo Limit dist and find "worse" free spot otherwise.
			dist++;
		}

		return room.memory.towerPosition;
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
