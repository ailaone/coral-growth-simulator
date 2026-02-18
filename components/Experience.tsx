import React, { Suspense, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom, Vignette } from '@react-three/postprocessing';
import { Coral } from './Coral';
import { useStore } from '../store';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Vector3, PerspectiveCamera } from 'three';

export const Experience: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const handleZoomExtents = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const { focusCenter, focusRadius } = useStore.getState();
    const target = new Vector3(...focusCenter);
    const camera = controls.object as PerspectiveCamera;

    // Keep current viewing direction, adjust distance to frame the coral
    const direction = new Vector3()
      .subVectors(camera.position, controls.target)
      .normalize();
    const fovRad = camera.fov * (Math.PI / 180);
    const distance = focusRadius / Math.tan(fovRad / 2) * 1.1;

    controls.target.copy(target);
    camera.position.copy(target).add(direction.multiplyScalar(distance));
    controls.update();
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      {/* Zoom Extents button */}
      <button
        onClick={handleZoomExtents}
        title="Zoom on Coral"
        className="absolute top-6 right-[340px] z-20 pointer-events-auto w-9 h-9 flex items-center justify-center border border-[#C9C5BA] bg-[#F5F5F0]/80 backdrop-blur-sm hover:bg-[#1A1A1A] hover:text-[#F5F5F0] hover:border-[#1A1A1A] transition-colors text-[#1A1A1A]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6V2h4" />
          <path d="M14 6V2h-4" />
          <path d="M2 10v4h4" />
          <path d="M14 10v4h-4" />
        </svg>
      </button>

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
