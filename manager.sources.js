/**
 * Finds a container in close proximity to this source, for dropping off energy.
 */
Source.prototype.getNearbyContainer = function () {
	if (!this.memory.nearbyContainerCalculated || this.memory.nearbyContainerCalculated < Game.time - 1000) {
		this.memory.nearbyContainerCalculated = Game.time;
		this.memory.targetContainer = null;

		// Check if there is a container nearby.
		var structures = this.pos.findInRange(FIND_STRUCTURES, 3, {
			filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
		});
		if (structures.length > 0) {
			var structure = this.pos.findClosestByRange(structures);
			this.memory.targetContainer = structure.id;
		}
	}

	if (this.memory.targetContainer) {
		return Game.getObjectById(this.memory.targetContainer);
	}
};
