// @todo: renew creeps
// @todo: rewrite spawn-logic (SpawnManager) - Creep Bodys by percentage
// @todo: create squad logic, attack and defend rooms
// @todo: create remote harvester logic
// @todo: rewrite collectEnergy function to improve effectiveness

// import modules
require('prototype.spawn')();
require('creep.manager')();
var roleHarvester = require('role.harvester');
var roleTransporter = require('role.transporter');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRepairer = require('role.repairer');
var roleWallRepairer = require('role.wallRepairer');

module.exports.loop = function () {
    // check for memory entries of died creeps by iterating over Memory.creeps
    for (let name in Memory.creeps) {
        // and checking if the creep is still alive
        if (Game.creeps[name] == undefined) {
            // if not, delete the memory entry
            delete Memory.creeps[name];
        }
    }

    // for every creep name in Game.creeps
    for (let name in Game.creeps) {
        // get the creep object
        var creep = Game.creeps[name];

        if (creep.ticksToLive <= 200 || creep.memory.renewing == true)  {
            creep.memory.renewing = true;
            if (creep.renew(Game.spawns.Spawn1) == 1) {
                continue;
            }
        }
        // if creep is harvester, call harvester script
        if (creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        // if creep is harvester, call harvester script
        if (creep.memory.role == 'transporter') {
            roleTransporter.run(creep);
        }
        // if creep is upgrader, call upgrader script
        else if (creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        // if creep is builder, call builder script
        else if (creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
        // if creep is repairer, call repairer script
        else if (creep.memory.role == 'repairer') {
            roleRepairer.run(creep);
        }
        // if creep is wallRepairer, call wallRepairer script
        else if (creep.memory.role == 'wallRepairer') {
            roleWallRepairer.run(creep);
        }
    }

    var towers = Game.rooms.E57S44.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType == STRUCTURE_TOWER
    });
    for (let tower of towers) {
        var target = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (target != undefined) {
            tower.attack(target);
        }
    }


    // setup some minimum numbers for different roles
    var minimumNumberOfHarvesters = 4;
    var minimumNumberOfTransporters = 2;
    var minimumNumberOfUpgraders = 1;
    var minimumNumberOfBuilders = 2;
    var minimumNumberOfRepairers = 2;
    var minimumNumberOfWallRepairers = 2;

    // count the number of creeps alive for each role
    // _.sum will count the number of properties in Game.creeps filtered by the
    //  arrow function, which checks for the creep being a harvester
    var numberOfHarvesters = _.sum(Game.creeps, (c) => c.memory.role == 'harvester');
    var numberOfTransporters = _.sum(Game.creeps, (c) => c.memory.role == 'transporter');
    var numberOfUpgraders = _.sum(Game.creeps, (c) => c.memory.role == 'upgrader');
    var numberOfBuilders = _.sum(Game.creeps, (c) => c.memory.role == 'builder');
    var numberOfRepairers = _.sum(Game.creeps, (c) => c.memory.role == 'repairer');
    var numberOfWallRepairers = _.sum(Game.creeps, (c) => c.memory.role == 'wallRepairer');

    var energy = Game.spawns.Spawn1.room.energyCapacityAvailable;
    var name = undefined;

    // if not enough harvesters
    if (numberOfHarvesters < minimumNumberOfHarvesters) {
        // try to spawn one
        name = Game.spawns.Spawn1.createCustomCreep(energy, 'harvester');
        //name = Game.spawns.Spawn1.createCreep([MOVE,WORK,WORK], undefined, { role: 'harvester', working: false });

        if (name == ERR_NOT_ENOUGH_ENERGY && numberOfHarvesters == 0) {
            // spawn one with what is available
            name = Game.spawns.Spawn1.createCustomCreep(
            Game.spawns.Spawn1.room.energyAvailable, 'harvester');
        }
    }
    else if (numberOfTransporters < minimumNumberOfTransporters) {
        // try to spawn one
        name = Game.spawns.Spawn1.createCustomCreep(energy, 'transporter');
        //name = Game.spawns.Spawn1.createCreep([MOVE,CARRY,CARRY,CARRY], undefined, { role: 'transporter', working: false });
        if (name == ERR_NOT_ENOUGH_ENERGY && numberOfTransporters == 0) {
            // spawn one with what is available
            name = Game.spawns.Spawn1.createCustomCreep(
            Game.spawns.Spawn1.room.energyAvailable, 'transporter');
        }
    }
    // if not enough upgraders
    else if (numberOfUpgraders < minimumNumberOfUpgraders) {
        // try to spawn one
        name = Game.spawns.Spawn1.createCustomCreep(energy, 'upgrader');
        //name = Game.spawns.Spawn1.createCreep([MOVE,MOVE,CARRY,WORK], undefined, { role: 'upgrader', working: false });
    }
    // if not enough repairers
    else if (numberOfRepairers < minimumNumberOfRepairers) {
        // try to spawn one
        name = Game.spawns.Spawn1.createCustomCreep(energy, 'repairer');
    }
    // if not enough builders
    else if (numberOfBuilders < minimumNumberOfBuilders) {
        // try to spawn one
        name = Game.spawns.Spawn1.createCustomCreep(energy, 'builder');
    }
    // if not enough wallRepairers
    else if (numberOfWallRepairers < minimumNumberOfWallRepairers) {
        // try to spawn one
        name = Game.spawns.Spawn1.createCustomCreep(energy, 'wallRepairer');
    }
    /*else {
        // else try to spawn a repairer
        name = Game.spawns.Spawn1.createCustomCreep(energy, 'repairer');
    }*/

    // print name to console if spawning was a success
    // name > 0 would not work since string > 0 returns false
    if (!(name == undefined) && !(name < 0)) {
        console.log("Spawned new creep: " + name );
    }

    function defendRoom(roomName) {

        var hostiles = Game.rooms[roomName].find(FIND_HOSTILE_CREEPS);

        if(hostiles.length > 0) {
            var username = hostiles[0].owner.username;
            //Game.notify(`User ${username} spotted in room ${roomName}`);
            var towers = Game.rooms[roomName].find(
                FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}});
            towers.forEach(tower => tower.attack(hostiles[0]));
        }
    }
    defendRoom('E57S44');
};
