module.exports = function() {
    // create a new function for StructureSpawn
    StructureSpawn.prototype.createCustomCreep =
        function(energy, roleName) {
            // create a balanced body as big as possible with the given energy
            var body = [];

            // Harvesters should only work on sources
            if (roleName == 'harvester') {
                var energy = energy - 100;
                var numberOfParts = Math.floor(energy / 100);
                // One MOVE- and CARRY-Part is needed
                body.push(MOVE);
                body.push(CARRY);
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
            // Anything else is spawned with balanced body parts
            else {
                var numberOfParts = Math.floor(energy / 200);
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
