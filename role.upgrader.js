var utilities = require('utilities');

/**
 * Make creep upgrade Controller.
 */
Creep.prototype.performUpgrade = function() {
	// Upgrade controller.
	if (this.pos.getRangeTo(this.room.controller) > 3) {
		this.moveTo(this.room.controller);
	}
	else {
		this.upgradeController(this.room.controller);
	}

	// Keep getting energy from link or container to ideally never stop upgrading
	// Only real upgrader do this. Otherwise other primary roles would never stop upgrading
	if (this.memory.role == 'upgrader' && _.sum(this.carry) < this.carryCapacity) {
		var withdrawn = false;
		if (this.room.memory.controllerLink) {
			var controllerLink = Game.getObjectById(this.room.memory.controllerLink);
			if (controllerLink.energy > 50 && this.pos.getRangeTo(controllerLink) <= 1) {
				if (this.withdraw(controllerLink, RESOURCE_ENERGY) == OK) {
					withdrawn = true;
				}
			}
		}
		if (!withdrawn && this.room.memory.controllerContainer) {
			var controllerContainer = Game.getObjectById(this.room.memory.controllerContainer);
			if (controllerContainer.store[RESOURCE_ENERGY] > 50 && this.pos.getRangeTo(controllerContainer) <= 1) {
				if (this.withdraw(controllerContainer, RESOURCE_ENERGY) == OK) {
					withdrawn = true;
				}
			}
		}
	}
	return true;
};

/**
 * Makes the creep gather energy as an upgrader.
 */
Creep.prototype.performGetUpgraderEnergy = function () {
	var creep = this;
	// Ideally, get energy from a link or container close to the controller
	if (creep.room.memory.controllerLink) {
		var target = Game.getObjectById(creep.room.memory.controllerLink);
		if (target && target.energy > 50) {
			if (creep.pos.getRangeTo(target) > 1) {
				creep.moveTo(target);
			}
			else {
				creep.withdraw(target, RESOURCE_ENERGY);
			}
			return true;
		}
	}

	if (creep.room.memory.controllerContainer) {
		var target = Game.getObjectById(creep.room.memory.controllerContainer);
		if (target && target.store[RESOURCE_ENERGY] > 50) {
			if (creep.pos.getRangeTo(target) > 1) {
				creep.moveTo(target);
			}
			else {
				creep.withdraw(target, RESOURCE_ENERGY);
			}
			return true;
		}
	}

	// Could also try to get energy from another nearby container.
	var otherContainers = creep.pos.findInRange(FIND_STRUCTURES, 3, {
		filter: (structure) => structure.structureType == STRUCTURE_CONTAINER && structure.store.energy > 0 && structure.id != creep.room.memory.controllerContainer
	});
	if (otherContainers && otherContainers.length > 0) {
		if (creep.pos.getRangeTo(otherContainers[0]) > 1) {
			creep.moveTo(otherContainers[0]);
		}
		else {
			creep.withdraw(otherContainers[0], RESOURCE_ENERGY);
		}
		return true;
	}

	// Otherwise get energy from anywhere.
	if (creep.performGetEnergy()) {
		return true;
	}
	else if (creep.carry.energy > 0) {
		creep.setUpgraderState(true);
	}
	return false;
}

/**
 * Set creep into or out of upgrading state.
 */
Creep.prototype.setUpgraderState = function(upgrading) {
	this.memory.upgrading = upgrading;
	delete this.memory.sourceTarget;
	delete this.memory.tempRole;
}

/**
 * Makes creep behave like an upgrader.
 */
Creep.prototype.runUpgraderLogic = function() {
	if (this.memory.upgrading && this.carry.energy == 0) {
		this.setUpgraderState(false);
	}
	if (!this.memory.upgrading && this.carry.energy == this.carryCapacity) {
		this.setUpgraderState(true);
	}

	if (this.memory.upgrading) {
		return this.performUpgrade();
	}
	else {
		return this.performGetUpgraderEnergy();
	}
}