export default function (playersList = []) {
  const c = document.getElementById("game");
  const ctx = c.getContext("2d");

  // Game constants
  const LANE_COUNT = 4;
  const ROAD_WIDTH = 400;
  const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
  const CAR_WIDTH = 45;
  const CAR_HEIGHT = 80;
  const ROAD_LINE_HEIGHT = 40;
  const ROAD_LINE_GAP = 30;
  const VIEWPORT_HEIGHT = c.height;

  // Game state
  let gameOver = false;
  let paused = false;
  let gameTime = 0;
  let spawnTimer = 0;

  // SHARED traffic (all players see the same obstacles)
  let trafficCars = [];
  const trafficColors = ['#555555', '#666666', '#777777', '#888888', '#664444', '#446644'];

  // Player cars - all in the SAME world
  let cars = {};
  const playerColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];

  playersList.forEach((p, i) => {
    cars[p.id] = {
      x: LANE_WIDTH * (i % LANE_COUNT) + LANE_WIDTH / 2 - CAR_WIDTH / 2,
      worldY: 0, // Position in infinite world (smaller = further ahead)
      speed: 5,
      minSpeed: 1,
      maxSpeed: 12,
      color: playerColors[i % playerColors.length],
      name: p.name,
      score: 0,
      alive: true,
      gasPressed: false,
      brakePressed: false
    };
  });

  function spawnTraffic() {
    // Spawn traffic ahead of the leading player
    const aliveCars = Object.values(cars).filter(c => c.alive);
    if (aliveCars.length === 0) return;

    const leadingY = Math.min(...aliveCars.map(c => c.worldY));

    const lane = Math.floor(Math.random() * LANE_COUNT);
    const x = lane * LANE_WIDTH + LANE_WIDTH / 2 - CAR_WIDTH / 2;

    // Don't spawn if there's traffic too close in this lane
    const tooClose = trafficCars.some(t =>
      Math.abs(t.x - x) < CAR_WIDTH && Math.abs(t.worldY - (leadingY - VIEWPORT_HEIGHT)) < 150
    );

    if (!tooClose) {
      trafficCars.push({
        x: x,
        worldY: leadingY - VIEWPORT_HEIGHT - CAR_HEIGHT - Math.random() * 200,
        speed: 2 + Math.random() * 2.5, // Traffic speed (slower than players)
        color: trafficColors[Math.floor(Math.random() * trafficColors.length)]
      });
    }
  }

  function input(id, d, name) {
    if (d.pause !== undefined) {
      paused = d.pause;
      return;
    }

    if (!cars[id]) {
      const playerCount = Object.keys(cars).length;
      cars[id] = {
        x: LANE_WIDTH * (playerCount % LANE_COUNT) + LANE_WIDTH / 2 - CAR_WIDTH / 2,
        worldY: 0,
        speed: 5,
        minSpeed: 1,
        maxSpeed: 12,
        color: playerColors[playerCount % playerColors.length],
        name: name || "Player",
        score: 0,
        alive: true,
        gasPressed: false,
        brakePressed: false
      };
    }

    let car = cars[id];
    if (!car.alive) return;

    if (d.left && car.x > 10) {
      car.x -= 12;
    }
    if (d.right && car.x < ROAD_WIDTH - CAR_WIDTH - 10) {
      car.x += 12;
    }

    if (d.gas) {
      car.gasPressed = true;
      car.speed = Math.min(car.speed + 0.5, car.maxSpeed);
    }

    if (d.brake) {
      car.brakePressed = true;
      car.speed = Math.max(car.speed - 0.7, car.minSpeed);
    }
  }

  function boxesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  function drawCar(x, y, color, isPlayer = false, braking = false) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, CAR_WIDTH, CAR_HEIGHT, 6);
    ctx.fill();

    ctx.fillStyle = '#222';
    ctx.fillRect(x + 6, y + 12, CAR_WIDTH - 12, 18);
    ctx.fillRect(x + 6, y + CAR_HEIGHT - 25, CAR_WIDTH - 12, 12);

    if (isPlayer) {
      ctx.fillStyle = '#ffff88';
      ctx.fillRect(x + 4, y, 8, 4);
      ctx.fillRect(x + CAR_WIDTH - 12, y, 8, 4);
    }

    ctx.fillStyle = braking ? '#ff6666' : '#990000';
    ctx.fillRect(x + 4, y + CAR_HEIGHT - 4, 8, 4);
    ctx.fillRect(x + CAR_WIDTH - 12, y + CAR_HEIGHT - 4, 8, 4);
  }

  function drawRoad(offsetX, roadOffsetY) {
    ctx.fillStyle = '#333';
    ctx.fillRect(offsetX, 0, ROAD_WIDTH, VIEWPORT_HEIGHT);

    ctx.fillStyle = '#fff';
    ctx.fillRect(offsetX, 0, 4, VIEWPORT_HEIGHT);
    ctx.fillRect(offsetX + ROAD_WIDTH - 4, 0, 4, VIEWPORT_HEIGHT);

    ctx.fillStyle = '#fff';
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const x = offsetX + lane * LANE_WIDTH - 2;
      for (let y = roadOffsetY % (ROAD_LINE_HEIGHT + ROAD_LINE_GAP); y < VIEWPORT_HEIGHT; y += ROAD_LINE_HEIGHT + ROAD_LINE_GAP) {
        ctx.fillRect(x, y, 4, ROAD_LINE_HEIGHT);
      }
    }
  }

  function drawPlayerViewport(viewCar, viewportIndex, totalViewports) {
    const viewportWidth = c.width / totalViewports;
    const offsetX = viewportIndex * viewportWidth;

    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, 0, viewportWidth, VIEWPORT_HEIGHT);
    ctx.clip();

    // Camera follows this player's car
    const cameraY = viewCar.worldY;
    const playerScreenY = VIEWPORT_HEIGHT * 0.7; // Player appears at 70% from top

    // Road offset for animation
    const roadOffsetY = (-cameraY) % (ROAD_LINE_HEIGHT + ROAD_LINE_GAP);
    const roadOffsetX = offsetX + (viewportWidth - ROAD_WIDTH) / 2;

    drawRoad(roadOffsetX, roadOffsetY);

    // Draw traffic cars
    trafficCars.forEach(traffic => {
      const screenY = playerScreenY + (traffic.worldY - cameraY);
      if (screenY > -CAR_HEIGHT && screenY < VIEWPORT_HEIGHT + CAR_HEIGHT) {
        drawCar(roadOffsetX + traffic.x, screenY, traffic.color, false, false);
      }
    });

    // Draw ALL player cars (so you can see opponents)
    Object.values(cars).forEach(car => {
      if (!car.alive) return;

      const screenY = playerScreenY + (car.worldY - cameraY);

      // Only draw if visible on screen
      if (screenY > -CAR_HEIGHT - 50 && screenY < VIEWPORT_HEIGHT + CAR_HEIGHT) {
        drawCar(roadOffsetX + car.x, screenY, car.color, true, car.brakePressed);

        // Name above car
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(car.name, roadOffsetX + car.x + CAR_WIDTH / 2, screenY - 6);
        ctx.textAlign = 'left';
      }
    });

    // HUD for this viewport
    const barX = offsetX + 10;
    const barY = 10;

    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, 70, 10);

    const speedPercent = (viewCar.speed - viewCar.minSpeed) / (viewCar.maxSpeed - viewCar.minSpeed);
    ctx.fillStyle = viewCar.speed > 9 ? '#ff4444' : viewCar.speed > 6 ? '#ffaa00' : '#44ff44';
    ctx.fillRect(barX, barY, speedPercent * 70, 10);

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, 70, 10);

    ctx.fillStyle = viewCar.color;
    ctx.font = 'bold 13px Arial';
    ctx.fillText(`${viewCar.name}: ${Math.floor(viewCar.score)}m`, barX, barY + 26);

    // Show position in race
    const sortedByPosition = Object.values(cars).filter(c => c.alive).sort((a, b) => a.worldY - b.worldY);
    const position = sortedByPosition.findIndex(c => c === viewCar) + 1;
    if (position > 0) {
      ctx.fillStyle = position === 1 ? '#ffd700' : '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`#${position}`, offsetX + viewportWidth - 10, 22);
      ctx.textAlign = 'left';
    }

    if (!viewCar.alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(offsetX, 0, viewportWidth, VIEWPORT_HEIGHT);

      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('💥 CRASHED!', offsetX + viewportWidth / 2, VIEWPORT_HEIGHT / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.fillText(`Final: ${Math.floor(viewCar.score)}m`, offsetX + viewportWidth / 2, VIEWPORT_HEIGHT / 2 + 20);
      ctx.textAlign = 'left';
    }

    ctx.restore();

    // Viewport divider
    if (viewportIndex > 0) {
      ctx.fillStyle = '#000';
      ctx.fillRect(offsetX - 2, 0, 4, VIEWPORT_HEIGHT);
    }
  }

  function update() {
    gameTime += 1 / 60;

    // Spawn traffic
    spawnTimer++;
    if (spawnTimer > Math.max(25, 50 - gameTime * 0.3)) {
      spawnTraffic();
      spawnTimer = 0;
    }

    // Update traffic (moves forward at its own speed)
    trafficCars.forEach(traffic => {
      traffic.worldY -= traffic.speed;
    });

    // Remove far-away traffic
    const aliveCars = Object.values(cars).filter(c => c.alive);
    if (aliveCars.length > 0) {
      const leadingY = Math.min(...aliveCars.map(c => c.worldY));
      const trailingY = Math.max(...aliveCars.map(c => c.worldY));
      trafficCars = trafficCars.filter(t =>
        t.worldY > leadingY - VIEWPORT_HEIGHT * 2 && t.worldY < trailingY + VIEWPORT_HEIGHT
      );
    }

    // Update players
    const carList = Object.values(cars);

    carList.forEach(car => {
      if (!car.alive) return;

      // Move forward based on speed
      car.worldY -= car.speed;

      // Natural speed decay to neutral (5)
      if (!car.gasPressed && !car.brakePressed) {
        if (car.speed > 5) car.speed = Math.max(car.speed - 0.02, 5);
        else if (car.speed < 5) car.speed = Math.min(car.speed + 0.02, 5);
      }
      car.gasPressed = false;
      car.brakePressed = false;

      // Score
      car.score += car.speed / 4;

      // Check collision with TRAFFIC (causes crash)
      trafficCars.forEach(traffic => {
        if (boxesOverlap(car.x, car.worldY, CAR_WIDTH, CAR_HEIGHT,
          traffic.x, traffic.worldY, CAR_WIDTH, CAR_HEIGHT)) {
          car.alive = false;
        }
      });
    });

    // Check player-to-player collisions (PUSH, don't crash)
    for (let i = 0; i < carList.length; i++) {
      for (let j = i + 1; j < carList.length; j++) {
        const car1 = carList[i];
        const car2 = carList[j];

        if (!car1.alive || !car2.alive) continue;

        if (boxesOverlap(car1.x, car1.worldY, CAR_WIDTH, CAR_HEIGHT,
          car2.x, car2.worldY, CAR_WIDTH, CAR_HEIGHT)) {
          // Calculate overlap
          const overlapX = Math.min(car1.x + CAR_WIDTH, car2.x + CAR_WIDTH) - Math.max(car1.x, car2.x);
          const overlapY = Math.min(car1.worldY + CAR_HEIGHT, car2.worldY + CAR_HEIGHT) - Math.max(car1.worldY, car2.worldY);

          // Push apart based on smaller overlap direction
          if (overlapX < overlapY) {
            // Horizontal push
            if (car1.x < car2.x) {
              car1.x -= overlapX / 2 + 2;
              car2.x += overlapX / 2 + 2;
            } else {
              car1.x += overlapX / 2 + 2;
              car2.x -= overlapX / 2 + 2;
            }
          } else {
            // Vertical push (in world Y)
            if (car1.worldY < car2.worldY) {
              car1.worldY -= overlapY / 2 + 1;
              car2.worldY += overlapY / 2 + 1;
            } else {
              car1.worldY += overlapY / 2 + 1;
              car2.worldY -= overlapY / 2 + 1;
            }
            // Also affect speeds a bit
            const avgSpeed = (car1.speed + car2.speed) / 2;
            car1.speed = avgSpeed;
            car2.speed = avgSpeed;
          }

          // Keep cars on road
          car1.x = Math.max(5, Math.min(ROAD_WIDTH - CAR_WIDTH - 5, car1.x));
          car2.x = Math.max(5, Math.min(ROAD_WIDTH - CAR_WIDTH - 5, car2.x));
        }
      }
    }

    // Game over when all crashed
    if (aliveCars.length === 0 && carList.length > 0) {
      gameOver = true;
    }
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('RACE OVER', c.width / 2, c.height / 2 - 80);

    ctx.font = '24px Arial';
    let yOffset = c.height / 2 - 30;

    const sortedCars = Object.values(cars).sort((a, b) => b.score - a.score);
    sortedCars.forEach((car, i) => {
      ctx.fillStyle = car.color;
      const medal = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      ctx.fillText(`${medal} ${car.name}: ${Math.floor(car.score)}m`, c.width / 2, yOffset);
      yOffset += 35;
    });

    ctx.fillStyle = '#888';
    ctx.font = '16px Arial';
    ctx.fillText('Admin can restart or exit', c.width / 2, yOffset + 20);
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⏸️ PAUSED', c.width / 2, c.height / 2);
    ctx.textAlign = 'left';
  }

  function loop() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, c.width, c.height);

    if (!gameOver && !paused) {
      update();
    }

    // Draw split screen viewports
    const playerList = Object.values(cars);
    const totalPlayers = playerList.length || 1;

    playerList.forEach((car, index) => {
      drawPlayerViewport(car, index, totalPlayers);
    });

    // Time display
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    ctx.fillText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, c.width / 2, c.height - 8);
    ctx.textAlign = 'left';

    if (paused) drawPaused();
    if (gameOver) drawGameOver();

    requestAnimationFrame(loop);
  }

  loop();
  return { input };
}