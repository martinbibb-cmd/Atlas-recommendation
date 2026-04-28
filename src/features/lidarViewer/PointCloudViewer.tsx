/**
 * PointCloudViewer.tsx
 *
 * 3D point-cloud viewer built on @react-three/fiber + @react-three/drei.
 *
 * Renders an interleaved Float32Array of [x, y, z, ...] vertex positions as a
 * Three.js Points object.  OrbitControls allow the user to orbit, pan, and zoom
 * around the cloud on desktop and mobile.
 *
 * Optional `rooms` prop overlays translucent bounding-box helpers per room so
 * the engineer can visually correlate detected spaces with the point cloud.
 *
 * Usage:
 *   <PointCloudViewer positions={float32Array} vertexCount={n} />
 *
 * The viewer auto-centres the cloud and scales the camera so the full extent
 * is visible on first load.
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TaggedObject } from '../scanImport/session/propertyScanSession';

// ─── Room bounding-box overlay ────────────────────────────────────────────────

export interface RoomBounds {
  id: string;
  label: string;
  /** Axis-aligned bounding box in scan-space coordinates. */
  boundingBox: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
  /** Highlight this room (e.g. selected in annotation panel). */
  highlighted?: boolean;
}

interface RoomBoxProps {
  room: RoomBounds;
}

function RoomBox({ room }: RoomBoxProps) {
  const { minX, maxX, minY, maxY, minZ, maxZ } = room.boundingBox;
  const width  = Math.max(0.01, maxX - minX);
  const height = Math.max(0.01, maxY - minY);
  const depth  = Math.max(0.01, maxZ - minZ);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const color = room.highlighted ? '#f59e0b' : '#6366f1';
  const opacity = room.highlighted ? 0.18 : 0.08;

  return (
    <group position={[cx, cy, cz]}>
      {/* Translucent fill */}
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {/* Wireframe outline */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color={color} transparent opacity={room.highlighted ? 0.9 : 0.5} />
      </lineSegments>
    </group>
  );
}

// ─── Camera focus imperative handle ──────────────────────────────────────────

export interface PointCloudViewerHandle {
  /** Smoothly move the camera to focus on the given position (world coords). */
  focusOn: (x: number, y: number, z: number) => void;
}

// ─── Tagged object sprite ─────────────────────────────────────────────────────

const OBJ_COLOURS: Record<string, string> = {
  boiler: '#ef4444', cylinder: '#f97316', radiator: '#eab308',
  appliance: '#22c55e', furniture: '#3b82f6', fixture: '#8b5cf6',
};

interface ObjectSpriteProps {
  obj: TaggedObject;
  onUpdate: (updated: TaggedObject) => void;
}

function ObjectSprite({ obj, onUpdate }: ObjectSpriteProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(obj.label);
  const [category, setCategory] = useState(obj.category);
  const colour = OBJ_COLOURS[obj.category.toLowerCase()] ?? '#6b7280';
  const { x, y, z } = obj.position;

  return (
    <group position={[x, y, z]}>
      <mesh onClick={() => setOpen(v => !v)}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={colour} />
      </mesh>
      <Html distanceFactor={10} style={{ pointerEvents: open ? 'all' : 'none', userSelect: 'none' }}>
        {open ? (
          <div style={{
            background: '#1e293b', border: `1px solid ${colour}`, borderRadius: 8,
            padding: '10px 14px', minWidth: 180, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            pointerEvents: 'all',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Edit object</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>
            <input value={label} onChange={e => setLabel(e.target.value)}
              style={{ display: 'block', width: '100%', marginBottom: 6, padding: '3px 6px', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 12, boxSizing: 'border-box' }} />
            <input value={category} onChange={e => setCategory(e.target.value)}
              style={{ display: 'block', width: '100%', marginBottom: 8, padding: '3px 6px', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 12, boxSizing: 'border-box' }} />
            <button
              onClick={() => { onUpdate({ ...obj, label, category }); setOpen(false); }}
              style={{ width: '100%', padding: '4px 0', fontSize: 12, fontWeight: 600, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >Save</button>
          </div>
        ) : (
          <div onClick={() => setOpen(true)} style={{
            background: 'rgba(15,17,23,0.85)', border: `1px solid ${colour}`,
            borderRadius: 4, padding: '2px 6px', fontSize: 11, color: colour,
            cursor: 'pointer', whiteSpace: 'nowrap', pointerEvents: 'all',
          }}>
            {obj.label}
          </div>
        )}
      </Html>
    </group>
  );
}

// Need React for JSX in ObjectSprite — intentionally blank (JSX transform handles it)

// ─── Auto-fit camera helper ───────────────────────────────────────────────────

interface PointsSceneProps {
  positions: Float32Array;
  rooms?: RoomBounds[];
  taggedObjects?: TaggedObject[];
  onObjectUpdate?: (updated: TaggedObject) => void;
  onCameraReady?: (camera: THREE.Camera) => void;
}

function PointsScene({ positions, rooms = [], taggedObjects = [], onObjectUpdate, onCameraReady }: PointsSceneProps) {
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
    onCameraReady?.(camera);
  }, [positions, camera, onCameraReady]);

  return (
    <>
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
      {rooms.map((room) => (
        <RoomBox key={room.id} room={room} />
      ))}
      {taggedObjects.map((obj) => (
        <ObjectSprite key={obj.id} obj={obj} onUpdate={onObjectUpdate ?? (() => {})} />
      ))}
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface PointCloudViewerProps {
  /** Interleaved Float32Array: [x0, y0, z0, x1, y1, z1, …] */
  positions: Float32Array;
  vertexCount: number;
  /** Room bounding-box overlays. */
  rooms?: RoomBounds[];
  /** Tagged objects to render as interactive 3D sprites. */
  taggedObjects?: TaggedObject[];
  /** Called when a tagged object's label/category is edited in the 3D scene. */
  onObjectUpdate?: (updated: TaggedObject) => void;
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

const PointCloudViewer = forwardRef<PointCloudViewerHandle, PointCloudViewerProps>(
  function PointCloudViewer(
    {
      positions,
      vertexCount,
      rooms,
      taggedObjects,
      onObjectUpdate,
      height = '100%',
      className,
      antialias = false,
      powerPreference = 'low-power',
    },
    ref,
  ) {
    const cameraRef = useRef<THREE.Camera | null>(null);

    useImperativeHandle(ref, () => ({
      focusOn(x: number, y: number, z: number) {
        const cam = cameraRef.current;
        if (!cam) return;
        // Offset camera along its current view direction so the target is
        // roughly centred in frame.
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const dist = (cam as THREE.PerspectiveCamera).far
          ? Math.min(5, (cam as THREE.PerspectiveCamera).far * 0.1)
          : 5;
        cam.position.set(x - dir.x * dist, y - dir.y * dist, z - dir.z * dist);
        (cam as THREE.PerspectiveCamera).lookAt?.(x, y, z);
        (cam as THREE.PerspectiveCamera).updateProjectionMatrix?.();
      },
    }));

    return (
      <div
        className={className}
        style={{ width: '100%', height, background: '#0f1117', borderRadius: 8, overflow: 'hidden', position: 'relative' }}
      >
        <Canvas
          camera={{ fov: 50, near: 0.01, far: 10000, position: [0, 0, 5] }}
          gl={{ antialias, powerPreference }}
        >
          <ambientLight intensity={0.4} />
          <PointsScene
            positions={positions}
            rooms={rooms}
            taggedObjects={taggedObjects}
            onObjectUpdate={onObjectUpdate}
            onCameraReady={(cam) => { cameraRef.current = cam; }}
          />
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
  },
);

export default PointCloudViewer;
