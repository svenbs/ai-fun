var utilities = require('utilities');
var creepGeneral = require('creep.general');

/**
 * Creates a priority list of energy sources available to this creep.
 */
Creep.prototype.getAvailableEnergySources = function () {
	var creep = this;
	var storage = this.room.storage;
	var options = [];

	// Energy can be gotten at the rooms storage
	if (storage && storage.store[RESOURCE_ENERGY] >= creep.carryCapacity - _.sum(creep.carry)) {
		options.push({
			// Transporter Priority for Storage is 0 - everyone else gets 5
			priority: creep.memory.role == 'transporter' ? 0 : 5,
			weight: 0,
			type: 'structure',
			object: storage,
			resourceType: RESOURCE_ENERGY,
		});
	}

	// Get storage location, since that is a low priority source for transporters.
	var storagePosition = creep.room.getStorageLocation();

	// Look for energy on the ground
	var targets = creep.room.find(FIND_DROPPED_ENERGY, {
		filter: (resource) => {
			if (resource.resourceType == RESOURCE_ENERGY) {
				if (creep.pos.findPathTo(resource)) {
					return true;
				}
			}
			return false;
		}
	});
	for (let i in targets) {
		let target = targets[i];
		let option = {
			priority: 4,
			weight: target.amount / 100,
			type: 'resource',
			object: target,
			resourceType: RESOURCE_ENERGY,
		};

		// If Resource is equal to storage position
		if (storagePosition && target.pos.x == storagePosition.x && target.pos.y == storagePosition.y) {
			// and creep is transporter
			if (creep.memory.role == 'transporter') {
				// drop priority to 0
				option.priority = 0;
			}
			else {
				// Everyone else use this as high priority source
				option.priority = 5;
			}
		}
		else {
			option.priority -= creepGeneral.getCreepsWithOrder('getEnergy', target.id).length * 3;
		}

		options.push(option);
	}

	// Look for energy in containers
	var targets = creep.room.find(FIND_STRUCTURES, {
		filter: (structure) => {
			return (structure.structureType == STRUCTURE_CONTAINER) && structure.store[RESOURCE_ENERGY] > creep.carryCapacity * 0.1;
		}
	});

	for (var i in targets) {
		var target = targets[i];
		var option = {
			priority: creep.memory.role == 'transporter' ? 0 : 3,
			weight: target.store[RESOURCE_ENERGY] / 100,
			type: 'structure',
			object: target,
			resourceType: RESOURCE_ENERGY,
		};

		option.priority -= creepGeneral.getCreepsWithOrder('getEnergy', target.id).length * 3;

		options.push(option);
	}
	return options;
};

/**
 * Sets a good energy source target for this creep.
 */
Creep.prototype.calculateEnergySource = function () {
	var creep = this;
	var best = utilities.getBestOption(creep.getAvailableEnergySources());

	if (best) {
		creep.memory.sourceTarget = best.object.id;

		creep.memory.order = {
			type: 'getEnergy',
			target: best.object.id,
			resourceType: best.resourceType,
		};
	}
	else {
		delete creep.memory.sourceTarget;
		delete creep.memory.order;
	}
};

/**
 * Makes this creep collect energy.
 */
Creep.prototype.performGetEnergy = function () {
	var creep = this;
	if (!creep.memory.sourceTarget) {
		creep.calculateEnergySource();
	}

	var best = creep.memory.sourceTarget;
	if (!best) {
		if (creep.memory.role == 'transporter' && creep.carry[RESOURCE_ENERGY] > 0) {
			creep.setTransporterState(true);
		}
		return false;
	}

	var target = Game.getObjectById(best);
	if (!target || (target.store && target.store[RESOURCE_ENERGY] <= 0) || (target.amount && target.amount[RESOURCE_ENERGY] <= 0) || (target.mineralAmount && target.mineralAmount <= 0)) {
		creep.calculateEnergySource();
	}
	else if (target.store) {
		if (creep.pos.getRangeTo(target) > 1) {
			creep.moveTo(target);
		}
		else {
			let result = creep.withdraw(target, RESOURCE_ENERGY);
			if (result == OK) {
				creep.calculateEnergySource();
			}
		}
	}
	else if (target.amount) {
		if (creep.pos.getRangeTo(target) > 1) {
			creep.moveTo(target);
		}
		else {
			let result = creep.pickup(target);
			if (result == OK) {
				creep.calculateEnergySource();
			}
		}
	}
	return true;
};

/**
 * Creates a priority list of possible delivery targets for this creep.
 */
Creep.prototype.getAvailableDeliveryTargets = function () {
	var creep = this;
	var options = [];

	let storage = creep.room.storage;

	if (creep.carry.energy >= creep.carryCapacity * 0.1) {
		// Primarily fill Spawns and extensions
		var targets = creep.room.find(FIND_MY_STRUCTURES, {
			filter: (structure) => {
				return (structure.structureType == STRUCTURE_EXTENSION ||
						structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
			}
		});

		for (let i in targets) {
			let target = targets[i];
			let option = {
				priority: 5,
				// @todo Factor in Range
				weight: (target.energyCapacity - target.energy) / 100,
				type: 'structure',
				object: target,
				resourceType: RESOURCE_ENERGY,
			};

			option.priority -= creepGeneral.getCreepsWithOrder('deliver', target.id).length * 2;
			option.weight += 1 - (creep.pos.getRangeTo(target) / 100);

			options.push(option);
		}

		// Fill containers.
		var targets = creep.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				if (structure.structureType == STRUCTURE_CONTAINER && structure.store.energy < structure.storeCapacity) {
					// Do deliver to controller containers, always.
					if (structure.id == structure.room.memory.controllerContainer) {
						return true;
					}

					// Do not deliver to containers used as harvester drop off points.
					if (structure.room.memory.sources) {
						for (var id in structure.room.memory.sources) {
							if (structure.room.memory.sources[id].targetContainer == structure.id) {
								return false;
							}
						}
					}
					return true;
				}
				return false;
			}
		});

		for (let i in targets) {
			let target = targets[i];
			let option = {
				priority: 4,
				weight: (target.storeCapacity - target.store[RESOURCE_ENERGY]) / 100, // @todo Also factor in distance, and other resources.
				type: 'structure',
				object: target,
				resourceType: RESOURCE_ENERGY,
			};

			let prioFactor = 1;
			if (target.store[RESOURCE_ENERGY] / target.storeCapacity > 0.5) {
				prioFactor = 2;
			}
			else if (target.store[RESOURCE_ENERGY] / target.storeCapacity > 0.75) {
				prioFactor = 3;
			}

			option.priority -= creepGeneral.getCreepsWithOrder('deliver', target.id).length * prioFactor;

			options.push(option);
		}

		// Supply towers
		var targets = creep.room.find(FIND_MY_STRUCTURES, {
			filter: (structure) => {
				return structure.structureType == STRUCTURE_TOWER && structure.energy < structure.energyCapacity;
			}
		});

		for (let i in targets) {
			let target = targets[i];
			let option = {
				priority: 3,
				weight: 1 - target.energy / target.energyCapacity,
				type: 'structure',
				object: target,
				resourceType: RESOURCE_ENERGY,
			};

			option.weight += 1 - (creep.pos.getRangeTo(target) / 100);
			option.priority -= creepGeneral.getCreepsWithOrder('deliver', target.id).length * 3;

			options.push(option);
		}

		// Deliver excess energy to storage.
		if (storage) {
			options.push({
				priority: 0,
				weight: 0,
				type: 'structure',
				object: storage,
				resourceType: RESOURCE_ENERGY,
			});
		}
		else {
			var storagePosition = creep.room.getStorageLocation();
			if (storagePosition) {
				options.push({
					priority: 0,
					weight: 0,
					type: 'position',
					object: creep.room.getPositionAt(storagePosition.x, storagePosition.y),
					resourceType: RESOURCE_ENERGY,
				});
			}
		}

		// Deliver energy to storage link.
		if (creep.room.memory.storageLink) {
			var target = Game.getObjectById(creep.room.memory.storageLink);
			if (target && target.energy < target.energyCapacity) {
				let option = {
					priority: 5,
					weight: (target.energyCapacity - target.energy) / 100, // @todo Also factor in distance.
					type: 'structure',
					object: target,
					resourceType: RESOURCE_ENERGY,
				};

				if (creep.pos.getRangeTo(target) > 3) {
					// Don't go out of your way to fill the link, do it when energy is taken out of storage.
					option.priority = 4;
				}

				options.push(option);
			}
		}
	}

	return options;
};

/**
 * Calculate optimal DeliveryTarget
 */
Creep.prototype.calculateDeliveryTarget = function () {
	var creep = this;
	var best = utilities.getBestOption(creep.getAvailableDeliveryTargets());

	if (best) {
		if (best.type == 'structure') {
			creep.memory.deliverTarget = best.object.id;

			creep.memory.order = {
				type: 'deliver',
				target: best.object.id,
				resourceType: best.resourceType,
			};
		}
	}
	else {
		delete creep.memory.deliverTarget;
	}
};

/**
 * Makes creep deliver carried energy
 */
Creep.prototype.perfromDeliver = function() {
	var creep = this;
	if (!creep.memory.deliverTarget) {
		creep.calculateDeliveryTarget();
	}
	var best = creep.memory.deliverTarget;
	if (!best) {
		return false;
	}

	if (typeof best == 'string') {
		var target = Game.getObjectById(best);
		if (!target) {
			creep.calculateDeliveryTarget();
			return true;
		}

		if (creep.pos.getRangeTo(target) > 1) {
			creep.moveTo(target);
		}
		else {
			creep.transfer(target, creep.memory.order.resourceType);
		}
		// Find another target if current one is full
		if (target.energy && target.energy >= target.energyCapacity) {
			creep.calculateDeliveryTarget();
		}
		// Find target for other resource if current resource is depleted
		if (!creep.carry[creep.memory.order.resourceType] || creep.carry[creep.memory.order.resourceType] <= 0) {
			creep.calculateDeliveryTarget();
		}
		return true;
	}
	else {
		// Unknown target type, reset!
		console.log('Unknown target type for delivery found!');
		console.log(creep.memory.deliverTarget);
		delete creep.memory.deliverTarget;
	}
 };

/**
 * Put this creep into or out of delivery mode
 */
Creep.prototype.setTransporterState = function(delivering) {
	this.memory.delivering = delivering;
	delete this.memory.sourceTarget;
	delete this.memory.deliverTarget;
	delete this.memory.order;
};

/**
 * Make this creep behave like a transporter
 */
Creep.prototype.runTransporterLogic = function() {
	// Creep starts delivering if at least 90% full
	if (!this.memory.delivering && _.sum(this.carry) >= this.carryCapacity * 0.9) {
		this.setTransporterState(true);
	}
	else if (this.memory.delivering && _.sum(this.carry) <= this.carryCapacity * 0.1) {
		this.setTransporterState(false);
	}

	if (!this.memory.delivering) {
		this.performGetEnergy();
	}
	else {
		this.perfromDeliver();
	}

	return true;
};