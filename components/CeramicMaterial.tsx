import React from 'react';
import { MeshPhysicalMaterialProps } from '@react-three/fiber';
import { DoubleSide } from 'three';

interface CeramicMaterialProps extends MeshPhysicalMaterialProps {
  color?: string;
  useTexture?: boolean;
  attach?: string;
}

export const CeramicMaterial = ({ color = "#EDE8DC", useTexture, ...props }: CeramicMaterialProps) => {
  return (
    <meshPhysicalMaterial
      {...props}
      color={color}
      roughness={0.8}
      metalness={0.0}
      clearcoat={0.1}
      clearcoatRoughness={0.4}
      dithering={true}
      side={DoubleSide}
    />
  );
};
