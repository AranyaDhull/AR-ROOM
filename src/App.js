import "./App.css";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { XREstimatedLight } from "three/examples/jsm/webxr/XREstimatedLight";

function App() {
  let scene, camera, renderer;
  let reticle, controller;
  let xrLight, fallbackLight, directionalLight;
  let models = [
    "./dylan_armchair_yolk_yellow.glb",
    "./ivan_armchair_mineral_blue.glb",
    "./marble_coffee_table.glb",
    "./flippa_functional_coffee_table_w._storagewalnut.glb",
    "./frame_armchairpetrol_velvet_with_gold_frame.glb",
    "./elnaz_nesting_side_tables_brass__green_marble.glb",
    "standing_lamp.glb",
    "plant_decor.glb",
    "little_bookcase.glb",
    "dining_set.glb"
  ];
  let modelScaleFactor = [0.01, 0.01, 0.005, 0.01, 0.01, 0.01, 0.1, 1, 1, 1];
  let items = [];
  let itemSelectedIndex = 0;
  let selectedModel = null;

  let hitTestSource = null;
  let hitTestSourceRequested = false;

  // For touch gestures
  let lastTouchDistance = 0;
  let initialRotation = 0;

  init();
  setupFurnitureSelection();
  animate();

  function init() {
    const canvas = document.getElementById("canvas");
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, canvas.innerWidth / canvas.innerHeight, 0.01, 20);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.innerWidth, canvas.innerHeight);
    renderer.xr.enabled = true;
    renderer.shadowMap.enabled = true;

    // Fallback Lights
    fallbackLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    fallbackLight.position.set(0, 1, 0);
    scene.add(fallbackLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(0, 4, 2);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Light estimation
    xrLight = new XREstimatedLight(renderer);
    xrLight.addEventListener("estimationstart", () => {
      scene.add(xrLight);
      if (xrLight.light) xrLight.light.castShadow = true;
      scene.remove(fallbackLight);
      scene.remove(directionalLight);
      if (xrLight.environment) scene.environment = xrLight.environment;
    });

    xrLight.addEventListener("estimationend", () => {
      scene.remove(xrLight);
      scene.add(fallbackLight);
      scene.add(directionalLight);
      scene.environment = null;
    });

    // AR Button
    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["light-estimation", "dom-overlay"],
      domOverlay: { root: document.body },
    });
    arButton.style.bottom = "20%";
    document.body.appendChild(arButton);

    // Load models
    for (let i = 0; i < models.length; i++) {
      const loader = new GLTFLoader();
      loader.load(models[i], function (gltf) {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        items[i] = model;
      });
    }

    // Reticle
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Controller
    controller = renderer.xr.getController(0);
    controller.addEventListener("select", onSelect);
    scene.add(controller);

    // Gesture listeners
    setupTouchGestures();
  }

  function onSelect() {
    if (reticle.visible) {
      const model = items[itemSelectedIndex].clone();
      const scale = modelScaleFactor[itemSelectedIndex];

      reticle.matrix.decompose(model.position, model.quaternion, model.scale);
      model.scale.set(scale, scale, scale);

      scene.add(model);
      selectedModel = model;
    }
  }

  function setupFurnitureSelection() {
    for (let i = 0; i < models.length; i++) {
      const el = document.querySelector(`#item` + i);
      el.addEventListener("beforexrselect", (e) => e.preventDefault());
      el.addEventListener("click", (e) => {
        e.preventDefault();
        itemSelectedIndex = i;
        for (let j = 0; j < models.length; j++) {
          document.querySelector(`#item` + j)?.classList.remove("clicked");
        }
        el.classList.add("clicked");
      });
    }
  }

  function setupTouchGestures() {
    let lastTouchX = 0, lastTouchY = 0;

    document.addEventListener("touchstart", (e) => {
      if (!selectedModel || e.touches.length < 1) return;
      if (e.touches.length === 2) {
        lastTouchDistance = getDistance(e.touches[0], e.touches[1]);
        initialRotation = getAngle(e.touches[0], e.touches[1]);
      } else {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    });

    document.addEventListener("touchmove", (e) => {
      if (!selectedModel) return;

      if (e.touches.length === 1) {
        // Move in XZ plane
        const deltaX = (e.touches[0].clientX - lastTouchX) * 0.001;
        const deltaZ = (e.touches[0].clientY - lastTouchY) * 0.001;
        selectedModel.position.x += deltaX;
        selectedModel.position.z += deltaZ;

        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        // Scale
        const newDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = newDistance / lastTouchDistance;
        selectedModel.scale.multiplyScalar(scale);
        lastTouchDistance = newDistance;

        // Rotate
        const newAngle = getAngle(e.touches[0], e.touches[1]);
        const deltaAngle = newAngle - initialRotation;
        selectedModel.rotation.y += deltaAngle * 0.01;
        initialRotation = newAngle;
      }

      e.preventDefault();
    });
  }

  function getDistance(touch1, touch2) {
    return Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
  }

  function getAngle(touch1, touch2) {
    return Math.atan2(
      touch2.clientY - touch1.clientY,
      touch2.clientX - touch1.clientX
    );
  }

  function animate() {
    renderer.setAnimationLoop(render);
  }

  function render(timestamp, frame) {
    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      if (!hitTestSourceRequested) {
        session.requestReferenceSpace("viewer").then((refSpace) => {
          session.requestHitTestSource({ space: refSpace }).then((source) => {
            hitTestSource = source;
          });
        });

        session.addEventListener("end", () => {
          hitTestSourceRequested = false;
          hitTestSource = null;
        });

        hitTestSourceRequested = true;
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length) {
          const hit = hitTestResults[0];
          reticle.visible = true;
          reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
        } else {
          reticle.visible = false;
        }
      }
    }

    renderer.render(scene, camera);
  }

  return <div className="App"></div>;
}

export default App;
