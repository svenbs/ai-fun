var utilities = {

    getBodyCost: function(creep) {
        var cost = 0;
        for (var part in creep.body) {
            cost += BODYPART_COST[creep.body[part].type]
        }
        return cost;
    },
}

module.exports = utilities;