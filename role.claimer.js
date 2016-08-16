var gameState = require('game.state');
var utilities = require('utilities');

/**
 * Make creep claim a room.
 */
Creep.prototype.performClaim = function() {
	var creep = this;
	var target;
	var targetPosition = utilities.decodePosition(creep.memory.target);

	if (targetPosition.roomName != creep.pos.roomName) {
		creep.moveTo(targetPosition);
		return true;
	}

	target = creep.room.controller;
	if (target.owner && !target.my && creep.memory.body && creep.memory.body.claim >= 5) {
		if (creep.pos.getRangeTo(target) > 1) {
			creep.moveTo(target);
		}
		else {
			creep.claimController(target);
		}
	}
	else if (!target.my) {
		var numRooms = _.size(_.filter(Game.rooms, (room) => room.controller && room.controller.my));
		var maxRooms = Game.gcl.level;

		if (creep.pos.getRangeTo(target) > 1) {
			creep.moveTo(target);
		}
		else if (numRooms < maxRooms) {
			creep.claimController(target);
		}
		else {
			creep.reserveController(target);
		}
	}

	return true;
};

/**
 * Make creep reserver a room.
 */
Creep.prototype.performReserve = function() {
	var creep = this;
	var target;
	var targetPosition = utilities.decodePosition(creep.memory.target);
	var username;
	for (var i in Game.rooms) {
		var room = Game.rooms[i];
		if (room.controller.my) {
			username = room.controller.owner.username;
		}
	}

	if (targetPosition.roomName != creep.pos.roomName) {
		creep.moveTo(targetPosition);
		return true;
	}

	target = creep.room.controller;
	if (creep.pos.getRangeTo(target) > 1) {
		creep.moveTo(target);
	}
	else {
		var result = creep.reserveController(target);
		if (result == OK) {
			var reservation = 0;
			if (creep.room.controller.reservation && creep.room.controller.reservation.username == username) {

			}
		}
	}
};

/**
 * Make this creep behave like a claimer.
 */
Creep.prototype.runClaimerLogic = function() {
	if (this.memory.mission == 'claim') {
		return this.performClaim();
	}
	else if (this.memory.mission == 'reserve') {
		return this.performReserve();
	}
};