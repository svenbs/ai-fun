var utilities = require('utilities');
var creepGeneral = require('creep.general');

var wallHealth = {
    0: 1,
    1: 5000,
    2: 30000,
    3: 100000,
    4: 300000,
    5: 1000000,
    6: 2000000,
    7: 5000000,
    8: 300000000,
};

/**
 * Gather informations about damaged buildings.
 */
Creep.prototype.getAvailableRepairTargets = function() {
    var creep = this;
    var options = [];

    var targets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.hits < structure.hitsMax
    });

    for (var i in targets) {
        var target = targets[i];

        var option = {
            priority: 4,
            weight: 1 - target.hits / target.hitsMax,
            type: 'structure',
            object: target,
        }

        var maxHealth = target.hitsMax;
        if (target.structureType == STRUCTURE_WALL || target.structureType == STRUCTURE_RAMPART)  {
            option.priority--;

            // Walls and ramparts get repaired to a certain level
            maxHealth = wallHealth[target.room.controller.level];
            if (target.hits >= maxHealth) {
                // Skip this.
                continue;
            }
            option.weight = 1 - target.hits / maxHealth;
            option.maxHealth = maxHealth;
        }

        if (target.hits / maxHealth > 0.9) {
            option.priority--;
        }
        if (target.hits / maxHealth < 0.2) {
            option.priority++;
        }

        // Repair roads with lower priority
        if (target.structureType == STRUCTURE_ROAD) {
            option.priority--;
        }

        if (target.structureType == STRUCTURE_ROAD || target.structureType == STRUCTURE_RAMPART || target.structureType == STRUCTURE_CONTAINER) {
            if (target.hits / maxHealth > 0.9) {
                continue;
            }
        }

        // Adjust weight so closer structures get prioritized
        option.weight -= creep.pos.getRangeTo(target) / 100;

        option.priority -= creepGeneral.getCreepsWithOrder('repair', target.id).length;

        options.push(option);
    }

    return options;
};

/**
 * Sets a good repair target for this creep.
 */
Creep.prototype.calculateRepairTarget = function() {
    var creep = this;
    var best = utilities.getBestOption(creep.getAvailableRepairTargets());

    if (best) {
        creep.memory.repairTarget = best.object.id;

        creep.memory.order = {
            type: 'repair',
            target: best.object.id,
            maxHealth: best.maxHealth,
        };
    }
    else {
        delete creep.memory.repairTarget;
        delete creep.memory.order;
    }
};

/**
 * Make creep repair structures.
 */
Creep.prototype.performRepair = function() {
    var creep = this;
    if (!creep.memory.repairTarget) {
        creep.calculateRepairTarget();
    }
    var best = creep.memory.repairTarget;
    if (!best) {
        return false;
    }
    var target = Game.getObjectById(best);
    var maxHealth = target.hitsMax;
    if (creep.memory.order.maxHealth) {
        maxHealth = creep.memory.order.maxHealth;

        if (target.structureType == STRUCTURE_RAMPART) {
            maxHealth = Math.min(maxHealth + 10000, target.hitsMax);
        }
    }
    if (!target || !target.hits || target.hits >= maxHealth) {
        creep.calculateRepairTarget();
    }

    if (creep.pos.getRangeTo(target) > 3) {
        creep.moveTo(target);

        if (Game.cpu.bucket > 8000) {
            let workParts = creep.body.work;
            if (workParts && (creep.carry.energy > creep.carryCapacity * 0.7 || creep.carry.energy < creep.carryCapacity * 0.3)) {
                var needsRepair = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) =>{
                        let maxHealth = structure.hitsMax;
                        if (structure.structureType == STRUCTURE_RAMPART || structure.structureType == STRUCTURE_WALL) {
                            maxHealth = wallHealth[structure.room.controller.level];
                        }
                        if (structure.hits < maxHealth) {
                            return true;
                        }
                    }
                });
                if (needsRepair && creep.pos.getRangeTo(needsRepair) <= 3) {
                    creep.repair(needsRepair);
                }
            }
        }
    }
    else {
        creep.repair(target);
    }
    return true;
};

/**
 * Set creep into or out of repair mode.
 */
Creep.prototype.setRepairState = function(repairing) {
    this.memory.repairing = repairing;
    delete this.memory.repairTarget;
};

/**
 * Make creep behave like an repairer
 */
Creep.prototype.runRepairerLogic = function() {
    if (this.memory.repairing && this.carry.energy == 0) {
        this.setRepairState(false);
    }
    else if (!this.memory.repairing && this.carry.energy == this.carryCapacity) {
        this.setRepairState(true);
    }

    if (this.memory.repairing) {
        return this.performRepair();
    }
    else {
        return this.performGetEnergy();
    }
};