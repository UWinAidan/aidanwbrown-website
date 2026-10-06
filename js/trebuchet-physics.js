// ====================================================================================================================
// Whipper trebuchet launch model. The same equations as the C++ in files/trebuchet/ (Wipper_dynamics_v3.cpp),
// used by the demo on the trebuchet project page and by trebuchet-sim.html. js/trebuchet-sim.js draws it.
//
// Three angles, measured from horizontal, counter-clockwise positive. The throw is toward +x.
//   th = main arm (pivot -> tip)     ph = counterweight arm (hinge -> counterweight)     ps = sling (tip -> ball)
//
// TREB.simulate({ m_cw: 1.2, ... }) returns the launch, the flight, the energy losses and the frames for the animation.
// ====================================================================================================================
const TREB = (() => {
  const G = 9.81, DEG = Math.PI / 180;

  const DEFAULTS = {
    // geometry (m)
    r_cg: 0.3825,        // pivot -> arm CG, toward the tip
    r_h: 0.175,          // pivot -> counterweight hinge (on the short end, opposite the tip)
    r_c: 0.6916,         // hinge -> counterweight CG
    r_tip: 0.9625,       // pivot -> release pin
    L: 0.9,              // sling length
    pivot_h: 0.976,      // pivot above the floor
    ball_a: 0.100,       // ball's resting spot: along the arm from the pivot
    ball_b: 0.029,       //                      above the arm's centre line
    // mass and inertia (kg, kg*m^2)
    m_arm: 0.167, m_cw: 1.016, m_p: 0.023,
    I_arm_cg: 0.01762,   // arm about its own CG, swing axis
    I_cw_cg: 0.03467282, // counterweight assembly about its own CG
    // start and release
    cw_rel_deg: 9.0,     // counterweight arm rests this far behind the main arm (CAD says 4.12; the launch video shows 7 to 9)
    start_past_deg: 3.0, // how far past the balance point the arms are cocked
    release_deg: 30.0,   // sling-to-arm angle when the loop slips off the pin
    // losses
    mu: 0.35, pin_r: 0.00635, ball_d: 0.040, Cd: 0.50, rho: 1.20,
    // air drag on the machine itself
    arm_face: 0.010,     // width of the arm's leading edge (m). The arm is 10 mm thick
    arm_Cd: 1.5,         // drag coefficient of that rectangular edge
    cw_CdA: 0.024,       // counterweight: drag coefficient x frontal area (m^2). Cans and plates 0.146 x 0.132 m, plus the rails
    sling_CdA: 0.002,    // ball, pouch and cords while they are on the sling: drag coefficient x area (m^2). Bare ball = 0.0006. TUNED
    air: 1.0,            // scales all three (0 = no air drag on the machine)
    // numerics
    dt: 5e-5, t_max: 5.0, frame_every: 20, after_release: 0.6   // (the C++ uses dt = 1e-5; this gives the same answer to 0.1 ft and runs 8x faster)
  };

  function simulate(input) {
    const P = Object.assign({}, DEFAULTS, input || {});
    const { r_cg, r_h, r_c, r_tip, L, pivot_h, ball_a, ball_b, m_arm, m_cw, m_p, dt } = P;
    const cwRel = P.cw_rel_deg * DEG;
    const I1 = P.I_arm_cg + m_arm * r_cg * r_cg;       // arm about the pivot
    const I2 = P.I_cw_cg + m_cw * r_c * r_c;           // counterweight about the hinge
    const C12 = -m_cw * r_h * r_c;                     // arm <-> counterweight coupling (minus: hinge is behind the pivot)
    const C13 = m_p * r_tip * L;                       // arm <-> ball coupling
    // Friction torque at each pin = mu * (the force the pin is carrying right now) * pin radius.
    // The loads are worked out every step further down; they start at the plain weights.
    let TAU_P = P.mu * (m_arm + m_cw + m_p) * G * P.pin_r;
    let TAU_H = P.mu * m_cw * G * P.pin_r;
    const kDrag = 0.5 * P.rho * P.Cd * Math.PI * P.ball_d * P.ball_d / 4;
    const sign = x => (x > 0) - (x < 0);

    // ---- air drag on the machine: main arm, counterweight, and the ball + pouch + cords on the sling ----
    const kArm = P.air * 0.5 * P.rho * P.arm_Cd * P.arm_face * (Math.pow(r_tip, 4) + Math.pow(r_h, 4)) / 4;   // torque = kArm * speed^2
    const kCw = P.air * 0.5 * P.rho * P.cw_CdA, kSling = P.air * 0.5 * P.rho * P.sling_CdA;                   // force = k * speed^2
    let q0 = 0, q1 = 0, q2 = 0, airLoss = 0;
    function airDrag(onSling) {
      q0 = -kArm * w1 * Math.abs(w1);
      const ax = r_h * Math.sin(th), ay = -r_h * Math.cos(th), cx = -r_c * Math.sin(ph), cy = r_c * Math.cos(ph);   // how the counterweight moves with th and ph
      const vx = ax * w1 + cx * w2, vy = ay * w1 + cy * w2, sp = Math.hypot(vx, vy);
      q0 += -kCw * sp * (vx * ax + vy * ay);  q1 = -kCw * sp * (vx * cx + vy * cy);  q2 = 0;
      if (onSling) {
        const gx = -r_tip * Math.sin(th), gy = r_tip * Math.cos(th), hx = -L * Math.sin(ps), hy = L * Math.cos(ps);
        const ux = gx * w1 + hx * w3, uy = gy * w1 + hy * w3, su = Math.hypot(ux, uy);
        q0 += -kSling * su * (ux * gx + uy * gy);  q2 = -kSling * su * (ux * hx + uy * hy);
      }
    }

    let th, ph, ps = 0, w1 = 0, w2 = 0, w3 = 0;

    // ---- balance point of the cocked machine, then the start angle ----
    const momentArm = a => m_arm * r_cg * Math.cos(a) + m_cw * (-r_h * Math.cos(a) + r_c * Math.cos(a + cwRel))
                         + m_p * (ball_a * Math.cos(a) - ball_b * Math.sin(a));
    let lo = 60 * DEG, hi = 120 * DEG;
    for (let i = 0; i < 60; i++) { const mid = 0.5 * (lo + hi); if (momentArm(mid) > 0) lo = mid; else hi = mid; }
    const balance = 0.5 * (lo + hi);
    th = balance - P.start_past_deg * DEG;
    ph = th + cwRel;

    // ---- equations of motion: M * accel = f ----
    // arm + counterweight (ball either riding on the arm or gone)
    let m00, m01, m11, f0, f1;
    function armCw(ballOnArm, opening) {
      const d = th - ph, sd = Math.sin(d);
      m00 = I1 + m_cw * r_h * r_h + (ballOnArm ? m_p * (ball_a * ball_a + ball_b * ball_b) : 0);
      m01 = C12 * Math.cos(d);  m11 = I2;
      f0 = -C12 * sd * w2 * w2 - G * (m_arm * r_cg - m_cw * r_h) * Math.cos(th);
      if (ballOnArm) f0 += -G * m_p * (ball_a * Math.cos(th) - ball_b * Math.sin(th));
      f1 = C12 * sd * w1 * w1 - G * m_cw * r_c * Math.cos(ph);
      const slip = opening ? 1 : sign(w2 - w1);        // hinge friction resists the counterweight arm starting to open
      f0 += -TAU_P * sign(w1) + TAU_H * slip;
      f1 += -TAU_H * slip;
    }
    // arm + counterweight + ball on the sling
    let m02, m22, f2;
    function armCwSling(opening) {
      const d = th - ph, e = th - ps;
      m00 = I1 + m_cw * r_h * r_h + m_p * r_tip * r_tip;
      m01 = C12 * Math.cos(d);  m02 = C13 * Math.cos(e);  m11 = I2;  m22 = m_p * L * L;
      f0 = -C12 * Math.sin(d) * w2 * w2 - C13 * Math.sin(e) * w3 * w3 - G * (m_arm * r_cg - m_cw * r_h + m_p * r_tip) * Math.cos(th);
      f1 = C12 * Math.sin(d) * w1 * w1 - G * m_cw * r_c * Math.cos(ph);
      f2 = C13 * Math.sin(e) * w1 * w1 - G * m_p * L * Math.cos(ps);
      const slip = opening ? 1 : sign(w2 - w1);
      f0 += -TAU_P * sign(w1) + TAU_H * slip;
      f1 += -TAU_H * slip;
    }
    function solve3(A, b) {
      const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
      if (Math.abs(det) < 1e-14) return null;
      const x = [];
      for (let c = 0; c < 3; c++) {
        const B = A.map((r, ri) => r.map((v, ci) => ci === c ? b[ri] : v));
        x.push((B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1]) - B[0][1] * (B[1][0] * B[2][2] - B[1][2] * B[2][0]) + B[0][2] * (B[1][0] * B[2][1] - B[1][1] * B[2][0])) / det);
      }
      return x;
    }

    // ball: 0 resting on the arm, 1 falling with the sling slack, 2 on the sling, 3 in flight
    let ball = 0, cwOnArm = true, t = 0;
    let bx = ball_a * Math.cos(th) - ball_b * Math.sin(th), by = ball_a * Math.sin(th) + ball_b * Math.cos(th), bvx = 0, bvy = 0;
    let a0 = 0, a1 = 0, a2 = 0;

    function energy() {
      armCw(false, false);
      const T = 0.5 * m00 * w1 * w1 + m01 * w1 * w2 + 0.5 * m11 * w2 * w2 + 0.5 * m_p * (bvx * bvx + bvy * bvy);
      const V = G * (m_arm * r_cg * Math.sin(th) + m_cw * (-r_h * Math.sin(th) + r_c * Math.sin(ph)) + m_p * by);
      return T + V;
    }
    const E_start = energy();

    const out = {
      ok: false, message: '', P, balance_deg: balance / DEG, start_deg: th / DEG, I1, I2,
      events: [], frames: [], peak: { pivot: 0, hinge: 0, sling: 0 }, minBallHeight: Infinity,
      energy: { start: E_start, tautLoss: 0 }
    };
    const event = (name, text) => out.events.push({ name, t, arm_deg: th / DEG, text });
    let tRelease = Infinity, step = 0;

    while (t < P.t_max && t < tRelease + P.after_release) {
      // ---- accelerations for this step ----
      let lifts = false;
      if (ball === 2) {
        armCwSling(cwOnArm);  airDrag(true);  f0 += q0;  f1 += q1;  f2 += q2;
        const fr = solve3([[m00, m01, m02], [m01, m11, 0], [m02, 0, m22]], [f0, f1, f2]);
        if (!fr) { out.message = 'The equations could not be solved at t = ' + t.toFixed(3) + ' s.'; return out; }
        if (cwOnArm && fr[1] - fr[0] <= 0) {            // still pressed together: th'' = ph''
          const A = m00 + 2 * m01 + m11, B = m02, D = m22, b0 = f0 + f1, b1 = f2, det = A * D - B * B;
          a0 = a1 = (D * b0 - B * b1) / det;  a2 = (A * b1 - B * b0) / det;
        } else { lifts = cwOnArm;  a0 = fr[0];  a1 = fr[1];  a2 = fr[2]; }
      } else {
        armCw(ball === 0, cwOnArm);  airDrag(false);  f0 += q0;  f1 += q1;
        const det = m00 * m11 - m01 * m01;
        const fr0 = (m11 * f0 - m01 * f1) / det, fr1 = (m00 * f1 - m01 * f0) / det;
        if (cwOnArm && fr1 - fr0 <= 0) a0 = a1 = (f0 + f1) / (m00 + 2 * m01 + m11);
        else { lifts = cwOnArm;  a0 = fr0;  a1 = fr1; }
        a2 = 0;
      }
      if (lifts) {
        cwOnArm = false;
        if (!out.events.some(e => e.name === 'cw')) event('cw', 'counterweight arm swings away from the main arm');
      }

      // ---- has the ball left the arm? (the arm's surface drops away faster than the ball can follow) ----
      if (ball === 0) {
        const rx = ball_a * Math.cos(th) - ball_b * Math.sin(th), ry = ball_a * Math.sin(th) + ball_b * Math.cos(th);
        const nx = -Math.sin(th), ny = Math.cos(th);
        const ax = a0 * (-ry) - w1 * w1 * rx, ay = a0 * rx - w1 * w1 * ry;
        bx = rx;  by = ry;  bvx = -w1 * ry;  bvy = w1 * rx;
        if (m_p * (ax * nx + ay * ny + G * ny) < 0) { ball = 1;  event('off', 'ball leaves the arm');  continue; }
      }

      // ---- loads on the pins (they set the friction for the next step) ----
      {
        const cx = -a0 * Math.sin(th) - w1 * w1 * Math.cos(th), cy = a0 * Math.cos(th) - w1 * w1 * Math.sin(th);
        const dx = -a1 * Math.sin(ph) - w2 * w2 * Math.cos(ph), dy = a1 * Math.cos(ph) - w2 * w2 * Math.sin(ph);
        const acx = -r_h * cx + r_c * dx, acy = -r_h * cy + r_c * dy;
        let Fx = m_arm * r_cg * cx + m_cw * acx, Fy = m_arm * (r_cg * cy + G) + m_cw * (acy + G);
        const hingeF = m_cw * Math.hypot(acx, acy + G);
        if (ball === 2) {
          const apx = r_tip * cx + L * (-a2 * Math.sin(ps) - w3 * w3 * Math.cos(ps));
          const apy = r_tip * cy + L * (a2 * Math.cos(ps) - w3 * w3 * Math.sin(ps));
          Fx += m_p * apx;  Fy += m_p * (apy + G);
          out.peak.sling = Math.max(out.peak.sling, m_p * Math.hypot(apx, apy + G));
        }
        const pivotF = Math.hypot(Fx, Fy);
        TAU_P = P.mu * pivotF * P.pin_r;  TAU_H = P.mu * hingeF * P.pin_r;
        if (ball !== 3) {                               // peaks are reported up to release
          out.peak.pivot = Math.max(out.peak.pivot, pivotF);  out.peak.hinge = Math.max(out.peak.hinge, hingeF);
          out.minBallHeight = Math.min(out.minBallHeight, by + pivot_h);
        }
      }

      // ---- picture for the animation and the graphs ----
      if (step % P.frame_every === 0) out.frames.push({ t, th, ph, ps, w1, w2, w3, bx, by, ball, cwOnArm });
      step++;

      // ---- step forward (speeds first, then angles) ----
      if (ball !== 3) airLoss += -(q0 * w1 + q1 * w2 + q2 * w3) * dt;
      w1 += a0 * dt;  w2 += a1 * dt;  w3 += a2 * dt;
      th += w1 * dt;  ph += w2 * dt;  ps += w3 * dt;
      t += dt;

      // ---- the counterweight arm swings back onto the main arm: they stick together again ----
      if (!cwOnArm && ph - th <= cwRel && w2 - w1 < 0) {
        let w;
        if (ball === 2) {                               // share the momentum with the ball too
          armCwSling(false);
          const A = m00 + 2 * m01 + m11, B = m02, D = m22;
          const p0 = (m00 + m01) * w1 + (m01 + m11) * w2 + m02 * w3, p1 = m02 * w1 + m22 * w3, det = A * D - B * B;
          w = (D * p0 - B * p1) / det;  w3 = (A * p1 - B * p0) / det;
        } else {
          armCw(ball === 0, false);
          w = (m00 * w1 + m01 * (w1 + w2) + m11 * w2) / (m00 + 2 * m01 + m11);
        }
        w1 = w2 = w;  ph = th + cwRel;  cwOnArm = true;
      }

      // ---- ball falling with the sling slack ----
      if (ball === 1) {
        bvy -= G * dt;  bx += bvx * dt;  by += bvy * dt;
        const tx = r_tip * Math.cos(th), ty = r_tip * Math.sin(th), dx = bx - tx, dy = by - ty;
        if (Math.hypot(dx, dy) >= L) {
          // The sling snaps tight. The ball can no longer move along the sling's length, so that part of its motion is lost.
          const E_before = energy();
          ps = Math.atan2(dy, dx);
          armCw(false, false);
          const gx = -r_tip * Math.sin(th), gy = r_tip * Math.cos(th), hx = -L * Math.sin(ps), hy = L * Math.cos(ps);
          const q = solve3([[m00 + m_p * (gx * gx + gy * gy), m01, m_p * (gx * hx + gy * hy)],
                            [m01, m11, 0],
                            [m_p * (gx * hx + gy * hy), 0, m_p * (hx * hx + hy * hy)]],
                           [m00 * w1 + m01 * w2 + m_p * (gx * bvx + gy * bvy), m01 * w1 + m11 * w2, m_p * (hx * bvx + hy * bvy)]);
          w1 = q[0];  w2 = q[1];  w3 = q[2];  ball = 2;
          bx = tx + L * Math.cos(ps);  by = ty + L * Math.sin(ps);
          bvx = gx * w1 + hx * w3;     bvy = gy * w1 + hy * w3;
          out.energy.tautLoss = E_before - energy();
          event('taut', 'sling goes tight');
        }
      }

      // ---- ball on the sling: has the loop slipped off the pin? ----
      if (ball === 2) {
        bx = r_tip * Math.cos(th) + L * Math.cos(ps);   by = r_tip * Math.sin(th) + L * Math.sin(ps);
        bvx = -r_tip * Math.sin(th) * w1 - L * Math.sin(ps) * w3;
        bvy = r_tip * Math.cos(th) * w1 + L * Math.cos(ps) * w3;
        let rel = (ps - th + Math.PI) % (2 * Math.PI);
        if (rel < 0) rel += 2 * Math.PI;
        rel -= Math.PI;                                 // sling angle from the arm line, -180..180 deg
        if (rel <= P.release_deg * DEG && rel > -35 * DEG && bvx > 0 && bvy > 0) {
          ball = 3;  tRelease = t;
          out.launch = { t, x: bx, y: by + pivot_h, vx: bvx, vy: bvy, speed: Math.hypot(bvx, bvy), angle_deg: Math.atan2(bvy, bvx) / DEG };
          out.energy.release = energy();
          event('release', 'ball released');
        }
      } else if (ball === 3) {                          // flight, only so the animation can show it leaving
        const sp = Math.hypot(bvx, bvy);
        bvx += (-kDrag * sp * bvx / m_p) * dt;  bvy += (-G - kDrag * sp * bvy / m_p) * dt;
        bx += bvx * dt;  by += bvy * dt;
      }
    }

    if (!out.launch) {
      out.message = 'The ball was never released (it ended ' + ['resting on the arm', 'falling with the sling slack', 'on the sling'][ball] + '). Try a different start or release angle.';
      return out;
    }

    // ---- flight to the floor, with and without air drag ----
    function fly(k) {
      let x = out.launch.x, y = out.launch.y, vx = out.launch.vx, vy = out.launch.vy, top = y, n = 0;
      const h = 0.0002, path = [[x, y]];
      while (y > 0) {
        const sp = Math.hypot(vx, vy);
        vx += (-k * sp * vx / m_p) * h;  vy += (-G - k * sp * vy / m_p) * h;
        x += vx * h;  y += vy * h;  top = Math.max(top, y);
        if (++n % 50 === 0) path.push([x, y]);
      }
      path.push([x, 0]);
      return { range: x, top, path };
    }
    out.drag = fly(kDrag);
    out.vacuum = fly(0);
    const ke = 0.5 * m_p * out.launch.speed * out.launch.speed;
    out.energy.ball = ke;
    out.energy.air = airLoss;
    out.energy.friction = E_start - out.energy.release - out.energy.tautLoss - airLoss;
    out.energy.available = E_start - (out.energy.release - ke);   // what the arms gave up by release
    out.ok = true;
    return out;
  }

  return { simulate, DEFAULTS };
})();
