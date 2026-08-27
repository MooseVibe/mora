import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const isMobile = () => window.innerWidth <= 720;
const cardGap = 0.023;
const restingDeckTilt = isMobile() ? 0.32 : 0.4;
const restingDeckPositionZ = 1.15;
const restingDeckPositionY = 0;
const hoverFanRadius = 1.85;
const hoverFanSpan = 0.045;
const fanGroupScale = 1.2947;
const fanDesktopSideGutter = 48;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeInOut = (value) => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};
const easeOut = (value) => 1 - (1 - clamp01(value)) ** 4;

function tween(duration, update) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    function tick(now) {
      const progress = clamp01((now - startedAt) / duration);
      update(progress);
      if (progress < 1) window.requestAnimationFrame(tick);
      else resolve();
    }
    window.requestAnimationFrame(tick);
  });
}

function moveObjects(items, targets, duration) {
  const starts = items.map((item) => ({
    position: item.position.clone(),
    quaternion: item.quaternion.clone(),
    scale: item.scale.clone(),
  }));
  return tween(duration, (rawProgress) => {
    const progress = easeInOut(rawProgress);
    items.forEach((item, index) => {
      const target = targets[index];
      item.position.lerpVectors(starts[index].position, target.position, progress);
      item.quaternion.slerpQuaternions(starts[index].quaternion, target.quaternion, progress);
      item.scale.lerpVectors(starts[index].scale, target.scale, progress);
    });
  });
}

async function loadBackTexture(renderer) {
  const texture = await new THREE.TextureLoader().loadAsync(
    new URL("/assets/3d/mora-card-back.webp", import.meta.url).href,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function createMaterials(backTexture) {
  const frameColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--result-card-frame-surface").trim() || "#343434";
  return {
    face: new THREE.MeshBasicMaterial({
      color: 0x242323,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    back: new THREE.MeshBasicMaterial({
      map: backTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    body: new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.38,
      metalness: 0.06,
    }),
    border: new THREE.MeshBasicMaterial({
      color: frameColor,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  };
}

function loadFaceTexture(renderer, path) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(path, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      resolve(texture);
    }, undefined, reject);
  });
}

function applyFaceTexture(card, texture) {
  card.traverse((object) => {
    if (!object.isMesh || !object.name.toLowerCase().endsWith("_front")) return;
    const material = object.material.clone();
    material.map = texture;
    material.color.set(0xffffff);
    material.toneMapped = false;
    material.needsUpdate = true;
    object.material = material;
  });
}

function fitTextureCover(card, texture, targetAspect) {
  const sourceWidth = texture.image?.naturalWidth || texture.image?.width;
  const sourceHeight = texture.image?.naturalHeight || texture.image?.height;
  if (!sourceWidth || !sourceHeight || !targetAspect) return;

  const uvMin = new THREE.Vector2(1, 1);
  const uvMax = new THREE.Vector2(0, 0);
  card.traverse((object) => {
    if (!object.isMesh || !object.name.toLowerCase().endsWith("_front")) return;
    const uv = object.geometry.attributes.uv;
    for (let index = 0; index < uv.count; index += 1) {
      uvMin.min(new THREE.Vector2(uv.getX(index), uv.getY(index)));
      uvMax.max(new THREE.Vector2(uv.getX(index), uv.getY(index)));
    }
  });

  const sourceAspect = sourceWidth / sourceHeight;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  if (sourceAspect > targetAspect) {
    const visibleSpan = targetAspect / sourceAspect;
    texture.repeat.x = visibleSpan / (uvMax.x - uvMin.x);
    texture.offset.x = (1 - visibleSpan) / 2 - uvMin.x * texture.repeat.x;
  } else {
    const visibleSpan = sourceAspect / targetAspect;
    texture.repeat.y = visibleSpan / (uvMax.y - uvMin.y);
    texture.offset.y = (1 - visibleSpan) / 2 - uvMin.y * texture.repeat.y;
  }
  texture.needsUpdate = true;
}

function applyMaterials(root, materials) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const name = object.name.toLowerCase();
    if (name.endsWith("_frontborder") || name.endsWith("_backborder")) {
      object.material = materials.border;
    } else if (name.endsWith("_front")) {
      object.material = materials.face;
    } else if (name.endsWith("_back")) {
      object.material = materials.back;
    } else {
      object.material = materials.body;
    }
    object.castShadow = false;
    object.receiveShadow = false;
  });
}

function createResultShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  context.filter = "blur(18px)";
  context.fillStyle = "rgba(0, 0, 0, 0.72)";
  context.roundRect(34, 30, 188, 324, 24);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function prepareFadeMaterials(list) {
  const fadeMaterials = [];
  list.forEach((card) => {
    card.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const independentMaterials = materials.map((material) => {
        const independentMaterial = material.clone();
        independentMaterial.transparent = false;
        independentMaterial.opacity = 1;
        independentMaterial.depthWrite = true;
        independentMaterial.needsUpdate = true;
        fadeMaterials.push(independentMaterial);
        return independentMaterial;
      });
      object.material = Array.isArray(object.material) ? independentMaterials : independentMaterials[0];
    });
  });
  return fadeMaterials;
}

function stackTargets(cards) {
  return cards.map((card, index) => ({
    position: new THREE.Vector3(0, 0.08 + index * cardGap, 0),
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
    scale: new THREE.Vector3(0.86, 0.86, 0.86),
  }));
}

export async function mountDailyDeck3D({ canvas, host, onPrepare, onSelect, onResult }) {
  if (!canvas || !host) throw new Error("Daily 3D deck host is missing");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene.add(new THREE.HemisphereLight(0xded6ce, 0x151519, 1.55));

  const key = new THREE.DirectionalLight(0xffe7d2, 3.1);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9cb8df, 1.25);
  rim.position.set(5, 4, -4);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 18),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.18 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const resultShadowMaterial = new THREE.SpriteMaterial({
    map: createResultShadowTexture(),
    color: 0x000000,
    opacity: 0.28,
    transparent: true,
    depthWrite: false,
  });
  const resultShadow = new THREE.Sprite(resultShadowMaterial);
  resultShadow.visible = false;
  resultShadow.renderOrder = -1;
  scene.add(resultShadow);

  const deckGroup = new THREE.Group();
  const idleDeckPosition = new THREE.Vector3(0, restingDeckPositionY, restingDeckPositionZ);
  let deckViewportScale = 1;
  let fanViewportScale = 1;
  let fanGroupPositionX = -0.35;
  let embeddedDeckScale = isMobile() ? 1.2 : 1.12;
  const setIdleDeckScale = (factor = 1) => {
    const scale = embeddedDeckScale * factor;
    if (isMobile()) deckGroup.scale.set(scale * 0.9, scale, scale);
    else deckGroup.scale.setScalar(scale);
  };
  deckGroup.rotation.set(restingDeckTilt, 0, 0);
  deckGroup.position.copy(idleDeckPosition);
  setIdleDeckScale();
  scene.add(deckGroup);

  const initialSelection = onPrepare?.() || null;
  const loader = new GLTFLoader();
  const deckTemplatePromise = loader.loadAsync("/assets/3d/mora-card.glb?v=20260821-stripface1");
  const backTexturePromise = loadBackTexture(renderer);
  const initialFaceTexturePromise = initialSelection?.imageUrl
    ? loadFaceTexture(renderer, initialSelection.imageUrl)
    : null;
  const [gltf, backTexture] = await Promise.all([deckTemplatePromise, backTexturePromise]);
  const materials = createMaterials(backTexture);
  const template = gltf.scene;
  applyMaterials(template, materials);
  const bounds = new THREE.Box3().setFromObject(template);
  const size = bounds.getSize(new THREE.Vector3());
  template.scale.setScalar(3.55 / Math.max(size.x, size.z));
  template.updateMatrixWorld(true);
  let resultTemplatePromise;
  let resultTemplateMetrics;
  function loadResultTemplate() {
    resultTemplatePromise ||= loader.loadAsync("/assets/3d/mora-card-result.glb?v=20260821-stripface1").then((resultGltf) => {
      const resultTemplate = resultGltf.scene;
      applyMaterials(resultTemplate, materials);
      const resultBounds = new THREE.Box3().setFromObject(resultTemplate);
      const resultSize = resultBounds.getSize(new THREE.Vector3());
      resultTemplateMetrics = {
        center: resultBounds.getCenter(new THREE.Vector3()),
        size: resultSize.clone(),
      };
      resultTemplate.scale.setScalar(3.55 / Math.max(resultSize.x, resultSize.z));
      resultTemplate.updateMatrixWorld(true);
      return resultTemplate;
    });
    return resultTemplatePromise;
  }

  const cards = [];
  const cardCount = isMobile() ? 22 : 30;
  for (let index = 0; index < cardCount; index += 1) {
    const card = template.clone(true);
    card.userData.isMoraCard = true;
    deckGroup.add(card);
    cards.push(card);
  }

  const targets = stackTargets(cards);
  cards.forEach((card, index) => {
    card.position.copy(targets[index].position);
    card.quaternion.copy(targets[index].quaternion);
    card.scale.copy(targets[index].scale);
  });
  cards.at(-1)?.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });

  let hovered = false;
  let hoveredCard = null;
  let resultCard = null;
  let resultHovered = false;
  let preparedSelection = initialSelection;
  let preparedFaceTexture = initialFaceTexturePromise?.then((texture) => {
    renderer.initTexture(texture);
    return texture;
  }) || null;
  let preparedImageUrl = initialSelection?.imageUrl || "";
  let hoverAmount = 0;
  let ritualState = "idle";
  let frameId;
  let renderingActive = true;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const resultPressPoint = new THREE.Vector2();
  const idleDeckHitBox = new THREE.Box3();

  function alignMobileIdleDeck(rect) {
    if (!isMobile() || ritualState !== "idle") return;
    const heading = host.closest(".daily-card-screen")?.querySelector(".daily-card-heading");
    if (!heading) return;
    const header = document.querySelector(".header");
    heading.style.setProperty("--daily-idle-balance-shift", "0px");

    deckGroup.position.set(0, restingDeckPositionY, restingDeckPositionZ);
    deckGroup.updateWorldMatrix(true, true);
    camera.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(deckGroup);
    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ];
    const projectedY = corners.map((corner) => {
      corner.project(camera);
      return rect.top + (1 - corner.y) * rect.height / 2;
    });
    const actualTop = Math.min(...projectedY);
    const deckHeight = Math.max(...projectedY) - actualTop;
    const headingRect = heading.getBoundingClientRect();
    const availableTop = header?.getBoundingClientRect().bottom || rect.top;
    const compositionHeight = headingRect.height + 32 + deckHeight;
    const balanceShift = Math.max(0, (rect.bottom - availableTop - compositionHeight) / 2)
      + availableTop - headingRect.top;
    heading.style.setProperty("--daily-idle-balance-shift", `${balanceShift}px`);
    const desiredTop = heading.getBoundingClientRect().bottom + 32;
    const depth = deckGroup.position.distanceTo(camera.position);
    const visibleWorldHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const pixelsPerWorldUnit = rect.height / visibleWorldHeight;
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    deckGroup.position.addScaledVector(cameraUp, -(desiredTop - actualTop) / pixelsPerWorldUnit);
    idleDeckPosition.copy(deckGroup.position);
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    if (isMobile()) {
      deckViewportScale = 1;
      fanViewportScale = 1;
      fanGroupPositionX = -0.35;
      embeddedDeckScale = 1.2 * THREE.MathUtils.clamp(821 / rect.height, 0.9, 1.15);
      camera.position.set(0, 7.6, 10.6);
      camera.fov = 38;
      camera.lookAt(0, 0.2, 0.6);
    } else {
      deckViewportScale = THREE.MathUtils.clamp(rect.width / 1440, 0.76, 1);
      const deckHeightScale = THREE.MathUtils.clamp(rect.height / 500, 0.86, 1);
      fanViewportScale = THREE.MathUtils.clamp(
        (rect.width - fanDesktopSideGutter * 2) / (1440 - fanDesktopSideGutter * 2),
        0.68,
        1,
      );
      fanGroupPositionX = -0.35 * clamp01((rect.width - 1024) / (1440 - 1024));
      embeddedDeckScale = 1.12 * deckViewportScale * deckHeightScale;
      camera.position.set(0, 7.1, 10.2);
      camera.fov = 34;
      camera.lookAt(0, 0.35, 0.45);
    }
    camera.updateProjectionMatrix();
    if (ritualState === "idle") {
      setIdleDeckScale();
      deckGroup.rotation.set(restingDeckTilt, 0, 0);
      alignMobileIdleDeck(rect);
    }
    if (ritualState === "fan") {
      deckGroup.position.x = fanGroupPositionX;
      deckGroup.scale.setScalar(fanGroupScale * fanViewportScale);
    }
    if (ritualState === "result" && resultCard) {
      const target = resultTarget();
      resultCard.position.copy(target.position);
      resultCard.quaternion.copy(target.quaternion);
      resultCard.scale.copy(target.scale);
      resultCard.userData.resultTarget = target;
      placeResultShadow(target);
    }
    ensureRendering();
  }

  function render() {
    if (!renderingActive) {
      frameId = null;
      return;
    }
    if (ritualState === "idle") {
      hoverAmount += ((hovered ? 1 : 0) - hoverAmount) * 0.14;
      deckGroup.position.copy(idleDeckPosition);
      deckGroup.position.y += hoverAmount * 0.05;
      deckGroup.position.z += hoverAmount * 0.02;
      setIdleDeckScale(1 + hoverAmount * 0.006);

      cards.forEach((card, index) => {
        const target = targets[index];
        const normalized = cards.length === 1 ? 0 : index / (cards.length - 1) - 0.5;
        const angle = normalized * hoverFanSpan;
        card.position.copy(target.position);
        card.position.x += Math.sin(angle) * hoverFanRadius * hoverAmount;
        card.position.z += (Math.cos(angle) - 1) * hoverFanRadius * hoverAmount;
        card.quaternion.setFromEuler(new THREE.Euler(Math.PI, angle * hoverAmount, 0));
        card.scale.copy(target.scale);
      });
    }
    if (ritualState === "fan") {
      cards.forEach((card) => {
        const target = card.userData.fanTarget;
        if (!target) return;
        const desiredHover = card === hoveredCard ? 1 : 0;
        card.userData.hoverAmount += (desiredHover - card.userData.hoverAmount) * 0.16;
        card.position.copy(target.position);
        card.position.addScaledVector(target.hoverDirection, card.userData.hoverAmount * 0.09);
        card.quaternion.copy(target.quaternion);
        card.scale.copy(target.scale);
      });
    }
    if (ritualState === "result" && resultCard?.userData.resultTarget) {
      const target = resultCard.userData.resultTarget;
      const pressTilt = resultHovered
        ? new THREE.Quaternion().setFromEuler(new THREE.Euler(
          resultPressPoint.y * 0.055,
          -resultPressPoint.x * 0.055,
          0,
        ))
        : new THREE.Quaternion();
      const desiredQuaternion = target.quaternion.clone().multiply(pressTilt);
      resultCard.position.copy(target.position);
      resultCard.quaternion.slerp(desiredQuaternion, 0.12);
      resultCard.scale.copy(target.scale);
    }

    renderer.render(scene, camera);
    const hoverSettling = ritualState === "idle"
      ? Math.abs((hovered ? 1 : 0) - hoverAmount) > 0.002
      : ritualState === "fan"
        ? cards.some((card) => Math.abs((card === hoveredCard ? 1 : 0) - card.userData.hoverAmount) > 0.002)
        : true;
    frameId = hoverSettling ? window.requestAnimationFrame(render) : null;
  }

  function ensureRendering() {
    if (renderingActive && !frameId) frameId = window.requestAnimationFrame(render);
  }

  function prepareResultAssets(selection = onPrepare?.()) {
    if (!selection?.imageUrl) return Promise.resolve();
    if (preparedImageUrl === selection.imageUrl && preparedFaceTexture) {
      return Promise.all([loadResultTemplate(), preparedFaceTexture]);
    }

    preparedSelection = selection;
    preparedImageUrl = selection.imageUrl;
    preparedFaceTexture = loadFaceTexture(renderer, selection.imageUrl).then((texture) => {
      renderer.initTexture(texture);
      return texture;
    });
    return Promise.all([loadResultTemplate(), preparedFaceTexture]);
  }

  function handlePointerMove(event) {
    if (isMobile()) {
      hovered = false;
      hoveredCard = null;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (ritualState === "fan") {
      const intersection = raycaster.intersectObjects(cards, true)[0];
      hoveredCard = intersection ? cardFromIntersection(intersection.object) : null;
      ensureRendering();
      return;
    }
    hoveredCard = null;
    const exactHit = raycaster.intersectObjects(cards, true).length > 0;
    if (ritualState === "idle" && !exactHit) {
      deckGroup.updateWorldMatrix(true, true);
      idleDeckHitBox.setFromObject(cards.at(-1));
      hovered = raycaster.ray.intersectsBox(idleDeckHitBox);
    } else {
      hovered = exactHit;
    }
    ensureRendering();
  }

  function handlePointerLeave() {
    hovered = false;
    hoveredCard = null;
    ensureRendering();
  }

  function handleResultPointerMove(event) {
    if (ritualState !== "result" || !resultCard) {
      resultHovered = false;
      host.classList.remove("is-result-card-hovered");
      return;
    }
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersection = raycaster.intersectObject(resultCard, true)[0];
    resultHovered = Boolean(intersection);
    host.classList.toggle("is-result-card-hovered", resultHovered);
    if (intersection?.uv) {
      resultPressPoint.set(
        (intersection.uv.x - 0.5) * 2,
        (intersection.uv.y - 0.5) * 2,
      );
    } else {
      resultPressPoint.set(0, 0);
    }
    ensureRendering();
  }

  function cardFromIntersection(object) {
    let current = object;
    while (current && current !== deckGroup) {
      if (current.userData.isMoraCard) return current;
      current = current.parent;
    }
    return null;
  }

  async function performCleanCut() {
    const splitIndex = Math.floor(cards.length * 0.58);
    const lowerPacket = cards.slice(0, splitIndex);
    const upperPacket = cards.slice(splitIndex);
    const sideOffset = 2.7;
    const reordered = [...upperPacket, ...lowerPacket];
    const finalTargets = stackTargets(reordered);
    const upperStarts = upperPacket.map((card) => ({
      position: card.position.clone(),
      quaternion: card.quaternion.clone(),
    }));
    const lowerStarts = lowerPacket.map((card) => ({
      position: card.position.clone(),
      quaternion: card.quaternion.clone(),
    }));
    const groupStart = deckGroup.quaternion.clone();
    const groupPeak = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.065, 0.13, -0.035));
    const groupEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, -0.025, 0.01));
    const upperPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(sideOffset * 0.22, 0.38, -0.03),
      new THREE.Vector3(sideOffset * 0.72, 0.56, -0.1),
      new THREE.Vector3(sideOffset, 0.24, -0.13),
      new THREE.Vector3(sideOffset * 0.82, 0.02, -0.1),
      new THREE.Vector3(0, 0, 0),
    ], false, "centripetal");

    await tween(1050, (progress) => {
      const pathProgress = 1 - (1 - progress) ** 1.35;
      const pathOffset = upperPath.getPoint(pathProgress);
      const upperSettle = easeInOut(Math.max(0, (progress - 0.4) / 0.6));
      const lowerRise = progress < 0.36
        ? 0
        : progress < 0.58
          ? easeOut((progress - 0.36) / 0.22)
          : progress < 0.78
            ? 1
            : 1 - easeInOut((progress - 0.78) / 0.22);
      const lowerReorder = easeInOut(Math.max(0, (progress - 0.44) / 0.56));

      upperPacket.forEach((card, index) => {
        const finalTarget = finalTargets[index];
        card.position.copy(upperStarts[index].position).lerp(finalTarget.position, upperSettle);
        card.position.add(pathOffset);
        card.quaternion.slerpQuaternions(upperStarts[index].quaternion, finalTarget.quaternion, upperSettle);
      });
      lowerPacket.forEach((card, index) => {
        const finalTarget = finalTargets[upperPacket.length + index];
        card.position.copy(lowerStarts[index].position).lerp(finalTarget.position, lowerReorder);
        card.position.y += lowerRise * 0.54;
        card.quaternion.slerpQuaternions(lowerStarts[index].quaternion, finalTarget.quaternion, lowerReorder);
      });
      if (progress < 0.54) {
        deckGroup.quaternion.slerpQuaternions(groupStart, groupPeak, easeInOut(progress / 0.54));
      } else {
        deckGroup.quaternion.slerpQuaternions(groupPeak, groupEnd, easeInOut((progress - 0.54) / 0.46));
      }
    });

    cards.splice(0, cards.length, ...reordered);
    cards.forEach((card, index) => {
      card.position.copy(finalTargets[index].position);
      card.quaternion.copy(finalTargets[index].quaternion);
      card.scale.copy(finalTargets[index].scale);
    });
  }

  function fanTargets() {
    const fanScale = 0.62;
    const radius = 6.42;
    const maxAngle = 0.68;
    const arcCenterZ = 0.42;
    const verticalArcRise = 0.72;
    const layerGap = 0.018;
    const middleIndex = (cards.length - 1) / 2;
    const fanGroupQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.025, 0, 0));
    const layerDirection = camera.getWorldDirection(new THREE.Vector3())
      .negate()
      .applyQuaternion(fanGroupQuaternion.invert())
      .normalize();
    const result = cards.map((card, index) => {
      const normalized = index / (cards.length - 1) - 0.5;
      const angle = normalized * maxAngle * 2;
      return {
        position: new THREE.Vector3(
          Math.sin(angle) * radius,
          -0.38 + (normalized * 2) ** 2 * verticalArcRise,
          arcCenterZ - (1 - Math.cos(angle)) * radius,
        ),
        quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI + 0.1, -angle, 0)),
        scale: new THREE.Vector3(fanScale, fanScale, fanScale),
        hoverDirection: new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle))
          .applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)))
          .normalize(),
      };
    });

    const layerOffsets = [0];
    for (let index = 1; index < result.length; index += 1) {
      const previousNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(result[index - 1].quaternion);
      const currentNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(result[index].quaternion);
      const separationNormal = previousNormal.add(currentNormal).normalize();
      const directionProjection = layerDirection.dot(separationNormal);
      const baseSeparation = result[index].position.clone().sub(result[index - 1].position).dot(separationNormal);
      const layerOffset = (Math.sign(directionProjection || -1) * layerGap - baseSeparation) / directionProjection;
      result[index].position.addScaledVector(layerDirection, layerOffset);
      layerOffsets.push(layerOffset);
    }
    const centerOffset = (layerOffsets[Math.floor(middleIndex)] + layerOffsets[Math.ceil(middleIndex)]) / 2;
    result.forEach((target) => target.position.addScaledVector(layerDirection, -centerOffset));
    return result;
  }

  async function beginMobileRitual() {
    ritualState = "mobile-drawing";
    ensureRendering();
    hovered = false;
    floor.visible = false;
    document.body.classList.add("daily-3d-ritual", "daily-3d-animating");

    const selection = onSelect?.() || preparedSelection;
    if (!selection?.imageUrl) {
      ritualState = "idle";
      document.body.classList.remove("daily-3d-ritual", "daily-3d-animating");
      return;
    }
    const chosenCard = cards.at(-1);
    const remainingCards = cards.slice(0, -1);
    const resultTemplatePromise = loadResultTemplate();
    const faceTexturePromise = (preparedFaceTexture || loadFaceTexture(renderer, selection.imageUrl));
    const groupStart = {
      position: deckGroup.position.clone(),
      quaternion: deckGroup.quaternion.clone(),
      scale: deckGroup.scale.clone(),
    };
    const frontQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(1, 0, 0));
    const compactPositions = cards.map((card, index) => ({
      start: card.position.clone(),
      end: new THREE.Vector3(card.position.x, 0.08 + index * 0.0015, card.position.z),
    }));

    await tween(reducedMotion ? 1 : 440, (rawProgress) => {
      const progress = easeInOut(rawProgress);
      deckGroup.quaternion.slerpQuaternions(groupStart.quaternion, frontQuaternion, progress);
      deckGroup.position.lerpVectors(
        groupStart.position,
        groupStart.position.clone().add(new THREE.Vector3(0, -0.04, -0.1)),
        progress,
      );
      cards.forEach((card, index) => {
        card.position.lerpVectors(compactPositions[index].start, compactPositions[index].end, progress);
      });
    });

    deckGroup.updateWorldMatrix(true, true);
    scene.attach(chosenCard);
    const fadeMaterials = prepareFadeMaterials(remainingCards);
    const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    const chosenStart = chosenCard.position.clone();
    const chosenClear = chosenStart.clone().addScaledVector(screenUp, 2.9);
    const deckStart = deckGroup.position.clone();
    const deckExit = deckStart.clone().addScaledVector(screenUp, -3.4);

    await tween(reducedMotion ? 1 : 720, (rawProgress) => {
      const movement = easeInOut(rawProgress);
      const fade = easeInOut(clamp01((rawProgress - 0.18) / 0.82));
      chosenCard.position.lerpVectors(chosenStart, chosenClear, movement);
      deckGroup.position.lerpVectors(deckStart, deckExit, movement);
      fadeMaterials.forEach((material) => {
        if (fade > 0 && !material.transparent) {
          material.transparent = true;
          material.depthWrite = false;
          material.needsUpdate = true;
        }
        material.opacity = 1 - fade;
      });
    });
    deckGroup.visible = false;

    const resultTemplate = await resultTemplatePromise;
    const resultModel = resultTemplate.clone(true);
    resultModel.visible = false;
    scene.add(resultModel);
    const faceTexture = await faceTexturePromise;
    applyFaceTexture(resultModel, faceTexture);
    preparedSelection = null;
    preparedFaceTexture = null;
    preparedImageUrl = "";

    document.body.classList.add("daily-3d-handoff");
    const finalTarget = resultTarget();
    const faceSlot = document.querySelector("#daily-result-image")?.getBoundingClientRect();
    if (faceSlot?.width && faceSlot?.height) {
      fitTextureCover(resultModel, faceTexture, faceSlot.width / faceSlot.height);
    }
    const viewportCenter = camera.localToWorld(new THREE.Vector3(0, -0.17, -8.2));
    const centerScale = finalTarget.scale.clone().multiplyScalar(1.08);
    const centerStart = {
      position: chosenCard.position.clone(),
      quaternion: chosenCard.quaternion.clone(),
      scale: chosenCard.scale.clone(),
    };
    chosenCard.position.copy(viewportCenter);
    chosenCard.scale.copy(centerScale);
    chosenCard.updateWorldMatrix(true, true);
    const centerPosition = viewportCenter.clone().add(
      viewportCenter.clone().sub(new THREE.Box3().setFromObject(chosenCard).getCenter(new THREE.Vector3())),
    );
    chosenCard.position.copy(centerStart.position);
    chosenCard.scale.copy(centerStart.scale);

    await tween(reducedMotion ? 1 : 520, (rawProgress) => {
      const progress = easeInOut(rawProgress);
      chosenCard.position.lerpVectors(centerStart.position, centerPosition, progress);
      chosenCard.quaternion.copy(centerStart.quaternion);
      chosenCard.scale.lerpVectors(centerStart.scale, centerScale, progress);
    });

    const flipStartQuaternion = chosenCard.quaternion.clone();
    const keepVisuallyCentered = (object) => {
      object.updateWorldMatrix(true, true);
      const visualCenter = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
      object.position.add(viewportCenter.clone().sub(visualCenter));
    };
    await tween(reducedMotion ? 1 : 640, (rawProgress) => {
      const progress = easeInOut(rawProgress);
      const quaternion = new THREE.Quaternion().slerpQuaternions(
        flipStartQuaternion,
        finalTarget.quaternion,
        progress,
      );
      if (rawProgress < 0.5) {
        chosenCard.quaternion.copy(quaternion);
        keepVisuallyCentered(chosenCard);
      } else {
        if (!resultModel.visible) {
          chosenCard.visible = false;
          resultModel.visible = true;
          resultModel.position.copy(viewportCenter);
          resultModel.scale.copy(centerScale);
        }
        resultModel.quaternion.copy(quaternion);
        keepVisuallyCentered(resultModel);
      }
    });

    resultModel.quaternion.copy(finalTarget.quaternion);
    keepVisuallyCentered(resultModel);
    const resultStart = {
      position: resultModel.position.clone(),
      quaternion: resultModel.quaternion.clone(),
      scale: resultModel.scale.clone(),
    };
    const resultPath = new THREE.CatmullRomCurve3([
      resultStart.position,
      resultStart.position.clone().lerp(finalTarget.position, 0.58)
        .addScaledVector(screenUp, 0.16),
      finalTarget.position,
    ], false, "centripetal");

    await tween(reducedMotion ? 1 : 520, (rawProgress) => {
      const movement = easeOut(rawProgress);
      const settle = easeInOut(rawProgress);
      resultModel.position.copy(resultPath.getPointAt(movement));
      resultModel.quaternion.slerpQuaternions(
        resultStart.quaternion,
        finalTarget.quaternion,
        settle,
      );
      resultModel.scale.lerpVectors(resultStart.scale, finalTarget.scale, settle);
    });

    resultModel.position.copy(finalTarget.position);
    resultModel.quaternion.copy(finalTarget.quaternion);
    resultModel.scale.copy(finalTarget.scale);
    placeResultShadow(finalTarget);
    renderer.render(scene, camera);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    resultModel.userData.resultTarget = {
      position: finalTarget.position.clone(),
      quaternion: finalTarget.quaternion.clone(),
      scale: finalTarget.scale.clone(),
    };
    resultCard = resultModel;
    ritualState = "result";
    document.body.classList.remove("daily-3d-handoff");
    onResult?.(selection);
  }

  async function beginRitual() {
    if (ritualState !== "idle") return;
    prepareResultAssets();
    if (isMobile()) {
      await beginMobileRitual();
      return;
    }
    ritualState = "cutting";
    ensureRendering();
    hovered = false;
    document.body.classList.add("daily-3d-ritual", "daily-3d-animating");
    if (!reducedMotion) await performCleanCut();

    floor.visible = false;
    cards.forEach((card) => card.traverse((object) => {
      if (object.isMesh) object.castShadow = false;
    }));
    const fan = fanTargets();
    const groupTarget = [{
      position: new THREE.Vector3(fanGroupPositionX, 0, 0.6),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.025, 0, 0)),
      scale: new THREE.Vector3().setScalar(fanGroupScale * fanViewportScale),
    }];
    await Promise.all([
      moveObjects(cards, fan, reducedMotion ? 1 : 720),
      moveObjects([deckGroup], groupTarget, reducedMotion ? 1 : 720),
    ]);
    cards.forEach((card, index) => {
      card.userData.fanTarget = fan[index];
      card.userData.hoverAmount = 0;
    });
    ritualState = "fan";
    const heading = host.closest(".daily-card-screen")?.querySelector(".daily-card-heading");
    if (heading) {
      heading.querySelector("h1").textContent = "Выбери карту";
      heading.querySelector("p").textContent = "Нажми на любую карту в веере";
    }
    document.body.classList.remove("daily-3d-animating");
  }

  function resultPose() {
    camera.updateMatrixWorld(true);
    const localPosition = isMobile()
      ? new THREE.Vector3(0, 0.84, -8.2)
      : new THREE.Vector3(2.28, 0.05, -8.2);
    const position = camera.localToWorld(localPosition);
    const faceCamera = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    return {
      position,
      quaternion: camera.quaternion.clone().multiply(faceCamera),
    };
  }

  function resultTarget() {
    const pose = resultPose();
    const fallbackScale = isMobile()
      ? new THREE.Vector3(0.67, 0.67, 0.74)
      : new THREE.Vector3(1.026, 1.026, 1.06685);
    if (!resultTemplateMetrics) return { ...pose, scale: fallbackScale };

    const slot = document.querySelector(".daily-result-card")?.getBoundingClientRect();
    const viewport = host.getBoundingClientRect();
    if (!slot?.width || !slot.height || !viewport.width || !viewport.height) {
      return { ...pose, scale: fallbackScale };
    }

    const depth = 8.2;
    const halfWorldHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth;
    const pixelsPerWorldUnit = viewport.height / (halfWorldHeight * 2);
    const slotCenterX = slot.left - viewport.left + slot.width / 2;
    const slotCenterY = slot.top - viewport.top + slot.height / 2;
    const ndcX = slotCenterX / viewport.width * 2 - 1;
    const ndcY = 1 - slotCenterY / viewport.height * 2;
    const scaleX = slot.width / resultTemplateMetrics.size.x / pixelsPerWorldUnit;
    const scaleZ = slot.height / resultTemplateMetrics.size.z / pixelsPerWorldUnit;
    const scale = new THREE.Vector3(scaleX, scaleX, scaleZ);
    const centerPosition = camera.localToWorld(new THREE.Vector3(
      ndcX * halfWorldHeight * camera.aspect,
      ndcY * halfWorldHeight,
      -depth,
    ));
    const centerOffset = resultTemplateMetrics.center.clone()
      .multiply(scale)
      .applyQuaternion(pose.quaternion);

    return {
      position: centerPosition.sub(centerOffset),
      quaternion: pose.quaternion,
      scale,
    };
  }

  function placeResultShadow(target) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const intoScene = camera.getWorldDirection(new THREE.Vector3());
    resultShadow.position.copy(target.position)
      .addScaledVector(right, 0.08)
      .addScaledVector(up, -0.1)
      .addScaledVector(intoScene, 0.14);
    resultShadow.scale.set(
      isMobile() ? 2.25 : 2.85 * (target.scale.x / 1.026),
      isMobile() ? 3.45 : 4.3225 * (target.scale.z / 1.06685),
      1,
    );
    resultShadow.visible = true;
  }

  async function drawCard(card) {
    if (ritualState !== "fan" || !card) return;
    const selection = onSelect?.() || preparedSelection;
    if (!selection?.imageUrl) return;
    const resultTemplate = await loadResultTemplate();
    const resultModel = resultTemplate.clone(true);
    resultModel.visible = false;
    scene.add(resultModel);
    ritualState = "drawing";
    ensureRendering();
    hoveredCard = null;
    document.body.classList.add("daily-3d-animating");

    const remainingCards = cards.filter((item) => item !== card);
    deckGroup.updateWorldMatrix(true, true);
    const fanPullDirection = (
      card.userData.fanTarget?.hoverDirection || new THREE.Vector3(0, 0, 1)
    ).clone();
    const fadeMaterials = prepareFadeMaterials(remainingCards);
    remainingCards.forEach((remainingCard) => {
      remainingCard.traverse((object) => {
        if (object.isMesh) object.castShadow = false;
      });
    });
    const localStart = card.position.clone();
    const localClearPoint = localStart.clone().addScaledVector(fanPullDirection, 2.3);
    const groupStart = deckGroup.position.clone();
    const fanPullWorldDirection = fanPullDirection.clone().transformDirection(deckGroup.matrixWorld);
    const groupRetreatTarget = groupStart.clone().addScaledVector(fanPullWorldDirection, -0.8);
    const faceTexturePromise = (preparedFaceTexture || loadFaceTexture(renderer, selection.imageUrl))
      .then((texture) => {
        const faceSlot = document.querySelector("#daily-result-image")?.getBoundingClientRect();
        if (faceSlot?.width && faceSlot?.height) {
          fitTextureCover(resultModel, texture, faceSlot.width / faceSlot.height);
        }
        applyFaceTexture(resultModel, texture);
      })
      .catch((error) => console.error("Mora daily card texture failed to load", error));
    const separationPromise = tween(reducedMotion ? 1 : 260, (progress) => {
      const movementProgress = progress;
      const opacityProgress = clamp01((movementProgress - 0.65) / 0.35) * 0.35;
      card.position.lerpVectors(localStart, localClearPoint, movementProgress);
      deckGroup.position.lerpVectors(groupStart, groupRetreatTarget, movementProgress);
      fadeMaterials.forEach((material) => {
        if (opacityProgress > 0 && !material.transparent) {
          material.transparent = true;
          material.depthWrite = false;
          material.needsUpdate = true;
        }
        material.opacity = 1 - opacityProgress;
      });
    });
    await Promise.all([separationPromise, faceTexturePromise]);
    preparedSelection = null;
    preparedFaceTexture = null;
    preparedImageUrl = "";

    deckGroup.updateWorldMatrix(true, true);
    const pullDirection = fanPullDirection.clone().transformDirection(deckGroup.matrixWorld);
    scene.attach(card);
    const liftDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(card.quaternion).normalize();
    const directionToCamera = camera.position.clone().sub(card.position);
    if (liftDirection.dot(directionToCamera) < 0) liftDirection.negate();
    const groupExitStart = deckGroup.position.clone();
    const groupExitTarget = groupExitStart.clone()
      .addScaledVector(fanPullWorldDirection, -1.8)
      .addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 0.9);
    const finalTarget = resultTarget();
    const chosenStart = {
      position: card.position.clone(),
      quaternion: card.quaternion.clone(),
      scale: card.scale.clone(),
    };
    const flightLeadPoint = chosenStart.position.clone()
      .addScaledVector(pullDirection, 0.28)
      .addScaledVector(liftDirection, 0.26);
    const travelPoint = flightLeadPoint.clone().lerp(finalTarget.position, 0.56);
    travelPoint.y += 0.38;
    const chosenPath = new THREE.CatmullRomCurve3([
      chosenStart.position,
      flightLeadPoint,
      travelPoint,
      finalTarget.position,
    ], false, "centripetal");
    let resultRevealStarted = false;
    let resultModelActive = false;
    let animatedCard = card;

    const chosenSequence = tween(reducedMotion ? 1 : 820, (rawProgress) => {
      const motionProgress = 1 - (1 - rawProgress) ** 1.6;
      const flipProgress = easeInOut(clamp01((rawProgress - 0.12) / 0.64));
      const scaleProgress = easeInOut(clamp01((rawProgress - 0.08) / 0.92));
      animatedCard.position.copy(chosenPath.getPointAt(motionProgress));
      animatedCard.quaternion.slerpQuaternions(
        chosenStart.quaternion,
        finalTarget.quaternion,
        flipProgress,
      );
      animatedCard.scale.lerpVectors(chosenStart.scale, finalTarget.scale, scaleProgress);
      if (!resultModelActive && rawProgress >= 0.44) {
        resultModel.position.copy(animatedCard.position);
        resultModel.quaternion.copy(animatedCard.quaternion);
        resultModel.scale.copy(animatedCard.scale);
        animatedCard.visible = false;
        resultModel.visible = true;
        animatedCard = resultModel;
        resultModelActive = true;
      }
      if (!resultRevealStarted && rawProgress >= 0.54) {
        resultRevealStarted = true;
        onResult?.(selection);
      }
    }).then(() => {
      animatedCard.userData.resultTarget = {
        position: finalTarget.position.clone(),
        quaternion: finalTarget.quaternion.clone(),
        scale: finalTarget.scale.clone(),
      };
      placeResultShadow(animatedCard.userData.resultTarget);
    });

    const deckExitSequence = tween(reducedMotion ? 1 : 520, (progress) => {
      const opacityProgress = 0.35 + easeInOut(progress) * 0.65;
      deckGroup.position.lerpVectors(groupExitStart, groupExitTarget, progress);
      fadeMaterials.forEach((material) => {
        material.opacity = 1 - opacityProgress;
      });
    }).then(() => {
      deckGroup.visible = false;
    });

    await Promise.all([chosenSequence, deckExitSequence]);
    resultCard = animatedCard;
    ritualState = "result";
    if (!resultRevealStarted) onResult?.(selection);
  }

  async function spinResultCard() {
    if (ritualState !== "result" || !resultCard?.userData.resultTarget) return;
    ritualState = "result-spinning";
    ensureRendering();
    resultHovered = false;
    host.classList.remove("is-result-card-hovered");
    const target = resultCard.userData.resultTarget;
    const spinAxis = new THREE.Vector3(0, 0, 1);
    const spinQuaternion = new THREE.Quaternion();
    const fullTurn = THREE.MathUtils.degToRad(360);
    const spinEaseOut = (value) => 1 - (1 - clamp01(value)) ** 5;
    const intoScene = camera.getWorldDirection(new THREE.Vector3());
    resultShadow.visible = false;

    await tween(reducedMotion ? 1 : 1050, (progress) => {
      const angle = fullTurn * spinEaseOut(progress);
      spinQuaternion.setFromAxisAngle(spinAxis, angle);
      resultCard.position.copy(target.position)
        .addScaledVector(intoScene, Math.abs(Math.sin(angle)) * 0.7);
      resultCard.quaternion.copy(target.quaternion).multiply(spinQuaternion);
      resultCard.scale.copy(target.scale);
    });

    resultCard.position.copy(target.position);
    resultCard.quaternion.copy(target.quaternion);
    placeResultShadow(target);
    ritualState = "result";
  }

  async function restoreResult(selection) {
    if (resultCard || !selection?.imageUrl) return;
    ritualState = "restoring";
    ensureRendering();
    const resultTemplate = await loadResultTemplate();
    const card = resultTemplate.clone(true);
    scene.add(card);
    const faceTexture = await (preparedImageUrl === selection.imageUrl && preparedFaceTexture
      ? preparedFaceTexture
      : loadFaceTexture(renderer, selection.imageUrl));
    const faceSlot = document.querySelector("#daily-result-image")?.getBoundingClientRect();
    if (faceSlot?.width && faceSlot?.height) {
      fitTextureCover(card, faceTexture, faceSlot.width / faceSlot.height);
    }
    applyFaceTexture(card, faceTexture);
    scene.attach(card);
    deckGroup.visible = false;
    floor.visible = false;
    const target = resultTarget();
    card.position.copy(target.position);
    card.quaternion.copy(target.quaternion);
    card.scale.copy(target.scale);
    card.userData.resultTarget = target;
    placeResultShadow(target);
    resultCard = card;
    ritualState = "result";
    renderer.render(scene, camera);
  }

  function resetResultToIdle() {
    if (ritualState === "idle") return;
    if (resultCard) {
      scene.remove(resultCard);
      resultCard = null;
    }
    resultShadow.visible = false;
    cards.forEach((card, index) => {
      if (card.parent !== deckGroup) deckGroup.add(card);
      card.visible = true;
      card.userData.fanTarget = null;
      card.userData.hoverAmount = 0;
      card.position.copy(targets[index].position);
      card.quaternion.copy(targets[index].quaternion);
      card.scale.copy(targets[index].scale);
      applyMaterials(card, materials);
      card.traverse((object) => {
        if (object.isMesh) object.castShadow = false;
      });
    });
    cards.at(-1)?.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
    deckGroup.visible = true;
    deckGroup.position.copy(idleDeckPosition);
    deckGroup.rotation.set(restingDeckTilt, 0, 0);
    setIdleDeckScale();
    floor.visible = true;
    hovered = false;
    hoveredCard = null;
    resultHovered = false;
    host.classList.remove("is-result-card-hovered");
    preparedSelection = null;
    preparedFaceTexture = null;
    preparedImageUrl = "";
    ritualState = "idle";
    const heading = host.closest(".daily-card-screen")?.querySelector(".daily-card-heading");
    if (heading) {
      heading.querySelector("h1").textContent = "Карта дня";
      heading.querySelector("p").textContent = "Нажми на колоду и узнай, что приготовил тебе день";
    }
    ensureRendering();
  }

  function activate({ keyboard = false } = {}) {
    if (ritualState === "idle") {
      beginRitual();
      return;
    }
    if (ritualState === "fan") {
      drawCard(keyboard ? cards[Math.floor(cards.length / 2)] : hoveredCard);
      return;
    }
    if (ritualState === "result" && (keyboard || resultHovered)) {
      spinResultCard();
    }
  }

  function hitTest(clientX, clientY) {
    if (isMobile() && ritualState === "idle") {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.intersectObjects(cards, true).length > 0) return true;
      deckGroup.updateWorldMatrix(true, true);
      idleDeckHitBox.setFromObject(cards.at(-1));
      return raycaster.ray.intersectsBox(idleDeckHitBox);
    }
    if (ritualState === "result") handleResultPointerMove({ clientX, clientY });
    else handlePointerMove({ clientX, clientY });
    return ritualState === "result"
      ? resultHovered
      : ritualState === "fan"
        ? Boolean(hoveredCard)
        : hovered;
  }

  host.addEventListener("pointermove", handlePointerMove);
  host.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("pointermove", handleResultPointerMove, { passive: true });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  render();
  host.classList.remove("is-3d-loading");
  host.classList.add("is-3d-ready");

  const preloadResult = () => prepareResultAssets().catch((error) => {
    console.error("Mora daily result preload failed", error);
  });
  if ("requestIdleCallback" in window) window.requestIdleCallback(preloadResult, { timeout: 1500 });
  else window.setTimeout(preloadResult, 0);

  return {
    activate,
    hitTest,
    restoreResult,
    resetResultToIdle,
    isResultActive: () => ritualState === "result",
    setActive(active) {
      renderingActive = active;
      if (active) ensureRendering();
    },
    isDeckHovered: () => {
      if (ritualState === "result") return resultHovered;
      return ritualState === "fan" ? Boolean(hoveredCard) : hovered;
    },
    destroy() {
      window.cancelAnimationFrame(frameId);
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointermove", handleResultPointerMove);
      resizeObserver.disconnect();
      renderer.dispose();
    },
  };
}
