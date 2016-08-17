var utilities = require('utilities');

Creep.prototype.isDangerous = function () {
	for (let j in this.body) {
		let type = this.body[j].type;

		if (type != WORK && type != MOVE && type != CARRY && type != TOUGH) {
			return true;
		}
	}
	return false;
}

module.exports = {
	getCreepsWithOrder: function(type, target) {
		return _.filter(Game.creeps, (creep) => {
			if (creep.memory.order) {
				if (creep.memory.order.type == type && creep.memory.order.target == target) {
					return true;
				}
			}
			return false;
		})
	},

	renew: function (creep, spawner) {
		var cost = utilities.getBodyCost(creep);
		if (cost < spawner.room.energyCapacityAvailable * 0.75) {
			// Do not renew cheap creeps, they should be replaced with better ones.
			return false;
		}

		if (creep.memory.renewing || creep.ticksToLive < CREEP_LIFE_TIME * 0.2) {
			creep.memory.renewing = true;

			var result = spawner.renewCreep(creep);
			if (result == ERR_NOT_IN_RANGE) {
				creep.moveTo(spawner);
			}
			if (creep.ticksToLive >= CREEP_LIFE_TIME * 0.9) {
				delete creep.memory.renewing;
			}
			else if (creep.ticksToLive > CREEP_LIFE_TIME * 0.3 && spawner.room.energyAvailable < spawner.room.energyCapacityAvailable * 0.1) {
				// If there is not much energy left in the spawner, return to work prematurely.
				delete creep.memory.renewing;
			}
			return true;
		}
		return false;
	},
}