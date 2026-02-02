export default function (playersList = [], container, THREE_LIB, mapConfig) {
  const THREE = THREE_LIB || window.THREE;
  if (!THREE || !mapConfig) return;

  // 1. Scene Setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510);
  scene.fog = new THREE.FogExp2(0x050510, 0.02); // Slightly less fog for bigger map
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // 2. Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(50, 80, 50); sun.castShadow = true;
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  scene.add(sun);

  // 3. Textures
  function createGridTex(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = c1; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = c2; ctx.lineWidth = 4; ctx.strokeRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const wallTex = createGridTex('#1a1a2e', '#4f4f7a');
  const floorTex = createGridTex('#050508', '#111122');
  floorTex.repeat.set(60, 60);

  function createLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = color; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
    ctx.fillText(text, 64, 24);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.5, 0.375, 1); return sprite;
  }

  // 4. Map & Collision Geometry
  const GRID_SIZE = mapConfig.gridSize || 25;
  const TILE = mapConfig.tile || 4;
  const MAP_W = GRID_SIZE * TILE, MAP_H = GRID_SIZE * TILE;
  const walls = [], platforms = [], wallGroup = new THREE.Group();
  const penetrableObjects = []; // New array for penetrable objects
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex });
  const platMat = new THREE.MeshStandardMaterial({ color: 0x252535, map: createGridTex('#202035', '#6666bb') });

  // Load objects from mapConfig
  if (mapConfig.generate) {
    const { walls: mapWalls, platforms: mapPlatforms } = mapConfig.generate(THREE, wallMat, platMat);
    mapWalls.forEach(w => {
      scene.add(w);
      const isPenetrable = w.userData && w.userData.penetrable;

      if (isPenetrable) {
        penetrableObjects.push({
          box: new THREE.Box3().setFromObject(w),
          mesh: w,
          id: w.uuid
        });
      } else {
        walls.push(new THREE.Box3().setFromObject(w));
      }

      const rw = new THREE.Mesh(new THREE.BoxGeometry(w.geometry.parameters.width + 0.1, w.geometry.parameters.height + 0.1, w.geometry.parameters.depth + 0.1));
      rw.position.copy(w.position); rw.rotation.copy(w.rotation); wallGroup.add(rw);
    });
    mapPlatforms.forEach(p => {
      scene.add(p.mesh || p);
      platforms.push(p.box ? p : { box: new THREE.Box3().setFromObject(p), height: p.height || (p.geometry ? p.geometry.parameters.height : 0.2) });
    });
  }

  // 5. Floor & Collectibles
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: floorTex }));
  floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true; scene.add(floorMesh);

  const pickups = [];
  function isSafe(testPos) {
    const tb = new THREE.Box3().setFromCenterAndSize(testPos, new THREE.Vector3(5, 5, 5));
    for (const w of walls) if (tb.intersectsBox(w)) return false;
    for (const p of platforms) if (tb.intersectsBox(p.box)) return false;
    for (const o of penetrableObjects) if (tb.intersectsBox(o.box)) return false;
    return true;
  }
  function spawnPickup(type) {
    let safePos = null, att = 0;
    while (!safePos && att < 100) {
      const rx = (Math.random() - 0.5) * (MAP_W - 25), rz = (Math.random() - 0.5) * (MAP_H - 25);
      const test = new THREE.Vector3(rx, 0, rz);
      if (isSafe(test.clone().add(new THREE.Vector3(0, 1.2, 0)))) safePos = test;
      att++;
    }
    if (!safePos) return;
    const g = new THREE.Group();
    let mesh, label;
    if (type === 'health') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x003300 }));
      label = createLabel("HEALTH +25", "#00ff00");
    } else {
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 12, 12), new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0x330033 }));
      label = createLabel("POWER GUN", "#ff00ff");
    }
    label.position.y = 1.6; g.add(mesh); g.add(label); g.position.copy(safePos).add(new THREE.Vector3(0, 1.2, 0));
    scene.add(g); pickups.push({ group: g, type, alive: true });
  }
  for (let i = 0; i < 6; i++) spawnPickup(Math.random() > 0.5 ? 'health' : 'power'); // More pickups for bigger map

  // 6. Players
  const players = {};
  const bullets = [];
  let paused = false;
  const colors = [0xff3333, 0x33ff33, 0x3333ff, 0xffff33];
  function getSafeSpawn() {
    let att = 0;
    while (att < 100) {
      const rx = (Math.random() - 0.5) * (MAP_W - 30), rz = (Math.random() - 0.5) * (MAP_H - 30);
      const test = new THREE.Vector3(rx, 0, rz);
      if (isSafe(test.clone().add(new THREE.Vector3(0, 1.2, 0)))) return test;
      att++;
    }
    return new THREE.Vector3(0, 0, 0);
  }
  playersList.forEach((p, i) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 4, 8), new THREE.MeshStandardMaterial({ color: colors[i % colors.length] }));
    b.position.y = 1.0; g.add(b);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    visor.position.set(0, 1.6, -0.4); g.add(visor);
    const hpg = new THREE.Group(); hpg.position.y = 2.4;
    hpg.add(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.12), new THREE.MeshBasicMaterial({ color: 0x330000 })));
    const hpf = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.12), new THREE.MeshBasicMaterial({ color: 0x00ff00 })); // Plane HP bar
    hpf.position.z = 0.01; hpg.add(hpf);
    g.add(hpg); g.hpBar = hpf; g.hpGroup = hpg;
    scene.add(g);
    players[p.id] = {
      id: p.id, mesh: g, color: colors[i % colors.length], pos: getSafeSpawn(), velY: 0, onGround: true,
      meshY: 0, cameraY: 1.6, pitch: 0, moveIn: { x: 0, y: 0 }, lookIn: { x: 0, y: 0 },
      hp: 100, alive: true, respawn: 0, shootCd: 0, weapon: 'normal', shake: 0
    };
    players[p.id].meshY = players[p.id].pos.y;
  });

  // 7. Logic
  function input(id, d) {
    if (d.pause !== undefined) paused = d.pause;
    const p = players[id]; if (!p || !p.alive) return;
    if (d.moveX !== undefined) p.moveIn.x = d.moveX; if (d.moveY !== undefined) p.moveIn.y = d.moveY;
    if (d.lookX !== undefined) p.lookIn.x = d.lookX; if (d.lookY !== undefined) p.lookIn.y = d.lookY;
    if (d.jump && p.onGround) { p.velY = 0.35; p.onGround = false; }
    if (d.shoot && p.shootCd <= 0) {
      const pow = p.weapon === 'power';
      const bMesh = new THREE.Mesh(new THREE.SphereGeometry(pow ? 0.35 : 0.12, 4, 4), new THREE.MeshBasicMaterial({ color: pow ? 0xff00ff : 0xffff00 }));
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(p.pitch, p.mesh.rotation.y, 0, 'YXZ'));
      bMesh.position.copy(p.pos).add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(dir, 0.5); // 0.5 offset to clear player internals
      bullets.push({ mesh: bMesh, dir, speed: pow ? 2.5 : 5.0, owner: p.id, life: 300, dmg: pow ? 60 : 20 });
      scene.add(bMesh); p.shootCd = pow ? 22 : 12;
    }
  }

  function update() {
    if (paused) return;
    const GRAVITY = 0.016;
    Object.values(players).forEach(p => {
      if (!p.alive) {
        if (--p.respawn <= 0) { p.hp = 100; p.alive = true; p.mesh.visible = true; p.pos.copy(getSafeSpawn()); p.velY = 0; p.weapon = 'normal'; }
        return;
      }
      if (p.shootCd > 0) p.shootCd--; if (p.shake > 0) p.shake *= 0.85;
      p.mesh.rotation.y -= p.lookIn.x * 0.12; p.pitch = THREE.MathUtils.clamp(p.pitch - p.lookIn.y * 0.12, -1.4, 1.4);
      const move = new THREE.Vector3().addScaledVector(new THREE.Vector3(0, 0, -1).applyEuler(p.mesh.rotation), -p.moveIn.y).addScaledVector(new THREE.Vector3(1, 0, 0).applyEuler(p.mesh.rotation), p.moveIn.x).multiplyScalar(0.38);

      p.velY -= GRAVITY; p.pos.y += p.velY; if (p.pos.y < 0) { p.pos.y = 0; p.velY = 0; p.onGround = true; }

      const next = p.pos.clone().add(move);
      const pBox = new THREE.Box3().setFromCenterAndSize(next.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0.8, 2.4, 0.8));
      let blocked = false;
      for (const w of walls) if (pBox.intersectsBox(w)) { blocked = true; break; }
      if (!blocked) {
        for (const obj of penetrableObjects) if (pBox.intersectsBox(obj.box)) { blocked = true; break; }
      }
      if (!blocked) {
        for (const t of platforms) {
          if (pBox.intersectsBox(t.box)) {
            let h = t.height;
            if (t.isRamp) {
              const local = t.mesh.worldToLocal(next.clone());
              if (t.mesh.rotation.x < 0) h = THREE.MathUtils.lerp(0, t.height, (local.z + t.hypo / 2) / t.hypo);
              else h = THREE.MathUtils.lerp(0, t.height, (t.hypo / 2 - local.z) / t.hypo);
            }
            // Block horizontally if player is more than 1.2 units below the surface height at this point
            if (p.pos.y < h - 1.2) { blocked = true; break; }
          }
        }
      }

      if (!blocked) {
        p.pos.x = next.x; p.pos.z = next.z;
      }

      let ground = 0;
      const pBoxGround = new THREE.Box3().setFromCenterAndSize(p.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0.8, 2.4, 0.8));

      for (const t of platforms) {
        if (pBoxGround.intersectsBox(t.box)) {
          let h = t.height;
          if (t.isRamp) {
            const local = t.mesh.worldToLocal(p.pos.clone());
            if (t.mesh.rotation.x < 0) h = THREE.MathUtils.lerp(0, t.height, (local.z + t.hypo / 2) / t.hypo);
            else h = THREE.MathUtils.lerp(0, t.height, (t.hypo / 2 - local.z) / t.hypo);
          }
          if (p.pos.y >= h - 0.8) ground = Math.max(ground, h); // 0.8 unit step-up tolerance
        }
      }
      if (p.pos.y < ground) { p.pos.y = ground; p.velY = 0; p.onGround = true; }

      p.meshY = THREE.MathUtils.lerp(p.meshY, p.pos.y, 0.3);
      p.mesh.position.set(p.pos.x, p.meshY, p.pos.z);
      p.cameraY = THREE.MathUtils.lerp(p.cameraY, p.pos.y + 1.8, 0.2);

      // Pickup Detection
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pu = pickups[i];
        if (!pu.alive) continue;
        if (p.pos.clone().add(new THREE.Vector3(0, 1, 0)).distanceTo(pu.group.position) < 2.2) {
          pu.alive = false; scene.remove(pu.group);
          if (pu.type === 'health') p.hp = Math.min(100, p.hp + 25);
          else p.weapon = 'power';

          const collectedType = pu.type;
          pickups.splice(i, 1);
          setTimeout(() => spawnPickup(collectedType), 10000);
        }
      }
    });

    const activeB = [];
    bullets.forEach(b => {
      // Sub-stepping for ultra-reliable collision (especially at point-blank)
      const steps = 5;
      const stepVec = b.dir.clone().multiplyScalar(b.speed / steps);
      let rem = false;
      const startPos = b.mesh.position.clone();

      for (let s = 0; s < steps; s++) { // Start at 0 to check point-blank spawn
        if (rem) break;
        const testPos = startPos.clone().add(stepVec.clone().multiplyScalar(s));

        // Wall check
        // Bullet penetration check
        penetrableObjects.forEach(obj => {
          if (obj.box.containsPoint(testPos)) {
            // Only reduce damage once per object per bullet
            if (!b.penetratedIds) b.penetratedIds = new Set();
            if (!b.penetratedIds.has(obj.id)) {
              b.dmg *= 0.5; // Reduce damage by 50%
              b.penetratedIds.add(obj.id);
            }
          }
        });

        const hitWall = walls.some(w => w.containsPoint(testPos));
        if (hitWall) { rem = true; break; }

        // Player check
        Object.values(players).forEach(p => {
          if (!p.alive || p.id === b.owner || rem) return;
          // More careful hitbox: Cylinder/Capsule check (dist to vertical segment)
          const dx = testPos.x - p.pos.x, dz = testPos.z - p.pos.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < 1.0) { // Horizontal radius 1.0
            if (testPos.y >= p.pos.y && testPos.y <= p.pos.y + 2.4) { // Height check
              p.hp -= b.dmg; p.shake = 0.5; rem = true;
              const f = document.getElementById(`flash-${p.id}`); if (f) { f.style.opacity = '1'; setTimeout(() => f.style.opacity = '0', 100); }
              if (p.hp <= 0) {
                p.hp = 0; p.alive = false; p.respawn = 120;
                if (window.socket) window.socket.emit("reportKill", { killerId: b.owner, victimId: p.id });
              }
            }
          }
        });
      }

      b.mesh.position.addScaledVector(b.dir, b.speed); b.life--;
      if (b.life <= 0) rem = true;

      if (rem) scene.remove(b.mesh); else activeB.push(b);
    });
    bullets.splice(0, bullets.length, ...activeB);

    // RADAR (FULL VIEW OF 25x25 MAP)
    Object.values(players).forEach(p => {
      const c = document.getElementById(`radar-${p.id}`); if (!c) return;
      const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 130, 130);
      const s = 1.15, off = 65; // Zoomed out for 25x25 (100 units)

      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.strokeRect((-MAP_W / 2 - p.pos.x) * s + off, (-MAP_H / 2 - p.pos.z) * s + off, MAP_W * s, MAP_H * s);

      pickups.forEach(pu => {
        if (!pu.alive) return;
        const px = (pu.group.position.x - p.pos.x) * s + off, pz = (pu.group.position.z - p.pos.z) * s + off;
        ctx.fillStyle = pu.type === 'health' ? '#0f0' : '#f0f'; ctx.fillRect(px - 4, pz - 4, 8, 8);
      });

      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(off, off, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(off, off);
      ctx.lineTo(off - Math.sin(p.mesh.rotation.y) * 15, off - Math.cos(p.mesh.rotation.y) * 15); ctx.stroke();

      Object.values(players).forEach(t => {
        if (t.id === p.id || !t.alive) return;
        const tx = (t.pos.x - p.pos.x) * s + off, tz = (t.pos.z - p.pos.z) * s + off;
        ctx.fillStyle = '#' + t.color.toString(16).padStart(6, '0');
        ctx.beginPath(); ctx.arc(tx, tz, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
      });
    });
  }

  function loop() {
    update();
    const count = playersList.length, w = container.clientWidth / (count === 2 ? 1 : (count > 2 ? 2 : 1)), h = container.clientHeight / (count === 2 ? 2 : (count > 2 ? 2 : 1)), rs = (count === 2) ? 2 : (count > 2 ? 2 : 1);
    renderer.setScissorTest(true);
    playersList.forEach((pl, i) => {
      const cur = players[pl.id], cx = (count === 2) ? 0 : (i % 2), cy = (count === 2) ? i : (Math.floor(i / 2));
      renderer.setViewport(cx * w, (rs - 1 - cy) * h, w, h); renderer.setScissor(cx * w, (rs - 1 - cy) * h, w, h);
      if (cur.alive) {
        camera.position.set(cur.pos.x, cur.cameraY, cur.pos.z);
        camera.position.x += (Math.random() - 0.5) * cur.shake; camera.position.y += (Math.random() - 0.5) * cur.shake;
        camera.rotation.set(cur.pitch, cur.mesh.rotation.y, 0, 'YXZ');
      } else { camera.position.set(0, 100, 0); camera.lookAt(0, 0, 0); }
      camera.aspect = w / h; camera.updateProjectionMatrix();

      Object.values(players).forEach(other => {
        other.mesh.hpGroup.lookAt(camera.position); other.mesh.visible = other.alive;
        other.mesh.hpBar.scale.x = Math.max(0.01, other.hp / 100);
        other.mesh.hpBar.position.x = (other.hp / 100 - 1) / 2; // Center horizontally
      });

      cur.mesh.visible = false; renderer.render(scene, camera); cur.mesh.visible = cur.alive;
    });
    requestAnimationFrame(loop);
  } loop(); return { input, stop: () => { paused = true; } };
}