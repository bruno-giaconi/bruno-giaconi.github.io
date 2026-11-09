(() => {
  const stage = document.querySelector('.stage');
  const stageLabel = document.querySelector('#stage-label');
  const status = document.querySelector('#status');
  const views = [...document.querySelectorAll('[data-view]')];
  const finishes = [...document.querySelectorAll('button[data-finish]')];
  const state = { view: 'ensemble', finish: 'oak' };
  let scene;

  function update() {
    stage.dataset.floor = state.finish;
    for (const button of views) {
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
      button.disabled = !scene;
    }
    for (const button of finishes) {
      button.setAttribute('aria-pressed', String(button.dataset.finish === state.finish));
    }
    const viewLabel = views.find(button => button.dataset.view === state.view).textContent;
    const finishLabel = finishes.find(button => button.dataset.finish === state.finish).textContent;
    status.textContent = scene ? `${viewLabel} · ${finishLabel}` : `Aperçu 2D · ${finishLabel}`;
    stageLabel.textContent = scene ? viewLabel : 'Aperçu du plan';
    scene?.draw();
  }

  for (const button of views) {
    button.addEventListener('click', () => { state.view = button.dataset.view; update(); });
  }
  for (const button of finishes) {
    button.addEventListener('click', () => { state.finish = button.dataset.finish; update(); });
  }

  function buildScene(T) {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Visite 3D du salon et de la cuisine sur un plan fictif');

    const room = new T.Scene();
    room.background = new T.Color('#eef1f7');
    room.add(new T.HemisphereLight('#ffffff', '#939bb0', 2.1));
    const sun = new T.DirectionalLight('#fff2d6', 2.25);
    sun.position.set(2.5, 8.5, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
    sun.shadow.camera.right = sun.shadow.camera.top = 6;
    sun.shadow.normalBias = 0.025;
    room.add(sun);

    const standard = (color, roughness = .76) => new T.MeshStandardMaterial({ color, roughness });
    const palette = {
      walls: standard('#eee9df'), base: standard('#354765'), trim: standard('#e0d8c8'),
      cloth: standard('#5b6f97'), pillow: standard('#a8b7d4'), rug: standard('#d7caac'),
      wood: standard('#ac7750'), cabinet: standard('#506466'), stone: standard('#e6dcc7'),
      steel: standard('#52605c', .4), blue: standard('#88adb0'), soil: standard('#6f6450'),
      leaf: standard('#557e59'), lightLeaf: standard('#8a9b60'), background: standard('#e5e9f2')
    };
    const boxGeometry = new T.BoxGeometry();

    function box(material, width, height, depth, x, y, z) {
      const mesh = new T.Mesh(boxGeometry, material);
      mesh.scale.set(width, height, depth);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      room.add(mesh);
      return mesh;
    }

    function cylinder(material, radius, height, x, y, z) {
      const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, height, 24), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      room.add(mesh);
    }

    function surfaceTexture(name) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d');
      const base = { oak: '#bd8e62', terrazzo: '#bfb399', concrete: '#889894' };
      let seed = 19;
      function random() {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      }
      context.fillStyle = base[name];
      context.fillRect(0, 0, 256, 256);
      if (name === 'oak') {
        const grain = ['#bc8e65', '#ba8961', '#c4966b', '#c79973'];
        for (let row = 0; row < 8; row++) {
          const top = row * 32;
          context.fillStyle = grain[row % grain.length];
          context.fillRect(0, top + 1, 256, 31);
          context.fillStyle = '#a77953';
          context.fillRect(0, top, 256, 1);
          context.fillRect((row % 3 + 1) * 57, top, 1, 32);
        }
        for (let index = 0; index < 620; index++) {
          context.fillStyle = index % 2 ? '#75523216' : '#ffebc425';
          context.fillRect(random() * 256, random() * 256, 8 + random() * 22, 1);
        }
      } else {
        const flecks = name === 'terrazzo' ? ['#655e53', '#e1d8c1', '#9d776a'] : ['#cad1c638', '#54645c35'];
        const points = name === 'terrazzo' ? 300 : 500;
        for (let index = 0; index < points; index++) {
          context.fillStyle = flecks[index % flecks.length];
          context.beginPath();
          context.arc(random() * 256, random() * 256, .5 + random() * 1.75, 0, Math.PI * 2);
          context.fill();
        }
      }
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.repeat.set(3, 2);
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      return texture;
    }

    const floorMaterials = Object.fromEntries(finishes.map(({ dataset }) => {
      const material = standard('#ffffff');
      material.map = surfaceTexture(dataset.finish);
      return [dataset.finish, material];
    }));
    const floor = new T.Mesh(new T.PlaneGeometry(6.8, 5), floorMaterials.oak);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);

    box(palette.background, 60, .09, 60, 0, -.37, 0).castShadow = false;
    box(palette.base, 6.92, .2, 5.13, 0, -.11, 0);
    box(palette.walls, .15, 2.42, 5.05, -3.42, 1.21, 0);
    box(palette.walls, 2.14, 2.42, .16, 2.33, 1.21, -2.5);
    box(palette.walls, .88, 2.42, .16, -2.95, 1.21, -2.5);
    box(palette.walls, 1.04, 2.42, .16, .74, 1.21, -2.5);
    box(palette.walls, 2.73, .89, .16, -1.15, .445, -2.5);
    box(palette.walls, 2.73, .24, .16, -1.15, 2.30, -2.5);
    box(palette.trim, 2.86, .09, .24, -1.15, .91, -2.49);
    box(palette.trim, 2.86, .08, .18, -1.15, 2.15, -2.49);
    box(palette.trim, .07, 1.20, .16, -1.15, 1.55, -2.49);
    const glass = new T.MeshStandardMaterial({ color: '#88b9c2', roughness: .28, transparent: true, opacity: .28, depthWrite: false });
    box(glass, 2.68, 1.22, .02, -1.15, 1.55, -2.51).castShadow = false;

    box(palette.rug, 2.20, .021, 2.57, -1.45, .013, .06);
    box(palette.cloth, .92, .32, 2.52, -2.72, .26, .05);
    box(palette.cloth, .21, .51, 2.52, -3.08, .58, .05);
    for (const z of [-1.12, 1.22]) box(palette.cloth, .92, .37, .15, -2.72, .47, z);
    for (const z of [-.72, .05, .82]) {
      box(palette.pillow, .64, .13, .72, -2.63, .48, z);
      box(palette.pillow, .15, .35, .69, -2.92, .67, z).rotation.z = .14;
    }
    cylinder(palette.wood, .53, .08, -1.27, .43, .07);
    cylinder(palette.steel, .08, .36, -1.27, .23, .07);
    cylinder(palette.steel, .23, .04, -1.27, .027, .07);
    box(palette.stone, .26, .035, .18, -1.43, .487, .12).rotation.y = .22;

    for (const x of [.85, 1.53, 2.21, 2.89]) box(palette.cabinet, .655, .86, .64, x, .43, -2.10);
    box(palette.stone, 2.77, .085, .70, 1.87, .902, -2.09);
    box(palette.steel, .50, .015, .36, 2.48, .951, -2.10);
    box(palette.blue, .40, .020, .27, 2.48, .963, -2.10);
    for (const x of [1.10, 1.34]) cylinder(palette.steel, .09, .016, x, .955, -2.15);
    box(palette.wood, 1.69, .075, .92, 1.89, .77, .54);
    for (const x of [1.2, 2.58]) {
      for (const z of [.21, .87]) box(palette.steel, .075, .72, .075, x, .37, z);
    }
    for (const x of [1.51, 2.27]) {
      for (const [z, direction] of [[-.25, -1], [1.33, 1]]) {
        box(palette.cloth, .43, .07, .40, x, .45, z);
        box(palette.wood, .43, .42, .045, x, .66, z + direction * .17);
        box(palette.steel, .30, .40, .042, x, .23, z);
        box(palette.steel, .044, .40, .29, x, .23, z);
      }
    }

    cylinder(palette.soil, .21, .32, -2.85, .16, -1.72);
    cylinder(palette.leaf, .025, .47, -2.85, .51, -1.72);
    for (let index = 0; index < 7; index++) {
      const angle = index * 2.4;
      const leaf = new T.Mesh(new T.SphereGeometry(1, 12, 8), index % 2 ? palette.leaf : palette.lightLeaf);
      leaf.scale.set(.075, .19, .055);
      leaf.position.set(-2.85 + Math.cos(angle) * .17, .52 + index * .04, -1.72 + Math.sin(angle) * .17);
      leaf.rotation.set(Math.sin(angle) * .63, 0, Math.cos(angle) * .63);
      leaf.castShadow = true;
      room.add(leaf);
    }

    const overview = new T.OrthographicCamera(-1, 1, 1, -1, .1, 80);
    overview.position.set(8.4, 7.3, 10.2);
    overview.lookAt(0, .65, -.1);
    const plan = new T.OrthographicCamera(-1, 1, 1, -1, .1, 80);
    plan.position.set(0, 12, 0);
    plan.up.set(0, 0, -1);
    plan.lookAt(0, 0, 0);
    const interior = new T.PerspectiveCamera(56, 1, .1, 80);
    interior.position.set(2.75, 1.62, 4.25);
    interior.lookAt(-.35, 1.02, -.72);
    const cameras = { ensemble: overview, plan, interieur: interior };

    function draw() {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      renderer.setSize(width, height, false);
      for (const [camera, minHeight, minWidth] of [[overview, 3.9, 4.65], [plan, 3, 3.9]]) {
        const halfHeight = Math.max(minHeight, minWidth / aspect);
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
      }
      interior.aspect = aspect;
      interior.fov = aspect < 1 ? 65 : 56;
      interior.updateProjectionMatrix();
      floor.material = floorMaterials[state.finish];
      renderer.render(room, cameras[state.view]);
    }

    renderer.domElement.addEventListener('webglcontextlost', () => {
      stage.dataset.mode = 'fallback';
      scene = undefined;
      update();
    });
    stage.prepend(renderer.domElement);
    new ResizeObserver(() => scene?.draw()).observe(stage);
    return { draw };
  }

  try {
    scene = buildScene(window.THREE);
    stage.dataset.mode = 'webgl';
    update();
  } catch {
    stage.dataset.mode = 'fallback';
    scene = undefined;
    update();
  }
})();
