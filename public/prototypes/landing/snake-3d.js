import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#card-snake-canvas");
const host = canvas.parentElement;
const isMobile = () => window.innerWidth <= 900;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
camera.position.set(0, 0, 1000);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: !isMobile(),
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xded6ce, 0x151519, 1.35));
const key = new THREE.DirectionalLight(0xffe7d2, 2.4);
key.position.set(-6, 7, 10);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9cb8df, 0.9);
rim.position.set(5, 4, 8);
scene.add(rim);

const [gltf, backTexture] = await Promise.all([
  new GLTFLoader().loadAsync("../3d-daily/assets/mora-card-landing.glb"),
  new THREE.TextureLoader().loadAsync("../3d-daily/assets/mora-card-back-v3.png"),
]);

backTexture.colorSpace = THREE.SRGBColorSpace;
backTexture.flipY = false;
backTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

const materials = {
  face: new THREE.MeshBasicMaterial({ color: 0x242323, side: THREE.DoubleSide, toneMapped: false }),
  back: new THREE.MeshBasicMaterial({ map: backTexture, side: THREE.DoubleSide, toneMapped: false }),
  body: new THREE.MeshStandardMaterial({ color: 0x343231, roughness: 0.38, metalness: 0.06 }),
  border: new THREE.MeshStandardMaterial({
    color: 0x777472,
    roughness: 0.46,
    metalness: 0.04,
    side: THREE.DoubleSide,
  }),
};

gltf.scene.traverse((object) => {
  if (!object.isMesh) return;
  const name = object.name.toLowerCase();
  if (name.endsWith("_frontborder") || name.endsWith("_backborder")) object.material = materials.border;
  else if (name.endsWith("_front")) object.material = materials.face;
  else if (name.endsWith("_back")) object.material = materials.back;
  else object.material = materials.body;
});

const group = new THREE.Group();
scene.add(group);

const faceCamera = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const card = gltf.scene.clone(true);
const cardSize = new THREE.Box3().setFromObject(card).getSize(new THREE.Vector3());
const presentationTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.025, -0.065, 0));
card.quaternion.copy(faceCamera).multiply(presentationTilt);
group.add(card);

function resize() {
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.left = -rect.width / 2;
  camera.right = rect.width / 2;
  camera.top = rect.height / 2;
  camera.bottom = -rect.height / 2;
  camera.near = 0.1;
  camera.far = 2000;
  camera.updateProjectionMatrix();

  const targetCenterX = rect.width * (595 / 1440) - rect.width / 2;
  const targetCenterY = rect.height / 2 - rect.height * (545 / 900);
  const targetWidth = rect.width * (280 / 1440);
  const targetHeight = rect.height * (500 / 900);
  card.position.set(targetCenterX, targetCenterY, 0);
  card.scale.set(
    targetWidth / cardSize.x,
    targetWidth / cardSize.x,
    targetHeight / cardSize.z,
  );
  renderer.render(scene, camera);
}

window.addEventListener("resize", resize);
resize();
