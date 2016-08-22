var utilities = require('utilities');

var Squad = function(squadName) {
	this.name = squadName;

	if (!Memory.squads[squadName]) {
		Memory.squads[squadName] = {
			composition: {
				brawler: 0,
				ranger: 0,
				healer: 0,
				claimer: 0,
				knight: 1,
			},
			units: {},
			fullySpawned: false,
			refreshUnits: false,
		};
	}

	this.memory = Memory.squads[squadName];
};

Squad.prototype.addUnit = function (unitType) {
	if (!this.memory.composition[unitType]) {
		this.memory.composition[unitType] = 0;
	}
	if (!this.memory.units[unitType]) {
		this.memory.units[unitType] = [];
	}
	this.memory.composition[unitType]++;

	return this.memory.composition[unitType];
};

Squad.prototype.removeUnit = function (unitType) {
	if (!this.memory.composition[unitType]) {
		return;
	}
	this.memory.composition[unitType]--;

	return this.memory.composition[unitType];
};

Squad.prototype.registerCreeps = function () {
	var squadCreeps = _.filter(Game.creeps, (creep) => creep.memory.squadName == this.name);
	for (var unitType in this.memory.composition) {
		this.memory.units[unitType] = [];
		for (var i in squadCreeps) {
			var creep = squadCreeps[i];
			if (creep.memory.squadUnitType == unitType) {
				this.memory.units[unitType].push(creep.id);
			}
		}
	}
};

Squad.prototype.needsSpawning = function () {
	// @todo Call registerCreeps somewhere globally whenever it makes sense.
	this.registerCreeps();
	for (var unitType in this.memory.composition) {
		if (this.memory.composition[unitType] > this.memory.units[unitType].length) {
			return unitType;
		}
	}

	this.memory.fullySpawned = true;
	return null;
};

Squad.prototype.spawnUnit = function (spawn) {
	var toSpawn = this.needsSpawning();
	if (!toSpawn) return false;

	if (toSpawn == 'ranger') {
		return spawn.createManagedCreep({
			role: 'brawler',
			//bodyWeights: {move: 0.5, tough: 0.1, ranged_attack: 0.2, heal: 0.2},
			bodyWeights: {move: 0.4, tough: 0.2, ranged_attack: 0.4},
			memory: {
				squadName: this.name,
				squadUnitType: toSpawn,
			},
		});
	}
	else if (toSpawn == 'healer') {
		return spawn.createManagedCreep({
			role: 'brawler',
			bodyWeights: {move: 0.4, tough: 0.1, heal: 0.5},
			memory: {
				squadName: this.name,
				squadUnitType: toSpawn,
			},
		});
	}
	else if (toSpawn == 'claimer') {
		return spawn.createManagedCreep({
			role: 'brawler',
			bodyWeights: {move: 0.5, claim: 0.5},
			memory: {
				squadName: this.name,
				squadUnitType: toSpawn,
			},
		});
	}
	else if (toSpawn == 'knight') {
		return spawn.createManagedCreep({
			role: 'brawler',
			bodyWeights: {move: 0.3, tough: 0.2, attack: 0.5},
			memory: {
				squadName: this.name,
				squadUnitType: toSpawn,
			},
		});
	}
	else {
		return spawn.createManagedCreep({
			role: 'brawler',
			bodyWeights: {move: 0.3, tough: 0.3, attack: 0.3, heal: 0.1},
			memory: {
				squadName: this.name,
				squadUnitType: toSpawn,
			},
		});
	}

	return false;
};

Squad.prototype.getOrders = function () {
	var options = [];

	if (this.memory.fullySpawned) {
		// Check if there is an attack flag for this squad.
		var attackFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('AttackSquad:' + this.name));
		if (attackFlags.length > 0) {
			options.push({
				priority: 5,
				weight: 0,
				target: attackFlags[0],
			});
		}
		var moveFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('MoveSquad:' + this.name));
		if (moveFlags.length > 0) {
			options.push({
				priority: 3,
				weight: 0,
				target: moveFlags[0],
			});
		}
		var spawnFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('SpawnSquad:' + this.name));
		if (spawnFlags.length > 0) {
			options.push({
				priority: 1,
				weight: 0,
				target: spawnFlags[0],
			});
		}
	}
	else {
		var spawnFlags = _.filter(Game.flags, (flag) => flag.name.startsWith('SpawnSquad:' + this.name));
		if (spawnFlags.length > 0) {
			options.push({
				priority: 5,
				weight: 0,
				target: spawnFlags[0],
			});
		}
	}

	return options;
};

module.exports = Squad;
