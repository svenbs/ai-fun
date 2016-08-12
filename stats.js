var stats = {

	initRemoteHarvestMemory: function (source, target) {
		var memory = Memory.rooms[source];

		if (!memory.remoteHarvesting) {
			memory.remoteHarvesting = {};
		}
		if (!memory.remoteHarvesting[target]) {
			memory.remoteHarvesting[target] = {
				creepCost: 0,
				defenseCost: 0,
				buildCost: 0,
				revenue: 0,
				harvesters: [],
			};
		}

		// @todo Temporary.
		if (!memory.remoteHarvesting[target].defenseCost) {
			memory.remoteHarvesting[target].defenseCost = 0;
		}
	},

	clearRemoteHarvestStats: function (source, target) {
		if (!Memory.rooms[source]) return;

		var memory = Memory.rooms[source];
		stats.initRemoteHarvestMemory(source, target);

		memory.remoteHarvesting[target].creepCost = 0;
		memory.remoteHarvesting[target].defenseCost = 0;
		memory.remoteHarvesting[target].buildCost = 0;
		memory.remoteHarvesting[target].revenue = 0;
	},

	addRemoteHarvestCost: function (source, target, cost) {
		if (!Memory.rooms[source]) return;

		var memory = Memory.rooms[source];
		stats.initRemoteHarvestMemory(source, target);

		memory.remoteHarvesting[target].creepCost += cost;
	},

	addRemoteHarvestDefenseCost: function (source, target, cost) {
		if (!Memory.rooms[source]) return;

		var memory = Memory.rooms[source];
		stats.initRemoteHarvestMemory(source, target);

		memory.remoteHarvesting[target].defenseCost += cost;
	},

};

module.exports = stats;
