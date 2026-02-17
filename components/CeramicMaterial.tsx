import React, { useMemo } from 'react';
import { MeshPhysicalMaterial, Texture, CanvasTexture, RepeatWrapping } from 'three';
import { MeshPhysicalMaterialProps } from '@react-three/fiber';

// Generate a procedural noise texture for speckles
const generateSpeckleTexture = (): Texture => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    
    // Draw noise
    for (let i = 0; i < 50000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.5;
      const opacity = Math.random() * 0.5 + 0.2;
      
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${opacity})`;
      ctx.fill();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
};

interface CeramicMaterialProps extends MeshPhysicalMaterialProps {
  color?: string;
  useTexture?: boolean;
  attach?: string;
}

export const CeramicMaterial = ({ color = "#EDE8DC", useTexture = true, ...props }: CeramicMaterialProps) => {
  const speckleMap = useMemo(() => generateSpeckleTexture(), []);

  return (
    <meshPhysicalMaterial
      {...props}
      color={color}
      roughness={0.8}
      metalness={0.0}
      clearcoat={0.1}
      clearcoatRoughness={0.4}
      map={useTexture ? speckleMap : undefined} // Use map for base color variation
      aoMapIntensity={1.5}
      dithering={true} // Smoother gradients
    />
  );
};