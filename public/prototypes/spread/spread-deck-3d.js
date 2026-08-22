import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const isMobile = () => window.innerWidth <= 720;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeInOut = (value) => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2;
};

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

function loadBackTexture(renderer) {
  const texture = new THREE.TextureLoader().load(
    new URL("../3d-daily/assets/mora-card-back-v3.webp", import.meta.url).href,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createCardShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  context.filter = "blur(18px)";
  context.fillStyle = "rgba(0, 0, 0, 0.72)";
  context.roundRect(24, 20, 208, 344, 18);
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

function createFacePlaceholderTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

function applyMaterials(root, renderer) {
  const materials = {
    face: new THREE.MeshBasicMaterial({
      color: 0x242323,
      map: createFacePlaceholderTexture(),
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    back: new THREE.MeshBasicMaterial({
      map: loadBackTexture(renderer),
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
    body: new THREE.MeshStandardMaterial({ color: 0x343231, roughness: 0.38, metalness: 0.06 }),
    border: new THREE.MeshStandardMaterial({
      color: 0x5f5f5f,
      roughness: 0.5,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
  };
  root.traverse((object) => {
    if (!object.isMesh) return;
    const name = object.name.toLowerCase();
    if (name.endsWith("_frontborder") || name.endsWith("_backborder")) object.material = materials.border;
    else if (name.endsWith("_front")) object.material = materials.face;
    else if (name.endsWith("_back")) object.material = materials.back;
    else object.material = materials.body;
  });
}

function loadFaceTexture(renderer, path) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(path, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
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
    object.material = material;
  });
}

export async function mountSpreadDeck3D({ canvas, host, cardElements }) {
  if (!canvas || !host || !cardElements?.length) throw new Error("Spread 3D deck setup is incomplete");

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 3 : 1.5));
  scene.add(new THREE.HemisphereLight(0xded6ce, 0x151519, 1.7));
  const key = new THREE.DirectionalLight(0xffe7d2, 2.8);
  key.position.set(-4, 8, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cb8df, 1.15);
  rim.position.set(5, 4, 6);
  scene.add(rim);

  const deckGltf = await new GLTFLoader().loadAsync("../3d-daily/assets/mora-card.glb?v=20260821-stripface1");
  const template = deckGltf.scene;
  applyMaterials(template, renderer);
  const size = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
  const cardCount = cardElements.length;
  const cards = Array(cardCount).fill(null);
  const shadows = Array(cardCount).fill(null);
  const selectedIndices = new Set();
  const faceCamera = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const verticalAxis = new THREE.Vector3(0, 1, 0);
  const frontCamera = new THREE.Quaternion()
    .setFromAxisAngle(verticalAxis, Math.PI)
    .multiply(faceCamera);
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: createCardShadowTexture(),
    color: 0x000000,
    opacity: 0.32,
    transparent: true,
    depthWrite: false,
  });
  const faceTextures = new Map();
  function preloadFace(path) {
    if (!faceTextures.has(path)) {
      faceTextures.set(path, loadFaceTexture(renderer, path).then((texture) => {
        renderer.initTexture(texture);
        return texture;
      }));
    }
    return faceTextures.get(path);
  }
  function ensureCard(index) {
    if (cards[index]) return cards[index];
    const card = template.clone(true);
    card.userData.fadeMaterials = [];
    card.traverse((object) => {
      if (!object.isMesh) return;
      object.material = object.material.clone();
      object.material.transparent = true;
      card.userData.fadeMaterials.push(object.material);
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial.clone());
    scene.add(card, shadow);
    cards[index] = card;
    shadows[index] = shadow;
    return card;
  }

  let hoveredIndex = null;
  let animationFrame;
  const hoverAmounts = Array(cardCount).fill(0);
  const parkedResults = new Map();
  let layoutSyncUntil = 0;
  let fanVisible = true;
  let fanExitAmount = 0;
  let fanExitToken = 0;
  let draggedIndex = null;
  let dragStartScale = null;
  let dragScaleAmount = 0;
  let visibleIndices = new Set(cards.keys());
  let viewportWidth = 0;
  let viewportHeight = 0;
  const cardTurnAxis = new THREE.Vector3(0, 0, 1);

  function configureViewport() {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    if (rect.width !== viewportWidth || rect.height !== viewportHeight) {
      viewportWidth = rect.width;
      viewportHeight = rect.height;
      renderer.setSize(rect.width, rect.height, false);
      camera.left = -rect.width / 2;
      camera.right = rect.width / 2;
      camera.top = rect.height / 2;
      camera.bottom = -rect.height / 2;
      camera.near = 0.1;
      camera.far = 2000;
      camera.updateProjectionMatrix();
    }
    return rect;
  }

  function renderDeck() {
    const viewport = configureViewport();
    if (!viewport) return;
    const middleIndex = (cardCount - 1) / 2;

    cards.forEach((card, index) => {
      if (!card) return;
      if (selectedIndices.has(index)) return;
      if (index === draggedIndex) return;
      if (!visibleIndices.has(index)) {
        card.visible = false;
        shadows[index].visible = false;
        return;
      }
      if (!fanVisible) {
        card.visible = false;
        shadows[index].visible = false;
        return;
      }
      const element = cardElements[index];
      const rect = element.getBoundingClientRect();
      const angle = Number(element.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
      const rotation = THREE.MathUtils.degToRad(-angle);
      const outwardAngle = THREE.MathUtils.degToRad(angle);
      const xScale = rect.width / size.x;
      const zScale = rect.height / size.z;
      const layerStep = size.y * xScale + 2.5;
      const hoverTarget = index === hoveredIndex ? 1 : 0;
      hoverAmounts[index] += (hoverTarget - hoverAmounts[index]) * 0.16;
      const hoverAmount = hoverAmounts[index];
      const hoverX = Math.sin(outwardAngle) * hoverAmount * 12;
      const hoverY = Math.cos(outwardAngle) * hoverAmount * 12;
      const fanOpacity = 1 - fanExitAmount;
      const x = rect.left + rect.width / 2 - viewport.width / 2 + hoverX;
      const y = viewport.height / 2 - rect.top - rect.height / 2 + hoverY;
      const z = (index - middleIndex) * layerStep;
      card.position.set(x, y, z);
      card.quaternion.setFromAxisAngle(cardTurnAxis, rotation).multiply(faceCamera);
      card.scale.set(xScale, xScale, zScale);
      card.userData.fadeMaterials.forEach((material) => {
        material.opacity = fanOpacity;
      });
      card.visible = true;

      const shadow = shadows[index];
      shadow.position.set(x, y - 6, z - layerStep * 0.55);
      shadow.quaternion.setFromAxisAngle(cardTurnAxis, rotation);
      shadow.scale.set(rect.width * 1.12, rect.height * 1.08, 1);
      shadow.material.opacity = 0.32 * fanOpacity;
      shadow.visible = true;
    });

    parkedResults.forEach((result) => {
      const rect = result.targetElement.getBoundingClientRect();
      result.target.position.set(
        rect.left + rect.width / 2 - viewport.width / 2,
        viewport.height / 2 - rect.top - rect.height / 2,
        72,
      );
      result.target.scale.set(
        rect.width / size.x,
        rect.width / size.x,
        rect.height / size.z,
      );
      if (result.spinning) return;
      const pressTilt = result.hovered
        ? new THREE.Quaternion().setFromEuler(new THREE.Euler(
          result.tiltPoint.y * 0.055,
          -result.tiltPoint.x * 0.055,
          0,
        ))
        : new THREE.Quaternion();
      const desiredQuaternion = result.target.quaternion.clone().multiply(pressTilt);
      result.card.position.copy(result.target.position);
      result.card.quaternion.slerp(desiredQuaternion, 0.12);
      result.card.scale.copy(result.target.scale);
    });

    renderer.render(scene, camera);
    window.cancelAnimationFrame(animationFrame);
    if (hoverAmounts.some((amount, index) => !selectedIndices.has(index)
      && Math.abs((index === hoveredIndex ? 1 : 0) - amount) > 0.002)
      || Array.from(parkedResults.values()).some((result) => !result.spinning
        && (result.hovered || result.card.quaternion.angleTo(result.target.quaternion) > 0.001))
      || performance.now() < layoutSyncUntil) {
      animationFrame = window.requestAnimationFrame(renderDeck);
    }
  }

  const resizeObserver = new ResizeObserver(renderDeck);
  resizeObserver.observe(host);
  renderDeck();
  host.classList.add("is-ready");

  return {
    refresh: renderDeck,
    preloadFace,
    setVisibleIndices(nextIndices) {
      visibleIndices = new Set(nextIndices);
      nextIndices.forEach(ensureCard);
      renderDeck();
    },
    setHovered(nextIndex) {
      hoveredIndex = nextIndex;
      renderDeck();
    },
    syncResults(duration = 800) {
      layoutSyncUntil = performance.now() + duration;
      renderDeck();
    },
    hideFan(duration = 560) {
      hoveredIndex = null;
      const token = ++fanExitToken;
      if (duration <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        fanExitAmount = 1;
        fanVisible = false;
        renderDeck();
        return;
      }
      tween(duration, (progress) => {
        if (token !== fanExitToken) return;
        fanExitAmount = easeInOut(progress);
        renderDeck();
        if (progress === 1) fanVisible = false;
      });
    },
    reset() {
      window.cancelAnimationFrame(animationFrame);
      fanExitToken += 1;
      selectedIndices.clear();
      parkedResults.clear();
      fanVisible = true;
      fanExitAmount = 0;
      hoveredIndex = null;
      draggedIndex = null;
      dragStartScale = null;
      dragScaleAmount = 0;
      hoverAmounts.fill(0);
      cards.forEach((card, index) => {
        if (!card) return;
        card.userData.fadeMaterials.forEach((material) => {
          material.opacity = 1;
        });
        card.visible = visibleIndices.has(index);
        shadows[index].material.opacity = 0.32;
        shadows[index].visible = visibleIndices.has(index);
      });
      renderDeck();
    },
    startDrag(index) {
      if (selectedIndices.has(index)) return false;
      ensureCard(index);
      draggedIndex = index;
      dragStartScale = cards[index].scale.clone();
      dragScaleAmount = 0;
      hoveredIndex = null;
      shadows[index].visible = false;
      return true;
    },
    moveDrag(index, clientX, clientY, straighten = 1, targetElement = null) {
      if (draggedIndex !== index) return;
      const viewport = configureViewport();
      if (!viewport) return;
      const card = cards[index];
      card.position.set(
        clientX - viewport.left - viewport.width / 2,
        viewport.height / 2 - (clientY - viewport.top),
        200,
      );
      card.quaternion.slerp(faceCamera, clamp01(straighten));
      const targetScaleAmount = targetElement ? 1 : 0;
      dragScaleAmount += (targetScaleAmount - dragScaleAmount) * 0.24;
      if (dragStartScale) {
        const nextScale = dragStartScale.clone();
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          nextScale.set(
            rect.width / size.x * 1.08,
            rect.width / size.x * 1.08,
            rect.height / size.z * 1.08,
          );
        }
        card.scale.lerpVectors(dragStartScale, nextScale, dragScaleAmount);
      }
      renderer.render(scene, camera);
    },
    async cancelDrag() {
      if (draggedIndex === null) return;
      const index = draggedIndex;
      const card = cards[index];
      const viewport = configureViewport();
      if (!viewport) return;
      const element = cardElements[index];
      const rect = element.getBoundingClientRect();
      const angle = Number(element.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
      const rotation = THREE.MathUtils.degToRad(-angle);
      const xScale = rect.width / size.x;
      const zScale = rect.height / size.z;
      const layerStep = size.y * xScale + 2.5;
      const targetPosition = new THREE.Vector3(
        rect.left + rect.width / 2 - viewport.width / 2,
        viewport.height / 2 - rect.top - rect.height / 2,
        (index - (cardCount - 1) / 2) * layerStep,
      );
      const targetQuaternion = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotation)
        .multiply(faceCamera);
      const targetScale = new THREE.Vector3(xScale, xScale, zScale);
      const startPosition = card.position.clone();
      const startQuaternion = card.quaternion.clone();
      const startScale = card.scale.clone();
      await tween(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 360, (rawProgress) => {
        const progress = easeInOut(rawProgress);
        card.position.lerpVectors(startPosition, targetPosition, progress);
        card.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, progress);
        card.scale.lerpVectors(startScale, targetScale, progress);
        renderer.render(scene, camera);
      });
      draggedIndex = null;
      dragStartScale = null;
      dragScaleAmount = 0;
      hoverAmounts[index] = 0;
      renderDeck();
    },
    setResultTilt(slotIndex, x, y) {
      const result = parkedResults.get(slotIndex);
      if (!result) return;
      result.tiltPoint.set(x, y);
      result.hovered = true;
      renderDeck();
    },
    clearResultTilt(slotIndex) {
      const result = parkedResults.get(slotIndex);
      if (!result) return;
      result.hovered = false;
      result.tiltPoint.set(0, 0);
      renderDeck();
    },
    async spinResult(slotIndex) {
      const result = parkedResults.get(slotIndex);
      if (!result || result.spinning) return;
      result.spinning = true;
      result.hovered = false;
      const spinAxis = new THREE.Vector3(0, 0, 1);
      const spinQuaternion = new THREE.Quaternion();
      const fullTurn = THREE.MathUtils.degToRad(360);
      await tween(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 1050, (progress) => {
        const spinProgress = 1 - (1 - clamp01(progress)) ** 5;
        spinQuaternion.setFromAxisAngle(spinAxis, fullTurn * spinProgress);
        result.card.position.copy(result.target.position);
        result.card.quaternion.copy(result.target.quaternion).multiply(spinQuaternion);
        result.card.scale.copy(result.target.scale);
        renderer.render(scene, camera);
      });
      result.card.quaternion.copy(result.target.quaternion);
      result.spinning = false;
      renderDeck();
    },
    async drawToSlot({ index, slotIndex, imageUrl, targetElement, onCover, onTextReveal }) {
      if (selectedIndices.has(index)) return false;
      ensureCard(index);
      const viewport = configureViewport();
      if (!viewport) return false;
      renderDeck();
      hoveredIndex = null;
      selectedIndices.add(index);

      const card = cards[index];
      const shadow = shadows[index];
      shadow.visible = false;
      const texturePromise = preloadFace(imageUrl);
      const flightStartedAt = performance.now();
      let firstFrameRecorded = false;

      const startPosition = card.position.clone();
      const startQuaternion = card.quaternion.clone();
      const startScale = card.scale.clone();
      draggedIndex = null;
      dragStartScale = null;
      dragScaleAmount = 0;
      const targetRect = targetElement.getBoundingClientRect();
      const targetPosition = new THREE.Vector3(
        targetRect.left + targetRect.width / 2 - viewport.width / 2,
        viewport.height / 2 - targetRect.top - targetRect.height / 2,
        72,
      );
      const targetScale = new THREE.Vector3(
        targetRect.width / size.x,
        targetRect.width / size.x,
        targetRect.height / size.z,
      );
      const control = startPosition.clone().lerp(targetPosition, 0.5);
      control.y = Math.max(startPosition.y, targetPosition.y) + 70;
      const straightenedBack = new THREE.Quaternion();
      const horizontalTurn = new THREE.Quaternion();
      const flightZ = targetPosition.z
        + Math.max(startScale.x, targetScale.x) * size.x / 2
        + 12;
      let coverStarted = false;
      let textRevealStarted = false;

      card.position.copy(startPosition);
      card.quaternion.copy(startQuaternion);
      card.scale.copy(startScale);
      card.visible = true;
      shadow.material = shadow.material.clone();
      shadow.material.opacity = 0;
      const updateFlight = (rawProgress) => {
        if (!firstFrameRecorded) {
          firstFrameRecorded = true;
          performance.measure("mora-spread-click-to-first-frame", {
            start: flightStartedAt,
            end: performance.now(),
          });
        }
        if (!textRevealStarted && rawProgress >= 0.7) {
          textRevealStarted = true;
          onTextReveal?.();
        }
        if (!coverStarted && rawProgress >= 0.8) {
          coverStarted = true;
          onCover?.();
        }
        const progress = easeInOut(rawProgress);
        const liftProgress = 1 - (1 - clamp01(rawProgress / 0.2)) ** 3;
        const landingProgress = easeInOut(clamp01((rawProgress - 0.84) / 0.16));
        const straightenProgress = easeInOut(clamp01(rawProgress / 0.22));
        const turnProgress = easeInOut(clamp01((rawProgress - 0.22) / 0.6));
        const inverse = 1 - progress;
        card.position.set(
          inverse ** 2 * startPosition.x + 2 * inverse * progress * control.x + progress ** 2 * targetPosition.x,
          inverse ** 2 * startPosition.y + 2 * inverse * progress * control.y + progress ** 2 * targetPosition.y,
          THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(startPosition.z, flightZ, liftProgress),
            targetPosition.z,
            landingProgress,
          ),
        );
        straightenedBack.slerpQuaternions(startQuaternion, faceCamera, straightenProgress);
        horizontalTurn.setFromAxisAngle(verticalAxis, Math.PI * turnProgress);
        card.quaternion.copy(horizontalTurn).multiply(straightenedBack);
        card.scale.lerpVectors(startScale, targetScale, progress);
        renderer.render(scene, camera);
      };
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      await tween(reduceMotion ? 1 : 180, (progress) => updateFlight(progress * 0.22));
      const texture = await texturePromise;
      applyFaceTexture(card, texture);
      await tween(reduceMotion ? 1 : 640, (progress) => updateFlight(0.22 + progress * 0.78));

      card.position.copy(targetPosition);
      card.quaternion.copy(frontCamera);
      card.scale.copy(targetScale);
      parkedResults.set(slotIndex, {
        card,
        targetElement,
        target: {
          position: targetPosition.clone(),
          quaternion: frontCamera.clone(),
          scale: targetScale.clone(),
        },
        tiltPoint: new THREE.Vector2(),
        hovered: false,
        spinning: false,
      });
      renderer.render(scene, camera);
      return true;
    },
  };
}
