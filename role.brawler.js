var gameState = require('game.state');
var utilities = require('utilities');

/**
 * Create priority list of hostile creeps
 */
Creep.prototype.calculateMilitaryTarget = function() {
	var creep = this;
	var best = utilities.getBestOption(creep.getAvailableHostileCreeps());

	if (best) {
		var action = 'heal';
		if (best.type == 'hostilecreep' || best.type == 'hostilestructure') {
			action = 'attack';
		}
		else if (best.type == 'controller') {
			action = 'claim';
		}
		creep.memory.order = {
			type: action,
			target: best.object.id,
		};
	}
	else {
		delete creep.memory.order;
	}
};

/**
 * Get a list of hostile creeps
 */
Creep.prototype.getAvailableHostileCreeps = function() {
	var creep = this;
	var options = [];

	if (creep.memory.target) {
		var targetPosition = utilities.decodePosition(creep.memory.target);
		if (creep.pos.roomName == targetPosition.roomName) {

			// Find hostiles to attack
			if ((creep.memory.body.attack || creep.memory.body.ranged_attack) && (creep.memory.body.attack > 0 || creep.memory.body.ranged_attack > 0)) {
				var hostiles = gameState.getHostiles(creep.pos.roomName);

				if (hostiles && hostiles.length > 0) {
					for (let i in hostiles) {
						var hostile = hostiles[i];
						if (hostile.isDangerous()) {
							// Get enemy Parts (@todo: Check if this could cause performance issues)
							var attackparts = _.filter(hostile.body, (part) => part.type == ATTACK).length;
							var rangedparts = _.filter(hostile.body, (part) => part.type == RANGED_ATTACK).length;
							var toughparts  = _.filter(hostile.body, (part) => part.type == TOUGH).length;
							var healparts   = _.filter(hostile.body, (part) => part.type == HEAL).length;

							// @todo: Calculate weight / priority from HP left / Maybe Range - may cause my squads to scatter? (creep.pos.getRangeTo(hostile) / 100) +
							var option = {
								priority: 5,
								weight: 1 - ((((attackparts + rangedparts) / toughparts) + (healparts / 5)) / 100),
								//weight: 0,
								type: 'hostilecreep',
								object: hostile,
							};
						}
						else {
							var option = {
								priority: 0,
								weight: 2,
								type: 'hostilecreep',
								object: hostile,
							};
						}

						options.push(option);
					}
				}

				var structures = _.filter(gameState.getHostileStructures(creep.pos.roomName), (structure) => {
					structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_STORAGE
				});

				if (structures && structures.length > 0) {
					for (let i in structures) {
						var structure = structures[i];

						var option = {
							priority: 2,
							weight: 0,
							type: 'hostilestructure',
							object: structure,
						};

						if (structure.structureType == STRUCTURE_SPAWN) {
							option.priority = 4;
						}
						else if (structure.structureType == STRUCTURE_TOWER) {
							option.priority = 3;
						}
					}
				}

				// @todo: Find walls or ramparts in front of controller
				// @todo: Find Controller
			}
			if (creep.memory.body.heal > 0) {
				var damaged = _.filter(gameState.getFriendlyCreeps(creep.pos.roomName), (friendly) => {
					friendly.id != creep.id && 	friendly.hits < friendly.hitsMax
				});

				if (damaged && damaged.length > 0) {
					for (let i in damaged) {
						friendly = damaged[i];

						var option = {
							priority: 3,
							weight: 1 - ((friendly.hits / friendly.hitsMax) / 100),
							type: 'friendlycreep',
							object: friendly,
						};

						options.push(option);
					}
				}
				var friendlies = _.filter(gameState.getFriendlyCreeps(creep.pos.roomName), (friendly) => {
					friendly.id != creep.id && creep.memory.body.attack.length >= 0 && creep.memory.body.ranged >= 0
				});
				// If no damaged creep is found, stay close to other creeps
				if (friendlies && friendlies.length > 0) {
					for (let i in friendlies) {
						friendly = friendlies[0];

						var option = {
							priority: 1,
							weight: 1 - (creep.pos.getRangeTo(friendly) / 100),
							type: 'friendlycreep',
							object: friendly,
						};

						options.push(option);
					}
				}
			}
			if (creep.memory.body.claim && creep.memory.body.claim >= 5) {
				// @todo: Attack / Reserve controller
			}
		}
	}
	// Vielleicht hilfreich? Sorgt dafür, dass nicht alle creeps das selbe Ziel attackieren
	/*if (creepGeneral.getCreepsWithOrder('attack', hostile.id).length > 3) {
		option.priority -= 1;
	}
	options.push(option);*/
	return options;
};

Creep.prototype.executeMilitaryMoveOrders = function(squad) {
	var creep = this;

	// Move to room
	if (creep.memory.target) {
		var targetPosition = utilities.decodePosition(creep.memory.target);
		if (creep.pos.roomName != targetPosition.roomName) {
			creep.moveTo(targetPosition);
			return true;
		}
	}

	// If inside designated room
	if (creep.memory.order) {
		var target = Game.getObjectById(creep.memory.order.target);
		if (!creep.room.controller) {
			if (target) {
				var result = creep.moveTo(target, {
					reusePath: 0,
					ignoreDestructibleStructures: creep.memory.body.attack > 0,
				});
			}
		}
		else {
			if (target) {
				var result = creep.moveTo(target, {
					reusePath: 0,
					ignoreDestructibleStructures: !creep.room.controller.my && (creep.memory.body.attack > 0 || creep.memory.body.ranged > 0),
				});
			}
		}
	}
	else {
		if (creep.memory.squadName) {
			var best = utilities.getBestOption(squad.getOrders());

			if (best && best.target) {
				creep.moveTo(best.target);
				return;
			}
		}

		creep.moveTo(25, 25, {
			reusePath: 50,
		});
	}

	// Ranged units shall try to keep some distance
	if (creep.memory.body.ranged_attack > 0) {
		var target = Game.getObjectById(creep.memory.order.target);
		//var enemies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2);
		//if (enemies && enemies.length > 0) {

			// Reversed Directions-Array
			// @todo: Maybe define this globally - Use variant from utilities
			var directions = [
					{ key: BOTTOM,			value: 0, },
					{ key: BOTTOM_LEFT,		value: 0, },
					{ key: LEFT,			value: 0, },
					{ key: TOP_LEFT,		value: 0, },
					{ key: TOP,				value: 0, },
					{ key: TOP_RIGHT,		value: 0, },
					{ key: RIGHT,			value: 0, },
					{ key: BOTTOM_RIGHT,	value: 0, },
					];

			if (creep.pos.getRangeTo(target) < 3) {
				var direction = creep.pos.getDirectionTo(target);
				directions[direction -1].value += 1;

				/*for (let i in enemies) {
					var enemy = enemies[i];
					let direction = creep.pos.getDirectionTo(enemy);
					// Direction start with 1 - for our array we need them to start at 0
					directions[direction - 1].value += 1;
				}*/

				// Flee to best direction.
				//var direction;
				for (var i = 0; i < directions.length; i++) {
					var max = 0;
					if (max < directions[i].value) {
						direction = directions[i].key;
						max = directions[i].value;
					}
				}

				// This will search another path if current one is blocked by an obstacle
				var newPosition = utilities.decodeDirection(creep, direction);
				var blocking = false;
				// We need 3 iterations to check the two closest squares for blocking obstacles
				for (var i = 0; i < 3; i++) {
					if (utilities.checkForObstaclesAtPosition(newPosition)) {
						blocking = true;
						// On first iteration search the square counter clockwise
						if (i == 0) {
							// subtract 1 from direction and roll over if 0 is reached
							direction = (direction + (8 - 1)) % 8;
						}
						// On second iteration search the square clockwise
						else if (i == 1) {
							// add 2 to direction and roll over if 8 is reached
							// @todo: Find a better way to do this.
							direction = direction + 2;
							if (direction == 0) direction = 1;
						}
						newPosition = utilities.decodeDirection(creep, direction);
					}
					else {
						blocking = false;
						break;
					}
				}
				// If no good path is found, move to target - maybe creeps will switch position.
				if (blocking) {
					direction = creep.pos.getDirectionTo(target);
				}
				if (creep.pos.getRangeTo(target) < 3) {
					creep.move(direction);
					return 'escaped';
				}
			}
			else if (creep.pos.getRangeTo(target) > 3) {
				if (creep.memory.order) {
					var target = Game.getObjectById(creep.memory.order.target);
					if (!creep.room.controller) {
						if (target) {
							var result = creep.moveTo(target, {
								reusePath: 0,
								ignoreDestructibleStructures: creep.memory.body.attack > 0,
							});
						}
					}
					else {
						if (target) {
							var result = creep.moveTo(target, {
								reusePath: 0,
								ignoreDestructibleStructures: !creep.room.controller.my && (creep.memory.body.attack > 0 || creep.memory.body.ranged > 0),
							});
						}
					}
				}
				else {
					if (creep.memory.squadName) {
						var best = utilities.getBestOption(squad.getOrders());

						if (best && best.target) {
							creep.moveTo(best.target);
							return;
						}
					}

					creep.moveTo(25, 25, {
						reusePath: 50,
					});
				}
			}
			return false;
		//}
	}
};

/**
 * Move Squads
 */
Creep.prototype.performMilitaryMove = function() {
	var creep = this;
	if (creep.memory.squadName) {
		// Check for orders and set target.
		// @todo: Define Game.squads -> manager.squads
		var squads = _.filter(Game.squads, (squad) => squad.name == creep.memory.squadName);
		if (squads && squads.length > 0) {
			var squad = squads[0];

			var orders = squad.getOrders();
			if (orders && orders.length > 0) {
				creep.memory.target = utilities.encodePosition(orders[0].target.pos);
			}
			else {
				delete creep.memory.target;
			}
		}
		if (creep.room.controller && creep.room.controller.my) {
			if (creep.ticksToLive < CREEP_LIFE_TIME * 0.66) {
				creep.memory.renewing = true;
			}
			if (creep.memory.renewing) {
				var spawn = creep.pos.findClosestByRange(FIND_STRUCTURES, {
					filter: (structure) => structure.structureType == STRUCTURE_SPAWN
				});

				if (spawn) {
					if (creep.pos.getRangeTo(spawn) > 1) {
						creep.moveTo(spawn);
					}
					else {
						var result = spawn.renewCreep(creep);
						if (spawn.isSpawning) {
						    creep.memory.renewing;
						    return true;
						}
						if (spawn.room.energyAvailable < spawn.room.energyCapacityAvailable * 0.3 || result == ERR_FULL) {
							delete creep.memory.renewing;
						}
					}
					return true;
				}
			}
		}
	}

	return creep.executeMilitaryMoveOrders(squads[0]);
};

/**
 * Attack hostile creeps
 */
Creep.prototype.performMilitaryAttack = function() {
	var creep = this;

	if (creep.memory.order) {
		var target = Game.getObjectById(creep.memory.order.target);
		var attacked = false;

		if (target && target instanceof StructureController) {
			if (target.owner && !target.my) {
				if (creep.attackController(target) == OK) {
					attacked = true;
				}
			}
			else if (!target.my) {
				// @todo: reserve
			}
		}
		else if (creep.memory.body.ranged_attack > 0) {
			if (target && !target.my) {
				if (creep.pos.getRangeTo(target) <= 3) {
					if (creep.rangedAttack(target)) {
						attacked = true;
					}
				}
			}
		}
		if (!attacked && creep.memory.body.attack > 0) {
			if (target && !target.my) {
				if (creep.attack(target) == OK) {
					attacked = true;
				}
			}
		}

		if (!attacked) {
			// Look for enemies nearby and attack them
			var hostile = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 1);
			if (hostile && hostile.length > 0) {
				for (let i in hostile) {
					// Leave creeps alone if not dangerous
					if (!hostile[i].isDangerous()) continue;

					if (creep.attack(hostile[i]) == OK) {
						attacked = true;
					}
				}
			}

			if (!attacked) {
				// Look for enemy structures nearby and attack them
				var hostile = creep.pos.findInRange(FIND_HOSTILE_STRUCTURES, 1);
				if (hostile && hostile.length > 0) {
					for (let i in hostile) {
						if (creep.attack(hostile) == OK) {
							attacked = true;
						}
					}
				}
			}
		}

		return attacked;
	}

	// @todo: Just an Idea - getRangeTo SquadLeader - don't go too far away
};

/**
 * Make creep heal friendly creeps
 */
Creep.prototype.performMilitaryHeal = function() {
	var creep = this;
	var healed = false;

	if (creep.memory.order) {
		var target = Game.getObjectById(creep.memory.order.target);


		if (target && target.my) {
			if (creep.heal(target) == OK) {
				healed = true;
			}
		}
	}

	if (!healed) {
		// Look for adjacent creeps which need healing
		var damaged = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
			filter: (creep) => creep.hits < creep.hitsMax
		});
		if (damaged && damaged.length > 0) {
			if (creep.heal(damaged[0]) == OK) {
				healed = true;
			}
		}
	}

	if (!healed && creep.hits < creep.hitsMax) {
		// Heal self
		if (creep.heal(creep) == OK) {
			healed = true;
		}
	}

	if (!healed) {
		var damaged = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
			filter: (creep) => creep.hits < creep.hitsMax
		});
		if (damaged && damaged.length > 0) {
			if (creep.heal(damaged[0]) == OK) {
				healed = true;
			}
		}
	}
	return healed;
};

/**
 * Makes creep behave like a brawler
 */
Creep.prototype.runBrawlerLogic = function() {
	this.calculateMilitaryTarget();

	var escaped = false;
	escaped = this.performMilitaryMove();

	if (!this.performMilitaryAttack()) {
		this.performMilitaryHeal();
	}
};