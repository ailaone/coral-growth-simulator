import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom, Vignette } from '@react-three/postprocessing';
import { Coral } from './Coral';

export const Experience: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, 60], fov: 35 }}
        gl={{ antialias: false, stencil: false, depth: true }} // Optimization for postprocessing
      >
        <color attach="background" args={['#F5F5F0']} />
        
        <Suspense fallback={null}>
          <group position={[0, -15, 0]}>
             <Coral />
          </group>

          {/* Lighting Environment */}
          <ambientLight intensity={0.8} color="#ffffff" />
          <directionalLight
            position={[30, 40, 30]}
            intensity={1.5}
            castShadow
            shadow-bias={-0.0001}
            color="#ffffff"
          />
          <directionalLight
            position={[-20, 20, -20]}
            intensity={0.8}
            color="#ffffff"
          />
          
          <ContactShadows 
            position={[0, -15, 0]}
            resolution={1024} 
            scale={100} 
            blur={2} 
            opacity={0.5} 
            far={10} 
            color="#1A1A1A" 
          />

          <EffectComposer multisampling={2}>
            <SSAO 
              radius={0.05} 
              intensity={100} 
              luminanceInfluence={0.5} 
              color="#1A1A1A" 
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
          autoRotate={false}
          enablePan={false}
          minDistance={20}
          maxDistance={150}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
};