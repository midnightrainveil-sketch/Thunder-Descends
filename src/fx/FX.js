import { Particles } from './Particles.js';
import { SlashArcs } from './SlashArc.js';
import { Lightning } from './Lightning.js';
import { Decals } from './Decals.js';
import { Shockwaves } from './Shockwave.js';
import { Shatter } from './Shatter.js';
import { ExpShards } from './ExpShards.js';
import { DamageNumbers } from './DamageNumbers.js';
import { Chain } from './Chain.js';
import { Afterimages } from './Afterimages.js';
import { Nanobots } from './Nanobots.js';
import { AimRings } from './AimRings.js';

/**
 * All pooled, reusable FX in one place (Stage 3). Each system picks its clock:
 * particles / slash arcs / lightning / rings take a per-effect clock ('world' or 'hero'),
 * decals, beams and shatter run on the world clock, EXP shards on the hero clock, numbers on
 * real time. `game.fx` is the entry point for gameplay code and later skills.
 */
export class FX {
  constructor({ scene, uiRoot, postFX }) {
    this.particles = new Particles(scene);
    this.slashes = new SlashArcs(scene);
    this.lightning = new Lightning(scene);
    this.decals = new Decals(scene);
    this.shock = new Shockwaves(scene);
    this.shatter = new Shatter(scene, this.particles);
    this.exp = new ExpShards(scene);
    this.numbers = new DamageNumbers(uiRoot);
    // Stage 4 skill FX
    this.chain = new Chain(scene);
    this.afterimages = new Afterimages(scene, postFX);
    this.nanobots = new Nanobots(scene, postFX);
    this.aim = new AimRings(scene, postFX);
    // Hero FX stay in color inside the Demontime ring.
    for (const m of this.slashes.meshes) postFX.addToMask(m);
    for (const m of this.shock.spearMeshes) postFX.addToMask(m);
    postFX.addToMask(this.lightning.mesh);
    postFX.addToMask(this.chain.mesh);
  }

  update(time, camera, hero, width, height) {
    this.particles.update(time.worldDt, time.heroDt);
    this.slashes.update(time.worldDt, time.heroDt);
    this.lightning.update(time.worldDt, time.heroDt, camera);
    this.decals.update(time.worldDt);
    this.shock.update(time.worldDt, time.heroDt);
    this.shatter.update(time.worldDt);
    this.exp.update(time.heroDt, hero);
    this.numbers.update(time.realDt, camera, width, height);
    this.afterimages.update(time.heroDt);
    this.nanobots.update(time.heroDt);
    this.aim.update(time.realDt);
  }

  clear() {
    this.particles.clear();
    this.slashes.clear();
    this.lightning.clear();
    this.decals.clear();
    this.shock.clear();
    this.shatter.clear();
    this.exp.clear();
    this.numbers.clear();
    this.chain.hide();
    this.afterimages.clear();
    this.nanobots.clear();
    this.aim.show(false);
    this.aim.showLane(false);
  }
}
