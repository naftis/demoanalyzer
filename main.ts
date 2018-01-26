/*eslint-disable no-console*/

import * as fs from 'fs';
import * as assert from 'assert';
import * as demo from 'demofile';
import * as util from 'util';
import Player from './entities/player';

interface IPos {
  x: number,
  y: number,
  z: number,
};

interface IAngle {
  pitch: number,
  yaw: number,
};

function angleCalculator(cameraPos : IPos, enemyPos : IPos) : IAngle {
  const deltaX = cameraPos.x - enemyPos.x;
  const deltaY = cameraPos.y - enemyPos.y;
  const deltaZ = cameraPos.z - enemyPos.z;

  let yaw = Math.atan(deltaY / deltaX) * (180 / Math.PI);

  if(deltaX >= 0.0) {
    yaw -= 180;
  }

  if(yaw < -180) {
    yaw = 360 + yaw;
  }

  const hypotenuse = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  let pitch = Math.atan(deltaZ / hypotenuse) * (180 / Math.PI);

  return {
      pitch,
      yaw,
  }
}

function initializeDatabase(examinedPlayerNames : string[]) : object {
  const database = {};

  for(const playerAddedToData of examinedPlayerNames) {
    database[playerAddedToData] = {};

    for(const otherPlayer of examinedPlayerNames) {
      if(playerAddedToData !== otherPlayer) {
        database[playerAddedToData][otherPlayer] = [];
      }
    }
  }

  return database;
}

function writeDatabaseToFile(database : string) : Promise<string> {
  return new Promise((resolve, reject) => {
    fs.writeFile('file.json', database, (err) => {
      if(err) {
        reject(err);
      } else {
        resolve('Data written');
      }
    });
  });
}

function parseDemoFile(path, examinedPlayerNames : string[]) : void {
  const database = initializeDatabase(examinedPlayerNames);
  
  return fs.readFile(path, function (err, buffer) {
    assert.ifError(err);

    let demoFile = new demo.DemoFile();

    demoFile.on('start', () => {
      console.log('[0 / ' + demoFile.header.playbackTicks + '] ' + demoFile.header.mapName);
    });

    demoFile.on('end', () => {
      console.log('Finished.');
    });

    let hasWarmupEnded = false;
    let roundCounter = 0;

    demoFile.gameEvents.on('round_start', e => {
      if(e.objective === 'BOMB TARGET') {
        roundCounter++;

        if(hasWarmupEnded === false) {
          hasWarmupEnded = true;
        }

        console.log('[' + demoFile.currentTick + '] round #' + roundCounter);
      }
    });

    const pitchErrorRange = 0.7;
    const yawErrorRange = 0.05;

    demoFile.on('tickstart', () => {
      if(hasWarmupEnded) {
        for(const examinedPlayer of demoFile.entities.players) {
          if(!examinedPlayerNames.includes(examinedPlayer.name)) {
            continue;
          }

          for(const lookingAtPlayer of demoFile.entities.players) {
            const isLookingAtHimself = examinedPlayer.name === lookingAtPlayer.name;
            const isExaminedPlayer = examinedPlayerNames.includes(lookingAtPlayer.name);
            const isBehindWall = !(examinedPlayer.isSpotted(lookingAtPlayer));
            const isPitchWithinRange = examinedPlayer.eyeAngles.pitch > -90 && examinedPlayer.eyeAngles.pitch < 90;
            const isYawWithinRange = examinedPlayer.eyeAngles.yaw > -180 && examinedPlayer.eyeAngles.yaw < 180;
            const isPitchOrYawZero = examinedPlayer.eyeAngles.pitch === 0 || examinedPlayer.eyeAngles.yaw === 0;

            if(isLookingAtHimself || !isExaminedPlayer || !isBehindWall || !isPitchWithinRange || !isYawWithinRange || isPitchOrYawZero) {
              continue;
            }

            const target = angleCalculator(examinedPlayer.position, lookingAtPlayer.position);

            const targetPitchWithinErrorRange = target.pitch - pitchErrorRange <= examinedPlayer.eyeAngles.pitch
                                                && examinedPlayer.eyeAngles.pitch <= target.pitch + pitchErrorRange;

            const targetYawWithinErrorRange = target.yaw - yawErrorRange <= examinedPlayer.eyeAngles.yaw
                                              && examinedPlayer.eyeAngles.yaw <= target.yaw + yawErrorRange;
            
            if(targetPitchWithinErrorRange && targetYawWithinErrorRange) {
                database[examinedPlayer.name][lookingAtPlayer.name].push(demoFile.currentTick);
            }
          }
        }
      }
    });

    demoFile.gameEvents.on('round_end', () => {
      writeDatabaseToFile(JSON.stringify(database));
    })

    
    demoFile.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  });
}

new Promise(() => {
  parseDemoFile('./sk-vs-space-soldiers-mirage.dem', ['fer', 'Calyx', 'paz', 'ngiN', 'felps', 'TACO', 'XANTARES', 'coldzera', 'MAJ3R', 'FalleN'])
})
.catch(e => {
  console.log(e);
});