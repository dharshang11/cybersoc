"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreatGlobeProps {
  attackCount: number;
  connectionCount: number;
}

export default function ThreatGlobe({ attackCount, connectionCount }: ThreatGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    globe: THREE.Mesh;
    lines: THREE.Line[];
    particles: THREE.Points;
    animationId: number;
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 3.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Globe wireframe
    const globeGeom = new THREE.SphereGeometry(1, 40, 40);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0xff1a1a,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const globe = new THREE.Mesh(globeGeom, globeMat);
    scene.add(globe);

    // Inner glow sphere
    const glowGeom = new THREE.SphereGeometry(0.98, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x330000,
      transparent: true,
      opacity: 0.4,
    });
    const glowSphere = new THREE.Mesh(glowGeom, glowMat);
    scene.add(glowSphere);

    // Continent dots (simplified world map points)
    const dotPositions: [number, number][] = [
      // North America
      [40, -100], [35, -90], [45, -75], [30, -95], [48, -120], [25, -80],
      [42, -88], [38, -77], [34, -118], [47, -122], [33, -112], [29, -98],
      // South America
      [-15, -47], [-23, -43], [-34, -58], [-12, -77], [4, -74], [-33, -70],
      [-22, -65], [-8, -35], [-1, -78],
      // Europe
      [51, 0], [48, 2], [52, 13], [40, -4], [41, 12], [59, 18],
      [55, 37], [50, 14], [47, 19], [60, 25], [45, 9], [38, 24],
      // Africa
      [30, 31], [6, 3], [-1, 37], [-26, 28], [34, 9], [12, 15],
      [9, 38], [-4, 15], [-18, 25], [0, 32],
      // Asia
      [35, 139], [37, 127], [39, 116], [28, 77], [13, 100], [1, 104],
      [31, 121], [22, 114], [55, 83], [43, 132], [25, 121], [35, 51],
      // Australia
      [-34, 151], [-38, 145], [-27, 153], [-32, 116], [-17, 146],
    ];

    const dotGroup = new THREE.Group();
    dotPositions.forEach(([lat, lon]) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const x = -(1.01) * Math.sin(phi) * Math.cos(theta);
      const y = (1.01) * Math.cos(phi);
      const z = (1.01) * Math.sin(phi) * Math.sin(theta);
      const dotGeom = new THREE.SphereGeometry(0.012, 6, 6);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.set(x, y, z);
      dotGroup.add(dot);
    });
    scene.add(dotGroup);

    // Attack arc lines
    const lines: THREE.Line[] = [];
    function createAttackArc() {
      const from = dotPositions[Math.floor(Math.random() * dotPositions.length)];
      const to = dotPositions[Math.floor(Math.random() * dotPositions.length)];
      if (from === to) return;

      const fromPhi = (90 - from[0]) * (Math.PI / 180);
      const fromTheta = (from[1] + 180) * (Math.PI / 180);
      const toPhi = (90 - to[0]) * (Math.PI / 180);
      const toTheta = (to[1] + 180) * (Math.PI / 180);

      const fromVec = new THREE.Vector3(
        -(1.01) * Math.sin(fromPhi) * Math.cos(fromTheta),
        (1.01) * Math.cos(fromPhi),
        (1.01) * Math.sin(fromPhi) * Math.sin(fromTheta)
      );
      const toVec = new THREE.Vector3(
        -(1.01) * Math.sin(toPhi) * Math.cos(toTheta),
        (1.01) * Math.cos(toPhi),
        (1.01) * Math.sin(toPhi) * Math.sin(toTheta)
      );

      const mid = fromVec.clone().add(toVec).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(1.5 + Math.random() * 0.5);

      const curve = new THREE.QuadraticBezierCurve3(fromVec, mid, toVec);
      const points = curve.getPoints(30);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(0, 1, 0.5 + Math.random() * 0.3),
        transparent: true,
        opacity: 0.6,
      });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      lines.push(line);

      // Auto-remove after a while
      setTimeout(() => {
        scene.remove(line);
        geometry.dispose();
        material.dispose();
        const idx = lines.indexOf(line);
        if (idx > -1) lines.splice(idx, 1);
      }, 3000 + Math.random() * 4000);
    }

    // Star particles background
    const starGeom = new THREE.BufferGeometry();
    const starCount = 1500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 20;
      starPositions[i + 1] = (Math.random() - 0.5) * 20;
      starPositions[i + 2] = (Math.random() - 0.5) * 20;
    }
    starGeom.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xff4444,
      size: 0.02,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(starGeom, starMat);
    scene.add(particles);

    // Orbital ring
    const ringGeom = new THREE.TorusGeometry(1.4, 0.005, 8, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.3 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 3;
    scene.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.003, 8, 100),
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.15 })
    );
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.y = Math.PI / 6;
    scene.add(ring2);

    // Animation
    let frame = 0;
    function animate() {
      frame++;
      globe.rotation.y += 0.003;
      glowSphere.rotation.y += 0.003;
      dotGroup.rotation.y += 0.003;
      ring.rotation.z += 0.002;
      ring2.rotation.z -= 0.001;
      particles.rotation.y += 0.0003;

      // Spawn attack arcs periodically
      if (frame % 40 === 0) {
        createAttackArc();
      }

      renderer.render(scene, camera);
      sceneRef.current!.animationId = requestAnimationFrame(animate);
    }

    sceneRef.current = { renderer, scene, camera, globe, lines, particles, animationId: 0 };
    animate();

    // Handle resize
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    />
  );
}
