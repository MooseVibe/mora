import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TAROT_CARDS } from "/assets/cards.js";

const stage = document.querySelector("#daily-stage");
const canvas = document.querySelector("#card-canvas");
const ritualCopy = document.querySelector("#ritual-copy");
const ritualTitle = document.querySelector("#ritual-title");
const ritualSubtitle = document.querySelector("#ritual-subtitle");
const deckAction = document.querySelector("#deck-action");
const deckActionCopy = document.querySelector("#deck-action-copy");
const loadingNote = document.querySelector("#loading-note");
const errorState = document.querySelector("#error-state");
const repeatAction = document.querySelector("#repeat-action");
const resultTitle = document.querySelector("#result-title");
const resultTitleMeta = document.querySelector("#result-title-meta");
const resultMeaningLabel = document.querySelector("#result-meaning-label");
const resultText = document.querySelector("#result-text");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => window.innerWidth <= 760;
const worldCard = TAROT_CARDS.find((card) => card.id === "world");
const worldVariant = worldCard?.result?.dayVariants?.[2] || worldCard?.result?.dayVariants?.[0];

let renderer;
let scene;
let camera;
let deckGroup;
let shadowFloor;
let cardBackMaterial;
let cards = [];
let chosenCard;
let hoveredCard;
let deckHovered = false;
let deckHoverAmount = 0;
let resultHovered = false;
const resultPressPoint = new THREE.Vector2();
let ritualState = "loading";
let frameId;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cardGap = 0.023;
const restingDeckTilt = 0.48;
const restingDeckPositionZ = 1.15;
const hoverFanRadius = 1.85;
const hoverFanSpan = 0.045;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeInOut = (value) => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};
const easeOut = (value) => 1 - (1 - clamp01(value)) ** 4;
const easeIn = (value) => clamp01(value) ** 3;

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function tween(duration, update, easing = easeInOut) {
  if (reducedMotion) {
    update(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const startedAt = performance.now();
    function tick(now) {
      const progress = clamp01((now - startedAt) / duration);
      update(easing(progress));
      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    window.requestAnimationFrame(tick);
  });
}

function moveObjects(items, targets, duration, easing = easeInOut) {
  const starts = items.map((item) => ({
    position: item.position.clone(),
    quaternion: item.quaternion.clone(),
    scale: item.scale.clone(),
  }));
  return tween(duration, (progress) => {
    items.forEach((item, index) => {
      const target = targets[index];
      item.position.lerpVectors(starts[index].position, target.position, progress);
      item.quaternion.slerpQuaternions(starts[index].quaternion, target.quaternion, progress);
      item.scale.lerpVectors(starts[index].scale, target.scale || starts[index].scale, progress);
    });
  }, easing);
}

function prepareBackTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function loadTexture(path) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(path, resolve, undefined, reject);
  });
}

function createMaterials(faceTexture, backTexture) {
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.flipY = false;
  faceTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  faceTexture.minFilter = THREE.LinearMipmapLinearFilter;
  faceTexture.magFilter = THREE.LinearFilter;

  return {
    face: new THREE.MeshBasicMaterial({
      map: faceTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    back: new THREE.MeshBasicMaterial({
      map: backTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
    body: new THREE.MeshStandardMaterial({
      color: 0x242323,
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
    object.castShadow = true;
    object.receiveShadow = false;
  });
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
      object.material = Array.isArray(object.material)
        ? independentMaterials
        : independentMaterials[0];
    });
  });
  return fadeMaterials;
}

function stackTargets(list = cards) {
  return list.map((card, index) => ({
    position: new THREE.Vector3(0, 0.08 + index * cardGap, 0),
    quaternion: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI, 0, 0),
    ),
    scale: new THREE.Vector3(0.86, 0.86, 0.86),
  }));
}

function setStackImmediately() {
  const targets = stackTargets();
  cards.forEach((card, index) => {
    card.position.copy(targets[index].position);
    card.quaternion.copy(targets[index].quaternion);
    card.scale.copy(targets[index].scale);
  });
}

function setupScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  renderer = new THREE.WebGLRenderer({
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

  shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 18),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.18 }),
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  deckGroup = new THREE.Group();
  deckGroup.rotation.set(restingDeckTilt, 0, 0);
  deckGroup.position.set(0, 0, restingDeckPositionZ);
  scene.add(deckGroup);

  resizeScene();
}

function resizeScene() {
  if (!renderer || !camera) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
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

function renderLoop() {
  if (ritualState === "idle") {
    deckHoverAmount += ((deckHovered ? 1 : 0) - deckHoverAmount) * 0.14;
    deckGroup.position.y = deckHoverAmount * 0.05;
    deckGroup.position.z = restingDeckPositionZ + deckHoverAmount * 0.02;
    deckGroup.scale.setScalar(1 + deckHoverAmount * 0.006);
    const targets = stackTargets();
    const hoverCardCount = cards.length;
    cards.forEach((card, index) => {
      const target = targets[index];
      card.position.copy(target.position);
      card.quaternion.copy(target.quaternion);
      const normalized = hoverCardCount === 1 ? 0 : index / (hoverCardCount - 1) - 0.5;
      const angle = normalized * hoverFanSpan;
      card.position.x += Math.sin(angle) * hoverFanRadius * deckHoverAmount;
      card.position.z += (Math.cos(angle) - 1) * hoverFanRadius * deckHoverAmount;
      card.quaternion.setFromEuler(
        new THREE.Euler(Math.PI, angle * deckHoverAmount, 0),
      );
      card.scale.copy(target.scale);
    });
  }
  if (ritualState === "fan") {
    cards.forEach((card) => {
      const target = card.userData.fanTarget;
      if (!target) return;
      const desiredHover = card === hoveredCard ? 1 : 0;
      card.userData.hoverAmount += (desiredHover - card.userData.hoverAmount) * 0.16;
      const amount = card.userData.hoverAmount;
      card.position.copy(target.position);
      card.position.addScaledVector(target.hoverDirection, amount * (isMobile() ? 0.07 : 0.09));
      card.quaternion.copy(target.quaternion);
      card.scale.copy(target.scale);
    });
  }
  if (ritualState === "result" && chosenCard?.userData.resultTarget) {
    const target = chosenCard.userData.resultTarget;
    const pressTilt = resultHovered
      ? new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          -resultPressPoint.y * 0.055,
          0,
          resultPressPoint.x * 0.07,
        ),
      )
      : new THREE.Quaternion();
    const desiredQuaternion = target.quaternion.clone().multiply(pressTilt);
    chosenCard.position.lerp(target.position, 0.12);
    chosenCard.quaternion.slerp(desiredQuaternion, 0.12);
    chosenCard.scale.copy(target.scale);
  }
  renderer.render(scene, camera);
  frameId = window.requestAnimationFrame(renderLoop);
}

function populateResult() {
  if (!worldCard || !worldVariant) return;
  resultTitle.textContent = `${worldCard.result.title} — `;
  resultTitleMeta.textContent = worldCard.result.titleMeta;
  resultMeaningLabel.textContent = worldCard.result.meaningLabel;
  resultText.replaceChildren();
  worldVariant.preview.forEach((paragraph) => {
    const item = document.createElement("p");
    item.textContent = paragraph;
    resultText.append(item);
  });
}

function flatPacketTargets(packet, startIndex, options = {}) {
  const {
    x = 0,
    yOffset = 0,
    z = 0,
    tilt = 0,
    scale = 0.86,
  } = options;
  return packet.map((card, index) => ({
    position: new THREE.Vector3(x, 0.08 + (startIndex + index) * cardGap + yOffset, z),
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, tilt, 0)),
    scale: new THREE.Vector3(scale, scale, scale),
  }));
}

function deckGroupTarget(
  rotationX,
  rotationY,
  rotationZ = 0,
  scale = 1,
  positionZ = 0.45,
  positionX = 0,
) {
  return [{
    position: new THREE.Vector3(positionX, 0, positionZ),
    quaternion: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotationX, rotationY, rotationZ),
    ),
    scale: new THREE.Vector3(scale, scale, scale),
  }];
}

async function performCleanCut() {
  const splitIndex = Math.floor(cards.length * 0.58);
  const lowerPacket = cards.slice(0, splitIndex);
  const upperPacket = cards.slice(splitIndex);
  const sideOffset = isMobile() ? 2.35 : 2.7;
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

  await tween(1320, (progress) => {
    const pathOffset = upperPath.getPoint(progress);
    const upperSettle = easeInOut(Math.max(0, (progress - 0.64) / 0.36));
    const lowerRise = progress < 0.36
      ? 0
      : progress < 0.58
        ? easeOut((progress - 0.36) / 0.22)
        : progress < 0.78
          ? 1
          : 1 - easeInOut((progress - 0.78) / 0.22);
    const lowerReorder = easeInOut(Math.max(0, (progress - 0.68) / 0.32));

    upperPacket.forEach((card, index) => {
      const finalTarget = finalTargets[index];
      card.position.copy(upperStarts[index].position).lerp(finalTarget.position, upperSettle);
      card.position.add(pathOffset);
      card.quaternion.slerpQuaternions(
        upperStarts[index].quaternion,
        finalTarget.quaternion,
        upperSettle,
      );
    });

    lowerPacket.forEach((card, index) => {
      const finalTarget = finalTargets[upperPacket.length + index];
      card.position.copy(lowerStarts[index].position).lerp(finalTarget.position, lowerReorder);
      card.position.y += lowerRise * 0.54;
      card.quaternion.slerpQuaternions(
        lowerStarts[index].quaternion,
        finalTarget.quaternion,
        lowerReorder,
      );
    });

    if (progress < 0.54) {
      deckGroup.quaternion.slerpQuaternions(groupStart, groupPeak, easeInOut(progress / 0.54));
    } else {
      deckGroup.quaternion.slerpQuaternions(groupPeak, groupEnd, easeInOut((progress - 0.54) / 0.46));
    }
  });

  cards = reordered;
  cards.forEach((card, index) => {
    card.position.copy(finalTargets[index].position);
    card.quaternion.copy(finalTargets[index].quaternion);
    card.scale.copy(finalTargets[index].scale);
  });
}

function fanTargets(list = cards) {
  const mobile = isMobile();
  const fanScale = mobile ? 0.48 : 0.62;
  const radius = mobile ? 2.75 : 6.42;
  const maxAngle = 0.68;
  const arcCenterZ = 0.42;
  const verticalArcRise = mobile ? 0 : 0.72;
  const layerGap = mobile ? 0.019 : 0.018;
  const middleIndex = (list.length - 1) / 2;
  const fanGroupQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-0.025, 0, 0),
  );
  const layerDirection = camera.getWorldDirection(new THREE.Vector3())
    .negate()
    .applyQuaternion(fanGroupQuaternion.invert())
    .normalize();
  const cardNormal = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI + 0.1, 0, 0),
    ))
    .normalize();
  const layerStep = layerGap / Math.max(Math.abs(layerDirection.dot(cardNormal)), 0.1);
  const baseY = mobile ? 0.13 + middleIndex * layerGap : -0.38;
  const targets = list.map((card, index) => {
    const normalized = list.length === 1 ? 0 : index / (list.length - 1) - 0.5;
    const angle = normalized * maxAngle * 2;
    const verticalArcOffset = (normalized * 2) ** 2 * verticalArcRise;
    const hoverDirection = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle))
      .applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)))
      .normalize();
    const position = new THREE.Vector3(
      Math.sin(angle) * radius,
      baseY + verticalArcOffset,
      arcCenterZ - (1 - Math.cos(angle)) * radius,
    )
      .addScaledVector(
        layerDirection,
        mobile ? (index - middleIndex) * layerStep : 0,
      );
    return {
      position,
      quaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.PI + 0.1, -angle, 0),
      ),
      scale: new THREE.Vector3(fanScale, fanScale, fanScale),
      hoverDirection,
    };
  });

  if (!mobile && targets.length > 1) {
    const layerOffsets = [0];
    for (let index = 1; index < targets.length; index += 1) {
      const previousNormal = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(targets[index - 1].quaternion);
      const currentNormal = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(targets[index].quaternion);
      const separationNormal = previousNormal.add(currentNormal).normalize();
      const directionProjection = layerDirection.dot(separationNormal);
      const signedGap = Math.sign(directionProjection || -1) * layerGap;
      const baseSeparation = targets[index].position.clone()
        .sub(targets[index - 1].position)
        .dot(separationNormal);
      const layerOffset = (signedGap - baseSeparation) / directionProjection;
      targets[index].position.addScaledVector(layerDirection, layerOffset);
      layerOffsets.push(layerOffset);
    }

    const centerOffset = (
      layerOffsets[Math.floor(middleIndex)]
      + layerOffsets[Math.ceil(middleIndex)]
    ) / 2;
    targets.forEach((target) => {
      target.position.addScaledVector(layerDirection, -centerOffset);
    });
  }

  return targets;
}

async function beginRitual() {
  if (ritualState !== "idle") return;
  ritualState = "shuffling";
  deckHovered = false;
  deckAction.disabled = true;
  stage.classList.add("is-animating");

  if (!reducedMotion) {
    await performCleanCut();
  } else {
    await wait(250);
  }

  ritualTitle.textContent = "Выбери карту";
  ritualSubtitle.textContent = "Нажми на любую карту в веере";
  shadowFloor.visible = false;
  cardBackMaterial.polygonOffset = false;
  cardBackMaterial.needsUpdate = true;
  const targets = fanTargets();
  const fanGroupScale = isMobile() ? 1 : 1.07;
  await Promise.all([
    moveObjects(cards, targets, reducedMotion ? 1 : 720, easeInOut),
    moveObjects(
      [deckGroup],
      deckGroupTarget(-0.025, 0, 0, fanGroupScale, 0.6, isMobile() ? 0 : -0.35),
      reducedMotion ? 1 : 720,
      easeInOut,
    ),
  ]);
  cards.forEach((card, index) => {
    card.userData.fanTarget = targets[index];
    card.userData.hoverAmount = 0;
  });
  stage.classList.add("is-fan");
  stage.classList.remove("is-animating");
  deckActionCopy.textContent = "Выбрать центральную карту";
  deckAction.setAttribute("aria-label", "Выбрать центральную карту");
  deckAction.disabled = false;
  ritualState = "fan";
}

function resultPose() {
  camera.updateMatrixWorld(true);
  const localPosition = isMobile()
    ? new THREE.Vector3(0, 1.08, -8.2)
    : new THREE.Vector3(2.28, 0.05, -8.2);
  const position = camera.localToWorld(localPosition.clone());
  const faceCamera = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const quaternion = camera.quaternion.clone().multiply(faceCamera);
  return { position, quaternion };
}

async function drawCard(card) {
  if (ritualState !== "fan" || !card) return;
  ritualState = "drawing";
  resultHovered = false;
  deckAction.disabled = true;
  stage.classList.remove("is-fan");
  stage.classList.add("is-animating");
  chosenCard = card;
  const remainingCards = cards.filter((item) => item !== chosenCard);
  deckGroup.updateWorldMatrix(true, true);
  const fanPullDirection = (
    chosenCard.userData.fanTarget?.hoverDirection || new THREE.Vector3(0, 0, 1)
  ).clone();
  const pullDirection = fanPullDirection.clone().transformDirection(deckGroup.matrixWorld);
  scene.attach(chosenCard);
  const liftDirection = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(chosenCard.quaternion)
    .normalize();
  const directionToCamera = camera.position.clone().sub(chosenCard.position);
  if (liftDirection.dot(directionToCamera) < 0) liftDirection.negate();
  const deckDepthDirection = camera.getWorldDirection(new THREE.Vector3())
    .transformDirection(deckGroup.matrixWorld.clone().invert());

  const deckExitTargets = remainingCards.map((remainingCard) => ({
    position: remainingCard.position.clone()
      .addScaledVector(fanPullDirection, isMobile() ? -0.26 : -0.42)
      .addScaledVector(deckDepthDirection, isMobile() ? 0.38 : 0.56),
    quaternion: remainingCard.quaternion.clone(),
    scale: remainingCard.scale.clone(),
  }));
  const pose = resultPose();
  const finalScale = isMobile() ? 0.78 : 0.92;
  const finalTarget = [{
    position: pose.position,
    quaternion: pose.quaternion,
    scale: new THREE.Vector3(finalScale, finalScale, finalScale),
  }];
  const fadeMaterials = prepareFadeMaterials(remainingCards);
  const fadeStartColors = fadeMaterials.map((material) => material.color?.clone() || null);
  const fadeBackgroundColor = new THREE.Color(0x09090a);
  const chosenStart = {
    position: chosenCard.position.clone(),
    quaternion: chosenCard.quaternion.clone(),
    scale: chosenCard.scale.clone(),
  };
  const flatLeadPoint = chosenStart.position.clone()
    .addScaledVector(pullDirection, isMobile() ? 1.12 : 1.45);
  const clearPoint = chosenStart.position.clone()
    .addScaledVector(pullDirection, isMobile() ? 1.78 : 2.3);
  const flightLeadPoint = clearPoint.clone()
    .addScaledVector(pullDirection, isMobile() ? 0.18 : 0.28)
    .addScaledVector(liftDirection, isMobile() ? 0.19 : 0.26);
  const travelPoint = flightLeadPoint.clone().lerp(finalTarget[0].position, 0.56);
  travelPoint.y += isMobile() ? 0.22 : 0.38;
  const chosenPath = new THREE.CatmullRomCurve3([
    chosenStart.position,
    flatLeadPoint,
    clearPoint,
    flightLeadPoint,
    travelPoint,
    finalTarget[0].position,
  ], false, "centripetal");
  let resultRevealStarted = false;

  const chosenSequence = tween(1320, (rawProgress) => {
    const motionProgress = easeInOut(rawProgress);
    const flipProgress = easeInOut(clamp01((rawProgress - 0.34) / 0.48));
    const scaleProgress = easeInOut(clamp01((rawProgress - 0.3) / 0.7));
    chosenCard.position.copy(chosenPath.getPointAt(motionProgress));
    chosenCard.quaternion.slerpQuaternions(
      chosenStart.quaternion,
      finalTarget[0].quaternion,
      flipProgress,
    );
    chosenCard.scale.lerpVectors(
      chosenStart.scale,
      finalTarget[0].scale,
      scaleProgress,
    );
    if (!resultRevealStarted && rawProgress >= 0.68) {
      resultRevealStarted = true;
      stage.classList.add("is-result");
    }
  }, clamp01).then(() => {
    chosenCard.userData.resultTarget = {
      position: finalTarget[0].position.clone(),
      quaternion: finalTarget[0].quaternion.clone(),
      scale: finalTarget[0].scale.clone(),
    };
  });

  const deckExitSequence = Promise.all([
    moveObjects(remainingCards, deckExitTargets, 900, easeInOut),
    tween(900, (progress) => {
      const darkenProgress = clamp01(progress / 0.76);
      const opacityProgress = clamp01((progress - 0.76) / 0.24);
      fadeMaterials.forEach((material, index) => {
        const startColor = fadeStartColors[index];
        if (startColor) {
          material.color.lerpColors(startColor, fadeBackgroundColor, darkenProgress);
        }
        if (opacityProgress > 0 && !material.transparent) {
          material.transparent = true;
          material.depthWrite = false;
          material.needsUpdate = true;
        }
        material.opacity = 1 - opacityProgress;
      });
    }, easeInOut),
  ]).then(() => {
    deckGroup.visible = false;
  });

  await Promise.all([chosenSequence, deckExitSequence]);

  stage.classList.add("is-result");
  stage.classList.remove("is-animating");
  ritualState = "result";
}

function handleDeckAction() {
  if (ritualState === "idle") {
    beginRitual();
  } else if (ritualState === "fan") {
    drawCard(cards[Math.floor(cards.length / 2)]);
  }
}

function cardFromIntersection(object) {
  let current = object;
  while (current && current !== deckGroup) {
    if (current.userData.isMoraCard) return current;
    current = current.parent;
  }
  return null;
}

async function spinResultCard() {
  if (ritualState !== "result" || !chosenCard) return;
  ritualState = "result-spinning";
  resultHovered = false;
  const baseQuaternion = chosenCard.quaternion.clone();
  const spinAxis = new THREE.Vector3(0, 0, 1);
  const spinQuaternion = new THREE.Quaternion();
  const applySpin = (angle) => {
    spinQuaternion.setFromAxisAngle(spinAxis, angle);
    chosenCard.quaternion.copy(baseQuaternion).multiply(spinQuaternion);
  };
  const fullTurn = THREE.MathUtils.degToRad(360);
  const spinEaseOut = (value) => 1 - (1 - clamp01(value)) ** 5;

  await tween(1050, (progress) => {
    applySpin(fullTurn * spinEaseOut(progress));
  }, clamp01);

  chosenCard.quaternion.copy(baseQuaternion);
  ritualState = "result";
}

function handleCanvasPick(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (ritualState === "result" && chosenCard) {
    const intersection = raycaster.intersectObject(chosenCard, true)[0];
    if (intersection) spinResultCard();
    return;
  }
  if (ritualState !== "fan") return;
  const intersection = raycaster.intersectObjects(cards, true)[0];
  const card = intersection ? cardFromIntersection(intersection.object) : null;
  if (card) drawCard(card);
}

function handleCanvasHover(event) {
  if (event.pointerType === "touch") {
    hoveredCard = null;
    resultHovered = false;
    return;
  }
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (ritualState === "fan") {
    const intersection = raycaster.intersectObjects(cards, true)[0];
    hoveredCard = intersection ? cardFromIntersection(intersection.object) : null;
    resultHovered = false;
    return;
  }
  hoveredCard = null;
  if (ritualState === "result" && chosenCard) {
    const intersection = raycaster.intersectObject(chosenCard, true)[0];
    resultHovered = Boolean(intersection);
    if (intersection?.uv) {
      resultPressPoint.set(
        (intersection.uv.x - 0.5) * 2,
        (intersection.uv.y - 0.5) * 2,
      );
    }
    return;
  }
  resultHovered = false;
}

async function init() {
  try {
    setupScene();
    populateResult();

    const [gltf, faceTexture, backTexture] = await Promise.all([
      new GLTFLoader().loadAsync("./assets/mora-card.glb?v=20260821-stripface1"),
      loadTexture(`/${worldCard.image.replace(/^\/+/, "")}`),
      loadTexture("./assets/mora-card-back-v3.webp"),
    ]);
    const materials = createMaterials(faceTexture, prepareBackTexture(backTexture));
    cardBackMaterial = materials.back;
    const template = gltf.scene;
    applyMaterials(template, materials);

    const bounds = new THREE.Box3().setFromObject(template);
    const size = bounds.getSize(new THREE.Vector3());
    const normalizeScale = 3.55 / Math.max(size.x, size.z);
    template.scale.setScalar(normalizeScale);
    template.updateMatrixWorld(true);

    const stackCardCount = isMobile() ? 22 : 30;
    for (let index = 0; index < stackCardCount; index += 1) {
      const card = template.clone(true);
      card.name = `MoraDeckCard_${index + 1}`;
      card.userData.isMoraCard = true;
      deckGroup.add(card);
      cards.push(card);
    }
    setStackImmediately();

    loadingNote.classList.add("is-hidden");
    ritualState = "idle";
    deckAction.disabled = false;
    renderLoop();
  } catch (error) {
    console.error(error);
    ritualState = "error";
    loadingNote.classList.add("is-hidden");
    deckAction.disabled = true;
    errorState.hidden = false;
  }
}

deckAction.disabled = true;
deckAction.addEventListener("click", handleDeckAction);
deckAction.addEventListener("pointerenter", (event) => {
  if (event.pointerType !== "touch" && ritualState === "idle") deckHovered = true;
});
deckAction.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "touch" && ritualState === "idle") deckHovered = true;
});
deckAction.addEventListener("pointerleave", () => {
  deckHovered = false;
});
canvas.addEventListener("pointerup", handleCanvasPick);
canvas.addEventListener("pointermove", handleCanvasHover);
canvas.addEventListener("pointerleave", () => {
  hoveredCard = null;
  resultHovered = false;
});
repeatAction.addEventListener("click", () => window.location.reload());
window.addEventListener("resize", resizeScene);
window.addEventListener("pagehide", () => {
  if (frameId) window.cancelAnimationFrame(frameId);
  renderer?.dispose();
});

init();
