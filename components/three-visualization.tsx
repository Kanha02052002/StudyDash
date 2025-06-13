"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Text, OrbitControls } from "@react-three/drei"
import * as THREE from "three"

interface Topic {
  name: string
  completed: boolean
  materials: any[]
  notes: string
}

interface Module {
  module_number: number
  module_name: string
  topics: Topic[]
  completed: boolean
}

interface CourseData {
  course_name: string
  course_code: string
  modules: Module[]
}

interface ThreeVisualizationProps {
  courseData: CourseData
}

// Define our color palette with brighter colors
const COLORS = {
  emeraldGreen: "#10ff9f", // Bright emerald green
  sapphireBlue: "#4287f5", // Bright sapphire blue
  rubyRed: "#ff3366", // Bright ruby red
  amberYellow: "#ffbf00", // Bright amber yellow
  purpleViolet: "#9966ff", // Bright purple violet
  background: "#111827", // Dark background
  text: "#ffffff", // White text
  lines: "#6699ff", // Bright blue for lines
}

function CourseNode({ position, text }: { position: [number, number, number]; text: string }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={COLORS.amberYellow}
          emissive={COLORS.amberYellow}
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      <Text position={[0, -1, 0]} fontSize={0.3} color={COLORS.text} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  )
}

function ModuleNode({
  position,
  text,
  isCompleted,
}: { position: [number, number, number]; text: string; isCompleted: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial
          color={isCompleted ? COLORS.emeraldGreen : COLORS.sapphireBlue}
          emissive={isCompleted ? COLORS.emeraldGreen : COLORS.sapphireBlue}
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      <Text position={[0, -0.8, 0]} fontSize={0.25} color={COLORS.text} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  )
}

function TopicNode({
  position,
  text,
  isCompleted,
}: { position: [number, number, number]; text: string; isCompleted: boolean }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial
          color={isCompleted ? COLORS.emeraldGreen : COLORS.rubyRed}
          emissive={isCompleted ? COLORS.emeraldGreen : COLORS.rubyRed}
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      <Text position={[0, -0.4, 0]} fontSize={0.15} color={COLORS.text} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  )
}

function ConnectionLine({
  start,
  end,
  color = COLORS.lines,
}: { start: [number, number, number]; end: [number, number, number]; color?: string }) {
  const geometry = useMemo(() => {
    const points = []
    points.push(new THREE.Vector3(start[0], start[1], start[2]))
    points.push(new THREE.Vector3(end[0], end[1], end[2]))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [start, end])

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={1} />
    </line>
  )
}

function Scene({ courseData }: { courseData: CourseData }) {
  const centerPosition: [number, number, number] = [0, 0, 0]

  // Validate and sanitize courseData
  const validatedData = useMemo(() => {
    if (!courseData || !courseData.modules || !Array.isArray(courseData.modules)) {
      return {
        course_name: "Loading...",
        course_code: "",
        modules: [],
      }
    }

    return {
      ...courseData,
      modules: courseData.modules
        .filter((module) => module && typeof module === "object" && module.module_name && Array.isArray(module.topics))
        .map((module) => ({
          ...module,
          topics: module.topics.filter((topic) => topic && typeof topic === "object" && topic.name),
        })),
    }
  }, [courseData])

  const { nodes, connections } = useMemo(() => {
    const nodes: JSX.Element[] = []
    const connections: JSX.Element[] = []

    // Add center node
    nodes.push(<CourseNode key="center" position={centerPosition} text={validatedData.course_name} />)

    if (validatedData.modules.length === 0) {
      return { nodes, connections }
    }

    // Calculate module positions
    const moduleRadius = 4
    validatedData.modules.forEach((module, moduleIndex) => {
      const angle = (moduleIndex / validatedData.modules.length) * Math.PI * 2
      const x = Math.cos(angle) * moduleRadius
      const z = Math.sin(angle) * moduleRadius
      const modulePosition: [number, number, number] = [x, 0, z]

      // Add module node
      nodes.push(
        <ModuleNode
          key={`module-${moduleIndex}`}
          position={modulePosition}
          text={`M${module.module_number || moduleIndex + 1}: ${module.module_name.substring(0, 15)}${module.module_name.length > 15 ? "..." : ""}`}
          isCompleted={module.completed || false}
        />,
      )

      // Add connection from center to module
      connections.push(
        <ConnectionLine
          key={`conn-center-${moduleIndex}`}
          start={centerPosition}
          end={modulePosition}
          color={COLORS.purpleViolet}
        />,
      )

      // Add topic nodes
      module.topics.forEach((topic, topicIndex) => {
        // Limit the number of topics displayed to avoid overcrowding
        if (topicIndex < 8) {
          const topicRadius = 2
          const topicAngle = (topicIndex / Math.min(8, module.topics.length)) * Math.PI * 2
          const topicX = x + Math.cos(topicAngle) * topicRadius
          const topicZ = z + Math.sin(topicAngle) * topicRadius
          const topicPosition: [number, number, number] = [topicX, 0, topicZ]

          nodes.push(
            <TopicNode
              key={`topic-${moduleIndex}-${topicIndex}`}
              position={topicPosition}
              text={topic.name.substring(0, 12) + (topic.name.length > 12 ? "..." : "")}
              isCompleted={topic.completed}
            />,
          )

          connections.push(
            <ConnectionLine
              key={`conn-module-${moduleIndex}-${topicIndex}`}
              start={modulePosition}
              end={topicPosition}
            />,
          )
        }
      })
    })

    return { nodes, connections }
  }, [validatedData, centerPosition])

  return (
    <>
      <color attach="background" args={[COLORS.background]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color={COLORS.lines} />
      {nodes}
      {connections}
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
    </>
  )
}

export default function ThreeVisualization({ courseData }: ThreeVisualizationProps) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <Scene courseData={courseData} />
      </Canvas>
    </div>
  )
}
