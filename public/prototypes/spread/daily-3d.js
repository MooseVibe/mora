import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const isMobile = () => window.innerWidth <= 720;
const cardGap = 0.023;
const restingDeckTilt = isMobile() ? 0.48 : 0.4;
const restingDeckPositionZ = 1.15;
const hoverFanRadius = 1.85;
const hoverFanSpan = 0.045;
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
    new URL("../3d-daily/assets/mora-card-back-v3.webp", import.meta.url).href,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function createMaterials(backTexture) {
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
      color: 0x343231,
      roughness: 0.38,
      metalness: 0.06,
    }),
    border: new THREE.MeshStandardMaterial({
      color: 0x5f5f5f,
      roughness: 0.5,
      metalness: 0.04,
      side: THREE.DoubleSide,
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
    antialias: !isMobile(),
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.2 : 1.5));

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
  const embeddedDeckScale = isMobile() ? 1 : 1.12;
  deckGroup.rotation.set(restingDeckTilt, 0, 0);
  deckGroup.position.set(0, 0, restingDeckPositionZ);
  deckGroup.scale.setScalar(embeddedDeckScale);
  scene.add(deckGroup);

  const [gltf, backTexture] = await Promise.all([
    new GLTFLoader().loadAsync("../3d-daily/assets/mora-card.glb"),
    loadBackTexture(renderer),
  ]);
  const materials = createMaterials(backTexture);
  const template = gltf.scene;
  applyMaterials(template, materials);
  const bounds = new THREE.Box3().setFromObject(template);
  const size = bounds.getSize(new THREE.Vector3());
  template.scale.setScalar(3.55 / Math.max(size.x, size.z));
  template.updateMatrixWorld(true);
  let resultTemplatePromise = null;
  function loadResultTemplate() {
    if (!resultTemplatePromise) {
      resultTemplatePromise = new GLTFLoader()
        .loadAsync("../3d-daily/assets/mora-card-result.glb")
        .then((resultGltf) => {
          const resultTemplate = resultGltf.scene;
          applyMaterials(resultTemplate, materials);
          const resultBounds = new THREE.Box3().setFromObject(resultTemplate);
          const resultSize = resultBounds.getSize(new THREE.Vector3());
          resultTemplate.scale.setScalar(3.55 / Math.max(resultSize.x, resultSize.z));
          resultTemplate.updateMatrixWorld(true);
          return resultTemplate;
        });
    }
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
  let preparedSelection = null;
  let preparedFaceTexture = null;
  let hoverAmount = 0;
  let ritualState = "idle";
  let frameId;
  let renderingActive = true;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const resultPressPoint = new THREE.Vector2();

  function resize() {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    if (isMobile()) {
      camera.position.set(0, 7.6, 10.6);
      camera.fov = 38;
      camera.lookAt(0, 0.2, 0.6);
    } else {
      camera.position.set(0, 7.1, 10.2);
      camera.fov = 34;
      camera.lookAt(0, 0.35, 0.45);
    }
    camera.updateProjectionMatrix();
  }

  function render() {
    if (!renderingActive) {
      frameId = null;
      return;
    }
    if (ritualState === "idle") {
      hoverAmount += ((hovered ? 1 : 0) - hoverAmount) * 0.14;
      deckGroup.position.y = hoverAmount * 0.05;
      deckGroup.position.z = restingDeckPositionZ + hoverAmount * 0.02;
      deckGroup.scale.setScalar(embeddedDeckScale * (1 + hoverAmount * 0.006));

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
        : ritualState === "result" && resultCard?.userData.resultTarget
          ? resultHovered || resultCard.quaternion.angleTo(resultCard.userData.resultTarget.quaternion) > 0.001
          : true;
    frameId = hoverSettling ? window.requestAnimationFrame(render) : null;
  }

  function ensureRendering() {
    if (renderingActive && !frameId) frameId = window.requestAnimationFrame(render);
  }

  function handlePointerMove(event) {
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
    hovered = raycaster.intersectObjects(cards, true).length > 0;
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

  async function beginRitual() {
    if (ritualState !== "idle") return;
    preparedSelection = onPrepare?.() || null;
    preparedFaceTexture = preparedSelection?.imageUrl
      ? loadFaceTexture(renderer, preparedSelection.imageUrl)
      : null;
    loadResultTemplate();
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
      position: new THREE.Vector3(-0.35, 0, 0.6),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.025, 0, 0)),
      scale: new THREE.Vector3(1.2947, 1.2947, 1.2947),
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
      ? new THREE.Vector3(0, 1.08, -8.2)
      : new THREE.Vector3(2.28, 0.05, -8.2);
    const position = camera.localToWorld(localPosition);
    const faceCamera = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    return {
      position,
      quaternion: camera.quaternion.clone().multiply(faceCamera),
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
    resultShadow.scale.set(isMobile() ? 2.25 : 2.85, isMobile() ? 3.45 : 4.3225, 1);
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
      .then((texture) => applyFaceTexture(resultModel, texture))
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
    const pose = resultPose();
    const finalTarget = {
      position: pose.position,
      quaternion: pose.quaternion,
      scale: isMobile()
        ? new THREE.Vector3(0.78, 0.78, 0.811)
        : new THREE.Vector3(1.026, 1.026, 1.06685),
    };
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
    await loadFaceTexture(renderer, selection.imageUrl).then((texture) => applyFaceTexture(card, texture));
    scene.attach(card);
    deckGroup.visible = false;
    floor.visible = false;
    const pose = resultPose();
    const target = {
      position: pose.position.clone(),
      quaternion: pose.quaternion.clone(),
      scale: isMobile()
        ? new THREE.Vector3(0.78, 0.78, 0.811)
        : new THREE.Vector3(1.026, 1.026, 1.06685),
    };
    card.position.copy(target.position);
    card.quaternion.copy(target.quaternion);
    card.scale.copy(target.scale);
    card.userData.resultTarget = target;
    placeResultShadow(target);
    resultCard = card;
    ritualState = "result";
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

  host.addEventListener("pointermove", handlePointerMove);
  host.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("pointermove", handleResultPointerMove, { passive: true });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  render();
  host.classList.remove("is-3d-loading");
  host.classList.add("is-3d-ready");

  return {
    activate,
    restoreResult,
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
