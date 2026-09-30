import * as THREE from 'three';

const DEG = Math.PI / 180;

// Easing curves (u in 0..1).
export const EASE = {
  linear: (u) => u,
  in: (u) => u * u * u,
  out: (u) => 1 - Math.pow(1 - u, 3),
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  smooth: (u) => u * u * (3 - 2 * u),
  snap: (u) => 1 - Math.pow(1 - u, 5), // very fast start (strikes)
  hold: () => 0,
};

/**
 * Keyframed clip of joint rotations (+ optional joint position offsets).
 * def = {
 *   name, duration (s), loop,
 *   keys: [{ t: 0..1, ease?: 'smooth', pose: { joint: [rx, ry, rz] (deg, local, relative to rest),
 *                                             'joint@': [x, y, z] (m, position offset) } }],
 *   events: [{ t: 0..1, name }],
 * }
 * A joint's track uses the keys that mention it; the ease of a key shapes the segment arriving at it.
 */
export class Clip {
  constructor(def, rig) {
    this.name = def.name;
    this.duration = def.duration;
    this.loop = !!def.loop;
    this.events = (def.events || []).map((e) => ({ t: e.t * def.duration, name: e.name })).sort((a, b) => a.t - b.t);
    const byTrack = new Map();
    const keys = [...def.keys].sort((a, b) => a.t - b.t);
    for (const key of keys) {
      for (const k in key.pose) {
        const isPos = k.endsWith('@');
        const joint = isPos ? k.slice(0, -1) : k;
        const bi = rig.index[joint];
        if (bi === undefined) {
          console.warn(`[anim] clip ${def.name}: unknown joint ${joint}`);
          continue;
        }
        const id = `${bi}:${isPos ? 'p' : 'r'}`;
        if (!byTrack.has(id)) byTrack.set(id, { bi, pos: isPos, times: [], values: [], eases: [] });
        const tr = byTrack.get(id);
        const v = key.pose[k];
        tr.times.push(key.t);
        tr.values.push(
          isPos
            ? new THREE.Vector3(v[0], v[1], v[2])
            : new THREE.Quaternion().setFromEuler(new THREE.Euler(v[0] * DEG, v[1] * DEG, v[2] * DEG, 'YXZ')),
        );
        tr.eases.push(EASE[key.ease || 'smooth'] || EASE.smooth);
      }
    }
    this.tracks = [...byTrack.values()];
    this.touches = new Set(this.tracks.map((t) => t.bi));
  }

  // Sample at `time` seconds into sink.accum(bi, isPos, value, weight) for every track.
  sample(time, sink, weight, tmpQ, tmpV) {
    const d = this.duration;
    let u = d > 0 ? time / d : 0;
    if (this.loop) u -= Math.floor(u);
    else u = Math.min(Math.max(u, 0), 1);
    for (const tr of this.tracks) {
      const n = tr.times.length;
      let a = 0;
      let b = 0;
      let k = 0;
      if (n === 1 || u <= tr.times[0]) {
        if (this.loop && n > 1 && u < tr.times[0]) {
          // wrap segment last → first
          a = n - 1;
          b = 0;
          const span = 1 - tr.times[n - 1] + tr.times[0];
          k = (u + 1 - tr.times[n - 1]) / span;
        } else {
          a = b = 0;
        }
      } else if (u >= tr.times[n - 1]) {
        if (this.loop) {
          a = n - 1;
          b = 0;
          const span = 1 - tr.times[n - 1] + tr.times[0];
          k = span > 0 ? (u - tr.times[n - 1]) / span : 0;
        } else {
          a = b = n - 1;
        }
      } else {
        while (b < n && tr.times[b] <= u) b++;
        a = b - 1;
        k = (u - tr.times[a]) / (tr.times[b] - tr.times[a]);
      }
      const e = a === b ? 0 : tr.eases[b](k);
      if (tr.pos) {
        tmpV.copy(tr.values[a]).lerp(tr.values[b], e);
        sink.accum(tr.bi, true, tmpV, weight);
      } else {
        tmpQ.copy(tr.values[a]).slerp(tr.values[b], e);
        sink.accum(tr.bi, false, tmpQ, weight);
      }
    }
  }
}

// One animation layer: a set of clip entries mixed by weight, with crossfades.
class Layer {
  constructor(animator, name, { mask = null, weight = 1 } = {}) {
    this.animator = animator;
    this.name = name;
    this.mask = mask; // Float32Array per bone (null = all 1)
    this.weight = weight; // layer weight over the layers below
    this.targetWeight = weight;
    this.weightFade = 0.15;
    this.entries = [];
    const n = animator.rig.boneList.length;
    this.rot = Array.from({ length: n }, () => new THREE.Quaternion());
    this.pos = Array.from({ length: n }, () => new THREE.Vector3());
    this.wRot = new Float32Array(n);
    this.wPos = new Float32Array(n);
  }

  _entry(name) {
    return this.entries.find((e) => e.clip.name === name);
  }

  // Crossfade to a clip. opts: { fade, speed, restart, onEnd }
  play(name, opts = {}) {
    const clip = this.animator.clips[name];
    if (!clip) {
      console.warn(`[anim] unknown clip ${name}`);
      return null;
    }
    const { fade = 0.15, speed = 1, restart = true, onEnd = null } = opts;
    let e = this._entry(name);
    if (!e) {
      e = { clip, time: 0, speed, weight: this.entries.length ? 0 : fade > 0 ? 0 : 1, target: 1, fade, onEnd, done: false, manual: false, fresh: true };
      this.entries.push(e);
    } else if (restart) {
      e.time = 0;
      e.done = false;
      e.fresh = true;
    }
    e.speed = speed;
    e.target = 1;
    e.fade = fade;
    e.onEnd = onEnd;
    e.manual = false;
    if (fade <= 0) e.weight = 1;
    for (const o of this.entries) {
      if (o === e) continue;
      o.target = 0;
      o.fade = fade;
      o.manual = false;
    }
    this.targetWeight = 1;
    return e;
  }

  // Manual blend: { clipName: weight } (e.g. idle/run by speed). Other entries fade out.
  setBlend(weights, speeds = null) {
    for (const name in weights) {
      let e = this._entry(name);
      if (!e) {
        const clip = this.animator.clips[name];
        if (!clip) continue;
        e = { clip, time: 0, speed: 1, weight: 0, target: 0, fade: 0.15, onEnd: null, done: false, manual: true };
        this.entries.push(e);
      }
      e.manual = true;
      e.weight = weights[name];
      e.target = weights[name];
      if (speeds && speeds[name] !== undefined) e.speed = speeds[name];
    }
    for (const e of this.entries) {
      if (!(e.clip.name in weights)) {
        e.manual = false;
        e.target = 0;
      }
    }
  }

  // Fade the whole layer out (its clips keep running while fading).
  fadeOut(fade = 0.15) {
    this.targetWeight = 0;
    this.weightFade = fade;
  }

  isPlaying(name) {
    const e = this._entry(name);
    return !!e && e.target > 0 && !e.done;
  }

  current() {
    let best = null;
    for (const e of this.entries) if (e.target > 0 && (!best || e.weight > best.weight)) best = e;
    return best;
  }

  update(dt) {
    // Layer weight
    if (this.weight !== this.targetWeight) {
      const step = this.weightFade > 0 ? dt / this.weightFade : 1;
      this.weight = this.weight < this.targetWeight ? Math.min(this.targetWeight, this.weight + step) : Math.max(this.targetWeight, this.weight - step);
    }
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      if (!e.manual && e.weight !== e.target) {
        const step = e.fade > 0 ? dt / e.fade : 1;
        e.weight = e.weight < e.target ? Math.min(e.target, e.weight + step) : Math.max(e.target, e.weight - step);
      }
      // A freshly (re)started entry also fires its t = 0 events on its first update.
      const prev = e.fresh ? -1 : e.time;
      e.fresh = false;
      e.time += dt * e.speed * this.animator.timeScale;
      const d = e.clip.duration;
      // Events (active entries only)
      if (e.target > 0 && e.clip.events.length) {
        if (e.clip.loop && d > 0) {
          const p = prev < 0 ? -1 : ((prev % d) + d) % d;
          const c = ((e.time % d) + d) % d;
          for (const ev of e.clip.events) {
            if ((c >= p && ev.t > p && ev.t <= c) || (c < p && (ev.t > p || ev.t <= c))) this.animator._emit(ev.name, e.clip.name, this.name);
          }
        } else {
          for (const ev of e.clip.events) if (ev.t > prev && ev.t <= e.time) this.animator._emit(ev.name, e.clip.name, this.name);
        }
      }
      if (!e.clip.loop && !e.done && e.time >= d) {
        e.done = true;
        e.time = d;
        if (e.target > 0 && e.onEnd) e.onEnd(e.clip.name);
      }
      if (e.target === 0 && e.weight <= 0 && !e.manual) this.entries.splice(i, 1);
    }
  }

  // Weighted accumulation of one sampled track value.
  accum(bi, isPos, v, w) {
    if (isPos) {
      const ws = this.wPos[bi] + w;
      if (this.wPos[bi] === 0) this.pos[bi].copy(v);
      else this.pos[bi].lerp(v, w / ws);
      this.wPos[bi] = ws;
    } else {
      const ws = this.wRot[bi] + w;
      if (this.wRot[bi] === 0) this.rot[bi].copy(v);
      else this.rot[bi].slerp(v, w / ws);
      this.wRot[bi] = ws;
    }
  }

  // Mix entries into this.rot/pos (normalized) with per-bone accumulated weights.
  evaluate(isBase) {
    const n = this.rot.length;
    this.wRot.fill(0);
    this.wPos.fill(0);
    const A = this.animator;
    for (const e of this.entries) {
      if (e.weight <= 1e-4) continue;
      e.clip.sample(e.time, this, e.weight, A._tq, A._tv);
    }
    // Base layer: total weight below 1 blends toward rest. Upper layers keep the normalized pose and
    // blend over the layers below by layer weight × mask × min(1, total weight).
    if (!isBase) return;
    for (let i = 0; i < n; i++) {
      if (this.wRot[i] > 0 && this.wRot[i] < 1) this.rot[i].slerp(A._identity, 1 - this.wRot[i]);
      if (this.wPos[i] > 0 && this.wPos[i] < 1) this.pos[i].multiplyScalar(this.wPos[i]);
    }
  }
}

/**
 * Animator: layers of keyframed clips over a Rig, crossfades, per-layer joint masks, playback
 * speed, timed events. Pose rotations are relative to the rig's rest pose. Call update(dt) with
 * the entity's clock, then apply procedural offsets (breathing, lean, twist) on top.
 */
export class Animator {
  constructor(rig, clipDefs = []) {
    this.rig = rig;
    this.clips = {};
    this.timeScale = 1;
    this.layers = [];
    this._listeners = new Map();
    this._tq = new THREE.Quaternion();
    this._tv = new THREE.Vector3();
    this._identity = new THREE.Quaternion();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._euler = new THREE.Euler();
    const n = rig.boneList.length;
    this.poseRot = Array.from({ length: n }, () => new THREE.Quaternion());
    this.posePos = Array.from({ length: n }, () => new THREE.Vector3());
    for (const d of clipDefs) this.addClip(d);
  }

  addClip(def) {
    this.clips[def.name] = new Clip(def, this.rig);
  }

  addLayer(name, opts = {}) {
    const layer = new Layer(this, name, opts);
    this.layers.push(layer);
    this[name] = layer;
    return layer;
  }

  // Per-bone weights: names (optionally 'name:0.5'); descendants inherit unless listed themselves.
  mask(spec) {
    const rig = this.rig;
    const m = new Float32Array(rig.boneList.length);
    const explicit = new Map();
    for (const s of spec) {
      const [name, w] = s.split(':');
      explicit.set(name, w === undefined ? 1 : parseFloat(w));
    }
    const visit = (bone, inherited) => {
      const w = explicit.has(bone.name) ? explicit.get(bone.name) : inherited;
      const i = rig.index[bone.name];
      if (i !== undefined) m[i] = w;
      for (const c of bone.children) if (c.isBone) visit(c, w);
    };
    visit(rig.root, 0);
    return m;
  }

  on(name, fn) {
    if (!this._listeners.has(name)) this._listeners.set(name, []);
    this._listeners.get(name).push(fn);
  }

  _emit(name, clip, layer) {
    const fns = this._listeners.get(name);
    if (fns) for (const fn of fns) fn(clip, layer);
    const any = this._listeners.get('*');
    if (any) for (const fn of any) fn(name, clip, layer);
  }

  update(dt) {
    const rig = this.rig;
    const n = rig.boneList.length;
    for (let li = 0; li < this.layers.length; li++) {
      this.layers[li].update(dt);
      this.layers[li].evaluate(li === 0);
    }
    // Composite layers bottom → top.
    for (let i = 0; i < n; i++) {
      const q = this.poseRot[i].identity();
      const p = this.posePos[i].set(0, 0, 0);
      for (let li = 0; li < this.layers.length; li++) {
        const l = this.layers[li];
        const lw = li === 0 ? 1 : l.weight * (l.mask ? l.mask[i] : 1);
        if (lw <= 0) continue;
        if (l.wRot[i] > 0) {
          const w = li === 0 ? 1 : lw * Math.min(1, l.wRot[i]);
          if (w >= 1) q.copy(l.rot[i]);
          else q.slerp(l.rot[i], w);
        }
        if (l.wPos[i] > 0) {
          const w = li === 0 ? 1 : lw * Math.min(1, l.wPos[i]);
          if (w >= 1) p.copy(l.pos[i]);
          else p.lerp(l.pos[i], w);
        }
      }
      const b = rig.boneList[i];
      const r = rig.rest[i];
      b.quaternion.copy(r.quaternion).multiply(q);
      b.position.copy(r.position).add(p);
    }
  }

  // Extra local rotation on top of the evaluated pose (procedural layers).
  addRotation(joint, rx, ry, rz) {
    const b = this.rig.bones[joint];
    if (!b) return;
    this._q.setFromEuler(this._euler.set(rx, ry, rz, 'YXZ'));
    b.quaternion.multiply(this._q);
  }
}
