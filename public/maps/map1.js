export default {
    name: "Classic Big Map",
    gridSize: 25,
    tile: 4,
    generate: function (THREE, wallMat, platMat) {
        const walls = [];
        const platforms = [];
        const GRID_SIZE = this.gridSize;
        const TILE = this.tile;
        const MAP_W = GRID_SIZE * TILE;
        const MAP_H = GRID_SIZE * TILE;

        const mapLayout = Array(GRID_SIZE).fill(0).map((_, z) =>
            Array(GRID_SIZE).fill(0).map((__, x) => (x === 0 || x === GRID_SIZE - 1 || z === 0 || z === GRID_SIZE - 1) ? 1 : 0)
        );

        // Outer Walls
        for (let z = 0; z < GRID_SIZE; z++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (mapLayout[z][x] === 1) {
                    const wall = new THREE.Mesh(new THREE.BoxGeometry(TILE, 12, TILE), wallMat);
                    const px = x * TILE - (MAP_W - TILE) / 2;
                    const pz = z * TILE - (MAP_H - TILE) / 2;
                    wall.position.set(px, 6, pz);
                    walls.push(wall);
                }
            }
        }

        // Static Brown boxes/crates (Penetrable Cover)
        const plankMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });

        function addBox(x, z, s = 4) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), plankMat);
            box.position.set(x, s / 2, z);
            box.userData = { penetrable: true };
            walls.push(box);
        }

        // Symmetrically placed boxes
        const offset = 18;
        addBox(-offset, -offset);
        addBox(offset, -offset);
        addBox(-offset, offset);
        addBox(offset, offset);

        addBox(-10, 0, 5);
        addBox(10, 0, 5);
        addBox(0, -10, 5);
        addBox(0, 10, 5);

        // Add some more in the far corners
        addBox(-35, -35, 6);
        addBox(35, -35, 6);
        addBox(-35, 35, 6);
        addBox(35, 35, 6);

        return { walls, platforms };
    }
};
