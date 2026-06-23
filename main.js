import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

/* =========================================================
   MENU
========================================================= */

const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');

menuToggle?.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';

  menuToggle.setAttribute('aria-expanded', String(!expanded));
  siteNav.classList.toggle('open');
});

/* =========================================================
   FADE IN
========================================================= */

const fadeElements = document.querySelectorAll('.fade-in');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);

fadeElements.forEach((el) => {
  observer.observe(el);
});

/* =========================================================
   THREE JS
========================================================= */

const canvas = document.getElementById('water-canvas');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const uniforms = {
  uTime: { value: 0 },
  uLevel: { value: 0 },
  uDirty: { value: 0 },
};

const overlay =
  document.getElementById(
    'pollution-overlay'
  );

const resetButton =
  document.getElementById(
    'reset-water'
  );

let floodCompleted = false;
let score = 0;
let gameInterval;

function startGame() {
  if (gameInterval) return;
  gameInterval = setInterval(spawnTrash, 800);
}

const material = new THREE.ShaderMaterial({
  transparent: true,
  uniforms,
  vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position =
          projectionMatrix *
          modelViewMatrix *
          vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      varying vec2 vUv;

      uniform float uTime;
      uniform float uLevel;
      uniform float uDirty;

      float wave(vec2 uv) {
        return
          sin(uv.x * 8.0 + uTime * 1.5) * 0.02 +
          sin(uv.x * 18.0 - uTime * 1.2) * 0.01 +
          sin(uv.x * 32.0 + uTime * 0.6) * 0.006;
      }

      float random(vec2 st) {
        return fract(
          sin(dot(
            st.xy,
            vec2(12.9898, 78.233)
          )) * 43758.5453123
        );
      }

      void main() {
        vec2 uv = vUv;

        /* =========================================
           AGORA A ÁGUA SOBE CORRETAMENTE
        ========================================= */

        float waterHeight = uLevel;
        float surface = waterHeight + wave(uv);

        if (uv.y > surface) {
          discard;
        }

        vec3 clean = vec3(0.58, 0.82, 0.95);
        vec3 dirty = vec3(0.36, 0.24, 0.11);
        vec3 color = mix(clean, dirty, uDirty);

        float dirt = random(vec2(uv.x * 18.0, uv.y * 18.0));
        color -= dirt * uDirty * 0.12;

        float foam = smoothstep(surface, surface + 0.015, uv.y);
        color += foam * 0.15;

        float alpha = 0.45 + uDirty * 0.35;
        gl_FragColor = vec4(color, alpha);
      }
    `,
});

const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

/* =========================================================
   SCROLL
========================================================= */

function updateScroll() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY;
  const max = Math.max(doc.scrollHeight - window.innerHeight, 1);
  const ratio = Math.min(1, scrollTop / max);

  uniforms.uLevel.value = Math.min(ratio, 0.98);
  uniforms.uDirty.value = ratio;

  if (ratio > 0.3) {
    document.body.classList.add('polluted');
  } else {
    document.body.classList.remove('polluted');
  }

  updateWater();
}

function updateWater() {

  if (floodCompleted) return;

  const scrollTop = window.scrollY;

  const maxScroll = Math.max(
    document.documentElement.scrollHeight -
    window.innerHeight,
    1
  );

  const progress = Math.min(
    scrollTop / maxScroll,
    1
  );

  if (progress >= 0.95) {

    overlay.classList.add('active');

    floodCompleted = true;
  }
}

window.addEventListener('scroll', updateScroll, { passive: true });

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateScroll();
});

/* =========================================================
   ANIMATE
========================================================= */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}

/* =========================================================
   RESET
========================================================= */

resetButton.addEventListener('click', () => {

  resetButton.style.display = 'none';

  overlay.querySelector('h2').textContent =
    'Vamos despoluir o rio?';

  overlay.querySelector('.overlay-intro').textContent =
    'Clique nos resíduos que aparecem na água para limpá-la.';

  startGame();

});

const scoreBox =
  document.getElementById('score');

const trashContainer =
  document.getElementById('trash-container');

const trashItems = [
  '🧴',
  '🥤',
  '🍾',
  '🛍️',
  '🗑️',
  '🛢️'
];

startGame();

function spawnTrash() {

  const trash =
    document.createElement('div');

  trash.className = 'trash';

  trash.textContent =

    trashItems[
      Math.floor(
        Math.random() *
        trashItems.length
      )
    ];

  trash.style.left =
    Math.random() * 90 + '%';

  trash.style.bottom = '-50px';

  trash.style.animationDuration =
    (5 + Math.random() * 4) + 's';

  trash.addEventListener(
    'click',
    () => {

      score += 10;

      scoreBox.textContent =
        score;

      trash.remove();

      uniforms.uDirty.value =
        Math.max(
          0,
          uniforms.uDirty.value - 0.05
        );

      showPoints(
        trash.style.left
      );

      if (score >= 100) {

        finishCleanup();
      }

    }
  );

  trashContainer.appendChild(trash);

  setTimeout(() => {

    trash.remove();

  }, 10000);
}
function showPoints(left) {

  const pop =
    document.createElement('div');

  pop.className =
    'score-pop';

  pop.textContent =
    '+10';

  pop.style.left =
    left;

  pop.style.bottom =
    '120px';

  document.body.appendChild(pop);

  setTimeout(() => {

    pop.remove();

  }, 1000);
}
function finishCleanup() {

  clearInterval(
    gameInterval
  );

  overlay.innerHTML = `

    <div class="overlay-content">

      <h2>
        Rio recuperado!
      </h2>

      <p>
        Pequenas atitudes geram
        grandes transformações.
      </p>

    </div>

  `;

  setTimeout(() => {

    overlay.classList.remove(
      'active'
    );


    canvas.style.transition =
      'opacity 1.5s ease';

    canvas.style.opacity = '0';

  }, 2500);
}

updateScroll();
animate();