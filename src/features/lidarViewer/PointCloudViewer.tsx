/**
 * PointCloudViewer.tsx
 *
 * 3D point-cloud viewer built on @react-three/fiber + @react-three/drei.
 *
 * Renders an interleaved Float32Array of [x, y, z, ...] vertex positions as a
 * Three.js Points object.  OrbitControls allow the user to orbit, pan, and zoom
 * around the cloud on desktop and mobile.
 *
 * Usage:
 *   <PointCloudViewer positions={float32Array} vertexCount={n} />
 *
 * The viewer auto-centres the cloud and scales the camera so the full extent
 * is visible on first load.
 */

import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ─── Auto-fit camera helper ───────────────────────────────────────────────────

interface PointsSceneProps {
  positions: Float32Array;
}

function PointsScene({ positions }: PointsSceneProps) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!geoRef.current) return;

    // Compute bounding sphere for auto-fit
    geoRef.current.computeBoundingSphere();
    const sphere = geoRef.current.boundingSphere;
    if (!sphere) return;

    // Position camera so the bounding sphere fills ~70% of the frustum
    const perspCam = camera as THREE.PerspectiveCamera;
    const fovRad = (perspCam.fov * Math.PI) / 180;
    const distance = sphere.radius / Math.sin(fovRad / 2) * 1.2;
    camera.position.set(
      sphere.center.x,
      sphere.center.y + sphere.radius * 0.5,
      sphere.center.z + distance,
    );
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
  }, [positions, camera]);

  return (
    <points>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#6366f1"
        sizeAttenuation
        transparent
        opacity={0.85}
      />
    </points>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface PointCloudViewerProps {
  /** Interleaved Float32Array: [x0, y0, z0, x1, y1, z1, …] */
  positions: Float32Array;
  vertexCount: number;
  /** CSS height of the canvas — defaults to '100%'. */
  height?: string;
  className?: string;
  /**
   * Enable WebGL anti-aliasing.  Defaults to false for battery efficiency on
   * mobile; set to true when rendering on a high-performance GPU.
   */
  antialias?: boolean;
  /**
   * GPU power preference hint passed to the WebGL context.
   * Defaults to 'low-power' (mobile-friendly); use 'high-performance' on
   * workstations for maximum rendering quality.
   */
  powerPreference?: 'default' | 'low-power' | 'high-performance';
}

export default function PointCloudViewer({
  positions,
  vertexCount,
  height = '100%',
  className,
  antialias = false,
  powerPreference = 'low-power',
}: PointCloudViewerProps) {
  return (
    <div
      className={className}
      style={{ width: '100%', height, background: '#0f1117', borderRadius: 8, overflow: 'hidden' }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.01, far: 10000, position: [0, 0, 5] }}
        gl={{ antialias, powerPreference }}
      >
        <ambientLight intensity={0.4} />
        <PointsScene positions={positions} />
        <OrbitControls enableDamping dampingFactor={0.07} />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 14,
          fontSize: 11,
          color: '#6b7280',
          pointerEvents: 'none',
        }}
      >
        {vertexCount.toLocaleString()} points
      </div>
    </div>
  );
}
