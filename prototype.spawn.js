module.exports = function() {
    // create a new function for StructureSpawn
    StructureSpawn.prototype.createCustomCreep =
        function(energy, roleName) {
            // create a balanced body as big as possible with the given energy
            var numberOfParts = Math.floor(energy / 200);
            var body = [];

            /*if (Game.spawns.Spawn1.room.energyCapacityAvailable < 301) {
                console.log('AA');
                return;
            }*/

            // Harvesters should only Work on the sources
            if (roleName == 'harvester') {
                var energy = energy - 50;
                var numberOfParts = Math.floor(energy / 100);                
                // Just one MOVE-Part is needed
                for (let i = 0; i < 1; i++) {
                    body.push(MOVE);
                }
                // The rest will be filled with WORK-Parts
                for (let i = 0; i < numberOfParts; i++) {
                    body.push(WORK);
                }
            }
            // Transporters should only carry energy to where it's needed
            else if (roleName == 'transporter') {
                var numberOfParts = Math.floor(energy / 100);
                for (let i = 0; i < numberOfParts; i++) {
                    body.push(CARRY);
                }
                for (let i = 0; i < numberOfParts; i++) {
                    body.push(MOVE);
                }
            }
            else {
                for (let i = 0; i < numberOfParts; i++) {
                    body.push(WORK);
                }
                for (let i = 0; i < numberOfParts; i++) {
                    body.push(CARRY);
                }
                for (let i = 0; i < numberOfParts; i++) {
                    body.push(MOVE);
                }
            }


            // create creep with the created body and the given role
            return this.createCreep(body, undefined, { role: roleName, working: false });
        };
};