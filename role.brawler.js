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
			// @todo: define creep.memory.body.attack
			if (creep.memory.body.attack) {
				var hostiles = gameState.getHostiles(creep.pos.roomName);

				if (hostiles && hostiles.length > 0) {
					for (let i in hostiles) {
						var hostile = hostiles[i];
						if (!hostile.isDangerous()) continue;
						// Get enemy Parts (@todo: Check if this could cause performance issues)
						var attackparts = _.filter(hostile.body, (part) => part.type == ATTACK).length;
						var rangedparts = _.filter(hostile.body, (part) => part.type == RANGED_ATTACK).length;
						var toughparts = _.filter(hostile.body, (part) => part.type == TOUGH).length;
						var healparts = _.filter(hostile.body, (part) => part.type == HEAL).length;

						// @todo: Calculate weight / priority from HP left / Maybe Range - may cause my squads to scatter? (creep.pos.getRangeTo(hostile) / 100) +
						var option = {
							priority: 5,
							weight: 1 - ((((attackparts + rangedparts) / toughparts) + (healparts / 5)) / 100),
							type: 'hostilecreep',
							object: hostile,
						};

						options.push(option);
					}
				}

				var structures = _.filter(gameState.getHostileStructures(), (structure) => {
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
			if (creep.memory.body.heal) {
				var damaged = _.filter(gameState.getFriendlyCreeps(creep.room.roomName), (friendly) => {
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
				creep.memory.target = orders[0].target;
			}
			else {
				delete creep.memory.target;
			}
		}
		if (!creep.memory.target) {
			var spawnFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('SpawnSquad:' + creep.memory.squadName));
			if (spawnFlags && spawnFlags.length > 0) {
				var flag = spawnFlags[0];
				if (creep.pos.roomName == flag.pos.roomName) {
					// Refresh creeps, so it has high lifetime if mission starts
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
								if (spawn.room.energyAvailable < spawn.room.energyCapacityAvailable * 0.3) {
									delete creep.memory.renewing;
								}
							}
							return true;
						}
					}

					creep.moveTo(flag);
				}
			}
			return true;
		}
	}

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

		if (target) {
			var result = creep.moveTo(target, {
				reusePath: 0,
				ignoreDestructibleStructures: !creep.room.controller.my && creep.memory.body.attack,
			});
		}
	}
	else {
		if (creep.memory.squadName) {
			var attackFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('AttackSquad:' + creep.memory.squadName));
			if (attackFlags.length > 0) {
				creep.moveTo(attackFlags[0]);
				return;
			}
		}

		creep.moveTo(25, 25, {
			reusePath: 50,
		});
	}
};

/**
 * Attack hostile creeps
 */
Creep.prototype.performMilitaryAttack = function() {
	var creep = this;

	if (creep.memory.order) {
		var target = Game.getObjectById(creep.memory.order.target);
		var attacked = false;

		if (target && target instanceof StctureController) {
			if (target.owner && !target.my) {
				if (creep.attackController(target) == OK) {
					attacked = true;
				}
			}
			else if (!target.my) {
				// @todo: reserve
			}
		}
		else if (target && !target.my) {
			if (creep.attack(target) == OK) {
				attacked = true;
			}
		}

		if (!attacked) {
			// Look for enemies nearby and attack them
			var hostile = creep.pos.findInRange(FIND_HOSTILE_CREEP, 1);
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

	this.performMilitaryMove();

	if (!this.performMilitaryAttack()) {
		this.performMilitaryHeal();
	}
};