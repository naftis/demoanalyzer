import * as fs from 'fs';

const teamOne = ['Calyx', 'paz', 'ngiN', 'XANTARES', 'MAJ3R'];
const teamTwo = ['fer', 'felps', 'TACO','coldzera', 'FalleN'];

const teamOneWallings = [];
const teamTwoWallings = [];

fs.readFile('file.json', (err, data) => {
  const database = JSON.parse(data.toString());
  for(const player of Object.keys(database)) {
    let wallings = 0;
    for(const walledPlayer of Object.keys(database[player])) {
      if(
        (teamOne.includes(player) && teamOne.includes(walledPlayer))
        || (teamTwo.includes(player) && teamTwo.includes(walledPlayer))
      ) {
        continue;
      }

      let lastTick = -1;
      const result = database[player][walledPlayer].filter(word => {
        if(word - 1 !== lastTick) {
          lastTick = word;
          return true; 
        }
        
        lastTick = word;
        return false
      }, lastTick);


      wallings += result.length;
    }

    if(teamOne.includes(player)) {
      teamOneWallings.push(player + ': ' + wallings + ' (unique) ticks walling');
    } else {
      teamTwoWallings.push(player + ': ' + wallings + ' (unique) ticks walling');
    }
  }
  console.log('[Team 1]:');
  console.log(teamOneWallings.join('\n'));
  console.log('[Team 2]:');
  console.log(teamTwoWallings.join('\n'));
});
