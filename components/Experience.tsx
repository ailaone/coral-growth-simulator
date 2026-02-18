import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom, Vignette } from '@react-three/postprocessing';
import { Coral } from './Coral';
import { useStore } from '../store';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Vector3, PerspectiveCamera } from 'three';

export const Experience: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const zoomTrigger = useStore((s) => s.zoomTrigger);
  const focusCenter = useStore((s) => s.focusCenter);
  const focusRadius = useStore((s) => s.focusRadius);

  // Zoom to fit: on manual trigger (button) or when tree regenerates (focusCenter changes)
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const target = new Vector3(...focusCenter);
    const camera = controls.object as PerspectiveCamera;

    const direction = new Vector3()
      .subVectors(camera.position, controls.target)
      .normalize();
    const fovRad = camera.fov * (Math.PI / 180);
    const distance = focusRadius / Math.tan(fovRad / 2) * 1.1;

    controls.target.copy(target);
    camera.position.copy(target).add(direction.multiplyScalar(distance));
    controls.update();
  }, [zoomTrigger, focusCenter, focusRadius]);

  return (
    <div className="absolute inset-0 right-80 z-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 60], fov: 35 }}
        gl={{ antialias: false, stencil: false, depth: true }}
      >
        <color attach="background" args={['#F5F5F0']} />

        <Suspense fallback={null}>
          <group position={[0, -15, 0]}>
             <Coral />
          </group>

          {/* Arctic Lighting — soft, even illumination; SSAO provides depth */}
          <ambientLight intensity={1.2} color="#ffffff" />
          <hemisphereLight args={['#ffffff', '#e8e4de', 0.8]} />
          <directionalLight
            position={[30, 40, 30]}
            intensity={0.4}
            color="#ffffff"
          />
          <directionalLight
            position={[-20, 20, -20]}
            intensity={0.3}
            color="#ffffff"
          />

          <EffectComposer multisampling={2}>
            <SSAO
              radius={0.08}
              intensity={200}
              luminanceInfluence={0.3}
              color="#000000"
            />
            <Bloom
              intensity={0.5}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.9}
            />
            <Vignette eskil={false} offset={0.1} darkness={0.4} />
          </EffectComposer>
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          autoRotate={false}
          enablePan={true}
          minDistance={20}
          maxDistance={150}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
};
