export default {
    name: "Orange Arena",
    gridSize: 25,
    tile: 4,
    generate: function (THREE, wallMat, platMat) {
        const walls = [];
        const platforms = [];
        const GRID_SIZE = this.gridSize;
        const TILE = this.tile;
        const arenaW = GRID_SIZE * TILE; // 100

        const wallH = 8;
        const wallT = 1.5;

        // Custom orange material for walls and barriers
        const orangeWallMat = new THREE.MeshStandardMaterial({ color: 0xff9800 });
        const orangeBarrierMat = new THREE.MeshStandardMaterial({ color: 0xffa726, roughness: 0.8 });

        function addWall(w, h, d, x, y, z, ry = 0, mat = orangeWallMat, penetrable = false) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.set(x, y, z);
            mesh.rotation.y = ry;
            mesh.userData = { penetrable };
            walls.push(mesh);
        }

        // 1. Outer Square Walls (Orange)
        addWall(arenaW, wallH, wallT, 0, wallH / 2, -arenaW / 2); // N
        addWall(arenaW, wallH, wallT, 0, wallH / 2, arenaW / 2);  // S
        addWall(wallT, wallH, arenaW, -arenaW / 2, wallH / 2, 0); // W
        addWall(wallT, wallH, arenaW, arenaW / 2, wallH / 2, 0);  // E

        // 2. Central Platform / Ramp (Grey)
        const platS = 30;
        const platH = 4;
        const rampL = 15;

        // Main raised platform
        const centerPlat = new THREE.Mesh(new THREE.BoxGeometry(platS, platH, platS), platMat);
        centerPlat.position.set(0, platH / 2 - 0.1, 0);
        platforms.push({ mesh: centerPlat, box: new THREE.Box3().setFromObject(centerPlat), height: platH });

        // Ramps (North and South) - Inverted rotations to slope UP towards center (/‾\)
        const rampGeom = new THREE.BoxGeometry(platS, 0.2, rampL + 2);
        const rampMat = platMat.clone();

        const rampN = new THREE.Mesh(rampGeom, rampMat);
        rampN.position.set(0, platH / 2, -platS / 2 - rampL / 2);
        rampN.rotation.x = -Math.atan2(platH, rampL); // Was positive
        platforms.push({ mesh: rampN, box: new THREE.Box3().setFromObject(rampN), height: platH, isRamp: true, hypo: rampL + 2 });

        const rampS = new THREE.Mesh(rampGeom, rampMat);
        rampS.position.set(0, platH / 2, platS / 2 + rampL / 2);
        rampS.rotation.x = Math.atan2(platH, rampL); // Was negative
        platforms.push({ mesh: rampS, box: new THREE.Box3().setFromObject(rampS), height: platH, isRamp: true, hypo: rampL + 2 });

        // 3. Orange Barriers (Penetrable)
        const bW = 12, bH = 4, bD = 2;

        // Inner ring around the platform
        addWall(bW, bH, bD, -25, bH / 2, -25, Math.PI / 4, orangeBarrierMat, true);
        addWall(bW, bH, bD, 25, bH / 2, -25, -Math.PI / 4, orangeBarrierMat, true);
        addWall(bW, bH, bD, -25, bH / 2, 25, -Math.PI / 4, orangeBarrierMat, true);
        addWall(bW, bH, bD, 25, bH / 2, 25, Math.PI / 4, orangeBarrierMat, true);

        // Long barriers along side lanes
        addWall(bD, bH, 20, -40, bH / 2, 0, 0, orangeBarrierMat, true);
        addWall(bD, bH, 20, 40, bH / 2, 0, 0, orangeBarrierMat, true);

        return { walls, platforms };
    }
};
