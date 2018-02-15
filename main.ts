import * as fs from 'fs';
import * as assert from 'assert';
import * as demo from 'demofile';
import * as util from 'util';
import Player from './entities/player';

const PITCH_ERROR_RANGE = 0.7;
const YAW_ERROR_RANGE = 0.05;

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
  const pitch = Math.atan(deltaZ / hypotenuse) * (180 / Math.PI);

  return {
    pitch,
    yaw,
  }
}

async function writeDatabaseToFile(database: string): Promise<void> {
  const writeFile = util.promisify(fs.writeFile);
  return await writeFile('file.json', database);
}

interface IPlayerData {
  examinedPlayer: string;
  lookingAtPlayer: string;
  tick: number;
}

function isLookingAtPlayer(examinedPlayer: Player, lookingAtPlayer: Player): boolean {
  const isLookingAtHimself = examinedPlayer.name === lookingAtPlayer.name;
  const isBehindWall = !(lookingAtPlayer.isSpottedBy(examinedPlayer));
  const isPitchWithinRange = examinedPlayer.eyeAngles.pitch > -90 && examinedPlayer.eyeAngles.pitch < 90;
  const isYawWithinRange = examinedPlayer.eyeAngles.yaw > -180 && examinedPlayer.eyeAngles.yaw < 180;
  const isPitchOrYawZero = examinedPlayer.eyeAngles.pitch === 0 || examinedPlayer.eyeAngles.yaw === 0;

  const target = angleCalculator(examinedPlayer.position, lookingAtPlayer.position);

  const targetPitchWithinErrorRange = target.pitch - PITCH_ERROR_RANGE <= examinedPlayer.eyeAngles.pitch
                                      && examinedPlayer.eyeAngles.pitch <= target.pitch + PITCH_ERROR_RANGE;

  const targetYawWithinErrorRange = target.yaw - YAW_ERROR_RANGE <= examinedPlayer.eyeAngles.yaw
                                    && examinedPlayer.eyeAngles.yaw <= target.yaw + YAW_ERROR_RANGE;

  return !isLookingAtHimself && isBehindWall && isPitchWithinRange && isYawWithinRange
         && !isPitchOrYawZero && targetPitchWithinErrorRange && targetYawWithinErrorRange;
}

function findTickWallhacks(examinedPlayerNames: string[], players: Player[], currentTick: number): IPlayerData[] {
  const foundWallhacks = players
  .filter((examinedPlayer) => examinedPlayerNames.includes(examinedPlayer.name))
  .map(examinedPlayer => (players
      .filter(lookingAtPlayer => 
        examinedPlayerNames.includes(lookingAtPlayer.name)
        && isLookingAtPlayer(examinedPlayer, lookingAtPlayer)
      )
      .map(lookingAtPlayer => ({
        examinedPlayer: examinedPlayer.name,
        lookingAtPlayer: lookingAtPlayer.name,
        tick: currentTick,
      }))
  ));

  return [].concat.apply([], foundWallhacks);
}

function parseDemoFile(path, examinedPlayerNames : string[]) : void {
  const database : IPlayerData[] = [];

  return fs.readFile(path, (err, buffer) => {
    assert.ifError(err);

    const demoFile = new demo.DemoFile();
    demoFile.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

    demoFile.on('start', () => {
      console.log(`[0 / ${demoFile.header.playbackTicks}] ${demoFile.header.mapName}`);
    });

    demoFile.on('end', () => {
      console.log('Finished.');
    });

    demoFile.gameEvents.on('round_start', e => {
      const round = demoFile.gameRules.roundNumber + 1;
      console.log(`[${demoFile.currentTick}] round #${round}`);
    });

    demoFile.on('tickstart', (e) => {
      if(!demoFile.gameRules || demoFile.gameRules.isWarmup) {
        return;
      }

      const foundWallhacks: IPlayerData[] = findTickWallhacks(
        examinedPlayerNames,
        demoFile.entities.players,
        demoFile.currentTick
      );
      database.push(...foundWallhacks);
    });

    demoFile.gameEvents.on('round_end', () => writeDatabaseToFile(JSON.stringify(database)));
  });
}

parseDemoFile('./sk-vs-space-soldiers-mirage.dem', ['fer', 'Calyx', 'paz', 'ngiN', 'felps', 'TACO', 'XANTARES', 'coldzera', 'MAJ3R', 'FalleN'])