import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SimStatus, Vector3 } from '../types';

interface SimCanvasProps {
  status: SimStatus;
  enemyStartPos: Vector3;
  interceptorStartPos: Vector3;
  onUpdateStats: (dist: number, vel: number) => void;
  onSimEnd: (finalStatus: SimStatus) => void;
}

const SimCanvas: React.FC<SimCanvasProps> = ({ 
  status, 
  enemyStartPos, 
  interceptorStartPos, 
  onUpdateStats, 
  onSimEnd 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  
  // Physics refs
  const worldRef = useRef<CANNON.World | null>(null);
  const enemyBodyRef = useRef<CANNON.Body | null>(null);
  const interceptorBodyRef = useRef<CANNON.Body | null>(null);
  
  // 3D Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const enemyMeshRef = useRef<THREE.Mesh | null>(null);
  const interceptorMeshRef = useRef<THREE.Mesh | null>(null);
  
  // 2D Refs
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Particles
  const particleSystemRef = useRef<{ pos: THREE.Vector3, vel: THREE.Vector3, life: number, mesh?: THREE.Mesh }[]>([]);

  // Config
  const SOLDIER_POS = new CANNON.Vec3(0, 1, 0);

  useEffect(() => {
    if (!mountRef.current) return;

    // Detect if WebGL works
    let useWebGL = true;
    let width = window.innerWidth;
    let height = window.innerHeight;

    // --- INIT PHYSICS (Always runs) ---
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    worldRef.current = world;

    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    // --- ATTEMPT WEBGL INIT ---
    try {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050505);
        scene.fog = new THREE.FogExp2(0x050505, 0.02);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
        camera.position.set(0, 15, 25);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Force failIfMajorPerformanceCaveat to true to detect software rendering/crashes early if needed
        // But here we want to catch the crash.
        const renderer = new THREE.WebGLRenderer({ antialias: true, failIfMajorPerformanceCaveat: false });
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);

        // Grid
        const gridHelper = new THREE.GridHelper(100, 50, 0x00ff00, 0x112211);
        scene.add(gridHelper);
        
        // Soldier 3D
        const soldierGeo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const soldierMat = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const soldierMesh = new THREE.Mesh(soldierGeo, soldierMat);
        soldierMesh.position.set(0, 1, 0);
        scene.add(soldierMesh);

    } catch (e) {
        console.warn("WebGL Init Failed, switching to 2D Canvas Fallback.", e);
        useWebGL = false;
        
        // Clean up any failed DOM elements
        if (mountRef.current.firstChild) mountRef.current.innerHTML = '';

        const cvs = document.createElement('canvas');
        cvs.width = width;
        cvs.height = height;
        mountRef.current.appendChild(cvs);
        canvas2dRef.current = cvs;
        ctxRef.current = cvs.getContext('2d');
    }

    // --- PARTICLE HELPERS ---
    const createExplosion = (pos: CANNON.Vec3) => {
        if (useWebGL && sceneRef.current) {
            const geo = new THREE.SphereGeometry(0.2);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            for(let i=0; i<15; i++) {
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.copy(pos as unknown as THREE.Vector3);
                sceneRef.current.add(mesh);
                particleSystemRef.current.push({
                    mesh,
                    pos: mesh.position, // ref
                    vel: new THREE.Vector3((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10),
                    life: 1.0
                });
            }
        } else {
            // 2D particles
            for(let i=0; i<15; i++) {
                 particleSystemRef.current.push({
                    pos: new THREE.Vector3(pos.x, pos.y, pos.z),
                    vel: new THREE.Vector3((Math.random()-0.5)*10, 0, (Math.random()-0.5)*10),
                    life: 1.0
                });
            }
        }
    };

    const updateParticles = (ctx2d: CanvasRenderingContext2D | null, scale: number, cx: number, cy: number) => {
        for (let i = particleSystemRef.current.length - 1; i >= 0; i--) {
            const p = particleSystemRef.current[i];
            
            if (useWebGL && p.mesh) {
                // 3D Update
                p.mesh.position.add(p.vel.clone().multiplyScalar(0.02));
                p.life -= 0.02;
                p.mesh.scale.setScalar(p.life);
                if (p.life <= 0) {
                    sceneRef.current?.remove(p.mesh);
                    particleSystemRef.current.splice(i, 1);
                }
            } else if (!useWebGL) {
                // 2D Update
                p.pos.x += p.vel.x * 0.02;
                p.pos.z += p.vel.z * 0.02;
                p.life -= 0.02;
                
                if (p.life <= 0) {
                    particleSystemRef.current.splice(i, 1);
                } else if (ctx2d) {
                    ctx2d.fillStyle = `rgba(255, 170, 0, ${p.life})`;
                    ctx2d.beginPath();
                    ctx2d.arc(cx + p.pos.x*scale, cy + p.pos.z*scale, Math.max(1, p.life * scale * 0.5), 0, Math.PI*2);
                    ctx2d.fill();
                }
            }
        }
    };

    // --- SPAWN DRONES ---
    const spawnDrones = () => {
      if (!worldRef.current) return;
      
      // Cleanup Physics
      if (enemyBodyRef.current) worldRef.current.removeBody(enemyBodyRef.current);
      if (interceptorBodyRef.current) worldRef.current.removeBody(interceptorBodyRef.current);
      
      // Cleanup Visuals
      if (useWebGL && sceneRef.current) {
         if (enemyMeshRef.current) sceneRef.current.remove(enemyMeshRef.current);
         if (interceptorMeshRef.current) sceneRef.current.remove(interceptorMeshRef.current);
      }

      // Bodies
      const eShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.2, 0.5));
      const eBody = new CANNON.Body({ mass: 1, shape: eShape, linearDamping: 0.5 });
      eBody.position.set(enemyStartPos.x, enemyStartPos.y, enemyStartPos.z);
      worldRef.current.addBody(eBody);
      enemyBodyRef.current = eBody;

      const iShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.2, 0.5));
      const iBody = new CANNON.Body({ mass: 1, shape: iShape, linearDamping: 0.5 });
      iBody.position.set(interceptorStartPos.x, interceptorStartPos.y, interceptorStartPos.z);
      worldRef.current.addBody(iBody);
      interceptorBodyRef.current = iBody;

      // Meshes (Only if WebGL)
      if (useWebGL && sceneRef.current) {
        const eMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        sceneRef.current.add(eMesh);
        enemyMeshRef.current = eMesh;

        const iMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1), new THREE.MeshStandardMaterial({ color: 0x00ffff }));
        sceneRef.current.add(iMesh);
        interceptorMeshRef.current = iMesh;
      }
    };

    spawnDrones();

    // --- ANIMATION LOOP ---
    const clock = new THREE.Clock();
    let frameCount = 0;

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);

      if (status === SimStatus.ACTIVE && worldRef.current && enemyBodyRef.current && interceptorBodyRef.current) {
        worldRef.current.step(1 / 60, dt, 3);

        const eBody = enemyBodyRef.current;
        const iBody = interceptorBodyRef.current;

        // --- AI LOGIC ---
        // Enemy seeks Soldier
        const enemyDir = SOLDIER_POS.vsub(eBody.position);
        enemyDir.normalize();
        eBody.applyForce(enemyDir.scale(25), eBody.position);

        // Interceptor seeks Enemy (Lead Pursuit)
        const intDir = eBody.position.vsub(iBody.position);
        intDir.normalize();
        iBody.applyForce(intDir.scale(40), iBody.position);

        // Anti-Gravity
        eBody.applyForce(new CANNON.Vec3(0, 9.82, 0), eBody.position);
        iBody.applyForce(new CANNON.Vec3(0, 9.82, 0), iBody.position);

        // Stats
        const dist = eBody.position.distanceTo(iBody.position);
        if (frameCount++ % 5 === 0) {
           onUpdateStats(dist, iBody.velocity.length());
        }

        // Check End Conditions
        if (dist < 1.5) {
            createExplosion(eBody.position);
            if (useWebGL && sceneRef.current) {
                 if (enemyMeshRef.current) sceneRef.current.remove(enemyMeshRef.current);
                 if (interceptorMeshRef.current) sceneRef.current.remove(interceptorMeshRef.current);
            }
            onSimEnd(SimStatus.SUCCESS);
        } else if (eBody.position.distanceTo(SOLDIER_POS) < 2.0) {
            createExplosion(SOLDIER_POS);
            onSimEnd(SimStatus.FAILURE);
        }
      }

      // --- RENDER ---
      if (useWebGL && rendererRef.current && sceneRef.current && cameraRef.current) {
          // Sync Meshes
          if (enemyBodyRef.current && enemyMeshRef.current) {
            enemyMeshRef.current.position.copy(enemyBodyRef.current.position as unknown as THREE.Vector3);
            enemyMeshRef.current.quaternion.copy(enemyBodyRef.current.quaternion as unknown as THREE.Quaternion);
          }
          if (interceptorBodyRef.current && interceptorMeshRef.current) {
            interceptorMeshRef.current.position.copy(interceptorBodyRef.current.position as unknown as THREE.Vector3);
            interceptorMeshRef.current.quaternion.copy(interceptorBodyRef.current.quaternion as unknown as THREE.Quaternion);
          }
          
          updateParticles(null, 0, 0, 0);
          rendererRef.current.render(sceneRef.current, cameraRef.current);

      } else if (!useWebGL && ctxRef.current && canvas2dRef.current) {
          // 2D Fallback
          const ctx = ctxRef.current;
          const w = canvas2dRef.current.width;
          const h = canvas2dRef.current.height;
          const cx = w / 2;
          const cy = h / 2 + 100;
          const scale = 15;

          // Clear
          ctx.fillStyle = '#050505';
          ctx.fillRect(0,0,w,h);

          // Grid
          ctx.strokeStyle = '#112211';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for(let x=-50; x<=50; x+=5) { ctx.moveTo(cx+x*scale, 0); ctx.lineTo(cx+x*scale, h); }
          for(let z=-50; z<=50; z+=5) { ctx.moveTo(0, cy+z*scale); ctx.lineTo(w, cy+z*scale); }
          ctx.stroke();

          // Soldier
          ctx.fillStyle = '#00ff00';
          ctx.beginPath();
          ctx.arc(cx, cy, 0.5*scale, 0, Math.PI*2);
          ctx.fill();
          ctx.font = '10px monospace';
          ctx.fillText("HQ", cx-5, cy-10);

          // Drones
          if (enemyBodyRef.current && (status === SimStatus.ACTIVE || status === SimStatus.IDLE)) {
             const pos = enemyBodyRef.current.position;
             // Hide if successful intercept and close to interceptor
             const isDestroyed = status === SimStatus.SUCCESS && pos.distanceTo(SOLDIER_POS) > 5;
             
             if (!isDestroyed) {
                ctx.fillStyle = 'red';
                ctx.fillRect(cx + (pos.x - 0.5)*scale, cy + (pos.z - 0.5)*scale, 1*scale, 1*scale);
             }
          }
          if (interceptorBodyRef.current && (status === SimStatus.ACTIVE || status === SimStatus.IDLE)) {
             const pos = interceptorBodyRef.current.position;
             const isDestroyed = status === SimStatus.SUCCESS && pos.distanceTo(SOLDIER_POS) > 5;

             if (!isDestroyed) {
                ctx.fillStyle = 'cyan';
                ctx.fillRect(cx + (pos.x - 0.5)*scale, cy + (pos.z - 0.5)*scale, 1*scale, 1*scale);
             }
          }

          updateParticles(ctx, scale, cx, cy);
      }
    };

    animate();

    const handleResize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        if (useWebGL && cameraRef.current && rendererRef.current) {
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
        } else if (canvas2dRef.current) {
            canvas2dRef.current.width = width;
            canvas2dRef.current.height = height;
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current!);
      if (rendererRef.current) rendererRef.current.dispose();
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
  }, []); // Run once on mount

  // Handle Prop Changes (Reset)
  useEffect(() => {
     if (worldRef.current && enemyBodyRef.current && interceptorBodyRef.current) {
        enemyBodyRef.current.position.set(enemyStartPos.x, enemyStartPos.y, enemyStartPos.z);
        enemyBodyRef.current.velocity.set(0,0,0);
        enemyBodyRef.current.angularVelocity.set(0,0,0);

        interceptorBodyRef.current.position.set(interceptorStartPos.x, interceptorStartPos.y, interceptorStartPos.z);
        interceptorBodyRef.current.velocity.set(0,0,0);
        interceptorBodyRef.current.angularVelocity.set(0,0,0);
        
        // Reset Visuals visibility
        if (sceneRef.current && enemyMeshRef.current && interceptorMeshRef.current) {
            sceneRef.current.add(enemyMeshRef.current);
            sceneRef.current.add(interceptorMeshRef.current);
        }
     }
  }, [enemyStartPos, interceptorStartPos]);

  return <div ref={mountRef} className="absolute inset-0" />;
};

export default SimCanvas;
