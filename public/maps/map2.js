export default {
    name: "Iceworld (Map 2)",
    gridSize: 40, // Increased to 40 for a much more spacious feel
    tile: 4,
    generate: function (THREE, wallMat, platMat) {
        const walls = [];
        const platforms = [];
        const GRID_SIZE = this.gridSize;
        const TILE = this.tile;
        const arenaW = GRID_SIZE * TILE; // 160 units

        const wallH = 12;
        const wallT = 2;

        function addWall(w, h, d, x, y, z, ry = 0, mat = wallMat, penetrable = false) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.set(x, y, z);
            mesh.rotation.y = ry;
            mesh.userData = { penetrable };
            walls.push(mesh);
        }

        // 1. Expanded Outer Square Arena (160x160)
        addWall(arenaW, wallH, wallT, 0, wallH / 2, -arenaW / 2); // North
        addWall(arenaW, wallH, wallT, 0, wallH / 2, arenaW / 2);  // South
        addWall(wallT, wallH, arenaW, -arenaW / 2, wallH / 2, 0); // West
        addWall(wallT, wallH, arenaW, arenaW / 2, wallH / 2, 0);  // East

        // 2. Thickened Long Pillars (== in diagram)
        // Optimized for narrower middle gap and wider bases/sides
        const pilW = 45; // Very wide pillars to narrow the gap
        const pilD = 35; // Depth of pillars
        const pilH = 10;
        const pilX = 28; // Position creates a tight 11-unit middle gap and 30-unit side lanes
        const pilZ = 22.5; // Positions that leave a huge 40-unit depth for Bases

        // North pair
        addWall(pilW, pilH, pilD, -pilX, pilH / 2, -pilZ); // West
        addWall(pilW, pilH, pilD, pilX, pilH / 2, -pilZ);  // East
        // South pair
        addWall(pilW, pilH, pilD, -pilX, pilH / 2, pilZ);  // West
        addWall(pilW, pilH, pilD, pilX, pilH / 2, pilZ);   // East

        // 3. Integrated Barriers (- in diagram)
        const plankMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
        const barW = 15; // Proportionally wider for the new scale
        const barH = 6;
        const barD = 3;

        // A. Corner-Pillar Barriers (Integrated at the spawn ends)
        // North Side
        const nEdge = -pilZ - pilD / 2 + barD / 2;
        addWall(barW, barH, barD, -pilX - pilW / 2 - barW / 2, barH / 2, nEdge, 0, plankMat); // NW
        addWall(barW, barH, barD, pilX + pilW / 2 + barW / 2, barH / 2, nEdge, 0, plankMat);  // NE

        // South Side
        const sEdge = pilZ + pilD / 2 - barD / 2;
        addWall(barW, barH, barD, -pilX - pilW / 2 - barW / 2, barH / 2, sEdge, 0, plankMat); // SW
        addWall(barW, barH, barD, pilX + pilW / 2 + barW / 2, barH / 2, sEdge, 0, plankMat);  // SE

        // B. Side-Wall Center Barriers 
        addWall(barW, barH, barD, -arenaW / 2 + barW / 2 + 1, barH / 2, 0, 0, plankMat);
        addWall(barW, barH, barD, arenaW / 2 - barW / 2 - 1, barH / 2, 0, 0, plankMat);

        return { walls, platforms };
    }
};
