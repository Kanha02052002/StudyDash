"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Upload,
  LinkIcon,
  Trash2,
  RefreshCw,
  FileText,
  ExternalLink,
  StickyNote,
  Download,
  Plus,
  Save,
  ChevronDown,
  ChevronRight,
  Archive,
  Loader2,
  Edit,
  Check,
  X,
  Copy,
  CheckIcon,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ThreeVisualization from "@/components/three-visualization"
import JSZip from "jszip"

interface Topic {
  name: string
  completed: boolean
  materials: Material[]
  notes: string
}

interface Material {
  id: string
  name: string
  type: "file" | "link"
  url: string
  uploadDate: string
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

export default function CourseView() {
  const [courseData, setCourseData] = useState<CourseData | null>(null)
  const [uploadDialog, setUploadDialog] = useState<{ open: boolean; moduleIndex: number; topicIndex: number }>({
    open: false,
    moduleIndex: -1,
    topicIndex: -1,
  })
  const [uploadData, setUploadData] = useState({
    files: [] as File[],
    links: [""],
    notes: "",
  })
  const [addTopicDialog, setAddTopicDialog] = useState<{ open: boolean; moduleIndex: number }>({
    open: false,
    moduleIndex: -1,
  })
  const [addModuleDialog, setAddModuleDialog] = useState<{ open: boolean }>({
    open: false,
  })
  const [newTopicData, setNewTopicData] = useState({
    moduleName: "",
    topics: "",
  })
  const [newModuleData, setNewModuleData] = useState({
    moduleName: "",
    moduleNumber: "",
    topics: "",
  })
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({})
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({})
  const [isExporting, setIsExporting] = useState(false)
  const [editingTopic, setEditingTopic] = useState<{ moduleIndex: number; topicIndex: number; value: string } | null>(
    null,
  )
  const [copiedLinks, setCopiedLinks] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const { toast } = useToast()

  useEffect(() => {
    // Load course data
    const savedCourseData = localStorage.getItem(`course_${courseId}`)
    const savedProgress = localStorage.getItem(`progress_${courseId}`)

    if (savedCourseData) {
      try {
        const courseData: any = JSON.parse(savedCourseData)

        // Validate basic structure
        if (!courseData || !courseData.course_name || !Array.isArray(courseData.modules)) {
          console.error("Invalid course data structure")
          router.push("/dashboard")
          return
        }

        // Initialize topics with progress data if available
        let progressData = null
        if (savedProgress) {
          try {
            progressData = JSON.parse(savedProgress)
          } catch (e) {
            console.warn("Invalid progress data, starting fresh")
          }
        }

        // Ensure modules have proper structure
        courseData.modules = courseData.modules.map((module: any, moduleIndex: number) => {
          if (!module || typeof module !== "object") {
            return {
              module_number: moduleIndex + 1,
              module_name: `Module ${moduleIndex + 1}`,
              topics: [],
              completed: false,
            }
          }

          // Ensure topics is an array
          let topics = []
          if (Array.isArray(module.topics)) {
            topics = module.topics.map((topicName: any, topicIndex: number) => {
              const savedTopic = progressData?.modules?.[moduleIndex]?.topics?.[topicIndex]
              return {
                name: typeof topicName === "string" ? topicName : topicName?.name || `Topic ${topicIndex + 1}`,
                completed: savedTopic?.completed || false,
                materials: Array.isArray(savedTopic?.materials) ? savedTopic.materials : [],
                notes: savedTopic?.notes || "",
              }
            })
          }

          return {
            module_number: module.module_number || moduleIndex + 1,
            module_name: module.module_name || `Module ${moduleIndex + 1}`,
            topics: topics,
            completed: false,
          }
        })

        setCourseData(courseData)

        // Initialize all modules as expanded
        const initialExpandedState: Record<number, boolean> = {}
        courseData.modules.forEach((_, index) => {
          initialExpandedState[index] = true
        })
        setExpandedModules(initialExpandedState)
      } catch (error) {
        console.error("Error loading course data:", error)
        router.push("/dashboard")
      }
    } else {
      console.error("No course data found")
      router.push("/dashboard")
    }
  }, [courseId, router])

  const saveProgress = (updatedCourseData: CourseData) => {
    localStorage.setItem(`progress_${courseId}`, JSON.stringify(updatedCourseData))

    // Update course completion in main courses list
    const courses = JSON.parse(localStorage.getItem("courses") || "[]")
    const updatedCourses = courses.map((course: any) => {
      if (course.id.toString() === courseId) {
        const totalTopics = updatedCourseData.modules.reduce((total, module) => total + module.topics.length, 0)
        const completedTopics = updatedCourseData.modules.reduce(
          (total, module) => total + module.topics.filter((topic) => topic.completed).length,
          0,
        )

        return {
          ...course,
          completedTopics,
          totalTopics,
        }
      }
      return course
    })
    localStorage.setItem("courses", JSON.stringify(updatedCourses))
  }

  const toggleModuleExpansion = (moduleIndex: number) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleIndex]: !prev[moduleIndex],
    }))
  }

  const toggleTopicExpansion = (moduleIndex: number, topicIndex: number) => {
    const topicKey = `${moduleIndex}-${topicIndex}`
    setExpandedTopics((prev) => ({
      ...prev,
      [topicKey]: !prev[topicKey],
    }))
  }

  const isTopicExpanded = (moduleIndex: number, topicIndex: number) => {
    const topicKey = `${moduleIndex}-${topicIndex}`
    return !!expandedTopics[topicKey]
  }

  const toggleModuleCompletion = (moduleIndex: number, isCompleted: boolean) => {
    if (!courseData) return

    const updatedCourseData = { ...courseData }

    // Update all topics in the module
    updatedCourseData.modules[moduleIndex].topics = updatedCourseData.modules[moduleIndex].topics.map((topic) => ({
      ...topic,
      completed: isCompleted,
    }))

    // Update module completion status
    updatedCourseData.modules[moduleIndex].completed = isCompleted

    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)
  }

  const toggleTopicCompletion = (moduleIndex: number, topicIndex: number) => {
    if (
      !courseData ||
      !courseData.modules ||
      !courseData.modules[moduleIndex] ||
      !courseData.modules[moduleIndex].topics ||
      !courseData.modules[moduleIndex].topics[topicIndex]
    ) {
      console.error("Invalid module or topic index")
      return
    }

    const updatedCourseData = { ...courseData }
    updatedCourseData.modules[moduleIndex].topics[topicIndex].completed =
      !updatedCourseData.modules[moduleIndex].topics[topicIndex].completed

    // Update module completion
    updatedCourseData.modules[moduleIndex].completed = updatedCourseData.modules[moduleIndex].topics.every(
      (topic) => topic.completed,
    )

    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)
  }

  const startEditingTopic = (moduleIndex: number, topicIndex: number, currentName: string) => {
    setEditingTopic({ moduleIndex, topicIndex, value: currentName })
  }

  const cancelEditingTopic = () => {
    setEditingTopic(null)
  }

  const saveEditedTopic = () => {
    if (!editingTopic || !courseData) return

    const { moduleIndex, topicIndex, value } = editingTopic
    if (!value.trim()) {
      alert("Topic name cannot be empty")
      return
    }

    const updatedCourseData = { ...courseData }
    updatedCourseData.modules[moduleIndex].topics[topicIndex].name = value.trim()

    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)

    // Also update the course structure in localStorage
    localStorage.setItem(`course_${courseId}`, JSON.stringify(updatedCourseData))

    setEditingTopic(null)
  }

  const removeTopic = (moduleIndex: number, topicIndex: number) => {
    if (!courseData) return

    if (courseData.modules[moduleIndex].topics.length <= 1) {
      alert("Cannot remove the last topic from a module")
      return
    }

    const updatedCourseData = { ...courseData }
    updatedCourseData.modules[moduleIndex].topics.splice(topicIndex, 1)

    // Update module completion status
    updatedCourseData.modules[moduleIndex].completed = updatedCourseData.modules[moduleIndex].topics.every(
      (topic) => topic.completed,
    )

    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)

    // Also update the course structure in localStorage
    localStorage.setItem(`course_${courseId}`, JSON.stringify(updatedCourseData))

    // Update the main course list
    const courses = JSON.parse(localStorage.getItem("courses") || "[]")
    const updatedCourses = courses.map((course: any) => {
      if (course.id.toString() === courseId) {
        return {
          ...course,
          totalTopics: course.totalTopics - 1,
        }
      }
      return course
    })
    localStorage.setItem("courses", JSON.stringify(updatedCourses))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files)
      setUploadData((prev) => ({
        ...prev,
        files: [...prev.files, ...filesArray],
      }))
    }
  }

  const removeSelectedFile = (index: number) => {
    setUploadData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }))
  }

  const addLinkField = () => {
    setUploadData((prev) => ({
      ...prev,
      links: [...prev.links, ""],
    }))
  }

  const updateLink = (index: number, value: string) => {
    setUploadData((prev) => {
      const updatedLinks = [...prev.links]
      updatedLinks[index] = value
      return {
        ...prev,
        links: updatedLinks,
      }
    })
  }

  const removeLink = (index: number) => {
    setUploadData((prev) => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }))
  }

  const handleUploadMaterial = () => {
    if (!courseData) return
    if (uploadData.files.length === 0 && !uploadData.links.some((link) => link.trim()) && !uploadData.notes.trim()) {
      alert("Please add at least one file, link, or note")
      return
    }

    const { moduleIndex, topicIndex } = uploadDialog
    const updatedCourseData = { ...courseData }
    const newMaterials: Material[] = []

    // Process files
    uploadData.files.forEach((file) => {
      newMaterials.push({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        name: file.name,
        type: "file",
        url: URL.createObjectURL(file),
        uploadDate: new Date().toISOString(),
      })
    })

    // Process links
    uploadData.links.forEach((link) => {
      if (link.trim()) {
        newMaterials.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          name: link,
          type: "link",
          url: link.startsWith("http") ? link : `https://${link}`,
          uploadDate: new Date().toISOString(),
        })
      }
    })

    // Add all materials to the topic
    updatedCourseData.modules[moduleIndex].topics[topicIndex].materials = [
      ...updatedCourseData.modules[moduleIndex].topics[topicIndex].materials,
      ...newMaterials,
    ]

    // Append notes if provided (instead of replacing)
    if (uploadData.notes.trim()) {
      const currentNotes = updatedCourseData.modules[moduleIndex].topics[topicIndex].notes
      const timestamp = new Date().toLocaleString()
      const newNote = `[${timestamp}] ${uploadData.notes.trim()}`

      updatedCourseData.modules[moduleIndex].topics[topicIndex].notes = currentNotes
        ? `${currentNotes}\n\n${newNote}`
        : newNote
    }

    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)

    // Auto-expand the topic when materials are added
    const topicKey = `${moduleIndex}-${topicIndex}`
    setExpandedTopics((prev) => ({
      ...prev,
      [topicKey]: true,
    }))

    setUploadDialog({ open: false, moduleIndex: -1, topicIndex: -1 })
    setUploadData({ files: [], links: [""], notes: "" })
  }

  const deleteMaterial = (moduleIndex: number, topicIndex: number, materialId: string) => {
    if (!courseData) return

    const updatedCourseData = { ...courseData }
    updatedCourseData.modules[moduleIndex].topics[topicIndex].materials = updatedCourseData.modules[moduleIndex].topics[
      topicIndex
    ].materials.filter((material) => material.id !== materialId)

    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)
  }

  const deleteNote = (moduleIndex: number, topicIndex: number) => {
    if (!courseData) return

    const updatedCourseData = { ...courseData }
    updatedCourseData.modules[moduleIndex].topics[topicIndex].notes = ""

    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)
  }

  const downloadMaterial = (material: Material) => {
    const a = document.createElement("a")
    a.href = material.url
    a.download = material.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const copyLink = (materialId: string, url: string) => {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopiedLinks({ ...copiedLinks, [materialId]: true })
        toast({
          title: "Link copied to clipboard",
          description: "The link has been copied to your clipboard.",
        })

        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setCopiedLinks((prev) => ({ ...prev, [materialId]: false }))
        }, 2000)
      },
      (err) => {
        console.error("Could not copy text: ", err)
        toast({
          title: "Failed to copy",
          description: "Please try again or copy manually.",
          variant: "destructive",
        })
      },
    )
  }

  const truncateFileName = (fileName: string, maxLength = 25) => {
    if (!fileName) return ""

    const lastDotIndex = fileName.lastIndexOf(".")
    if (lastDotIndex === -1) {
      // No extension
      return fileName.length > maxLength ? fileName.substring(0, maxLength) + "..." : fileName
    }

    const name = fileName.substring(0, lastDotIndex)
    const extension = fileName.substring(lastDotIndex)

    if (name.length <= maxLength) {
      return fileName
    }

    return name.substring(0, maxLength) + "..." + extension
  }

  // Function to convert notes to HTML for PDF generation
  const notesToHtml = (notes: string, topicName: string, moduleName: string) => {
    const escapedNotes = notes
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>")

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Notes: ${topicName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 40px;
            color: #333;
          }
          h1 {
            color: #2563eb;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 10px;
          }
          h2 {
            color: #4b5563;
            margin-top: 20px;
          }
          .timestamp {
            color: #6b7280;
            font-size: 0.9em;
            font-style: italic;
          }
          .note-entry {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px dashed #e5e7eb;
          }
          .note-content {
            margin-top: 5px;
          }
        </style>
      </head>
      <body>
        <h1>Study Notes</h1>
        <h2>Module: ${moduleName} - Topic: ${topicName}</h2>
        <div class="notes">
          ${escapedNotes}
        </div>
      </body>
      </html>
    `
  }

  const exportAllMaterials = async () => {
    if (!courseData) return

    setIsExporting(true)

    try {
      const zip = new JSZip()

      // Create a folder structure for the course
      const courseFolder = zip.folder(courseData.course_name)
      if (!courseFolder) throw new Error("Failed to create course folder")

      // Add course info file
      courseFolder.file(
        "course-info.txt",
        `Course: ${courseData.course_name}
Course Code: ${courseData.course_code}
Exported: ${new Date().toLocaleString()}
        
This archive contains all materials, links, and notes for your course.
        `,
      )

      // Create a links.txt file to store all links
      let linksText = "COURSE LINKS\n===========\n\n"

      // Process each module
      for (const module of courseData.modules) {
        const moduleFolder = courseFolder.folder(`Module ${module.module_number} - ${module.module_name}`)
        if (!moduleFolder) continue

        // Process each topic
        for (const topic of module.topics) {
          const topicFolder = moduleFolder.folder(topic.name)
          if (!topicFolder) continue

          // Add notes as HTML for PDF conversion
          if (topic.notes) {
            const notesHtml = notesToHtml(topic.notes, topic.name, module.module_name)
            topicFolder.file("notes.html", notesHtml)
          }

          // Process materials
          for (const material of topic.materials) {
            if (material.type === "link") {
              // Add to links.txt
              linksText += `[${module.module_name} > ${topic.name}] ${material.name}: ${material.url}\n`
            } else if (material.type === "file") {
              try {
                // Fetch the file content
                const response = await fetch(material.url)
                const blob = await response.blob()
                topicFolder.file(material.name, blob)
              } catch (error) {
                console.error(`Failed to add file ${material.name}:`, error)
              }
            }
          }
        }
      }

      // Add the links file
      courseFolder.file("all-links.txt", linksText)

      // Generate the zip
      const content = await zip.generateAsync({ type: "blob" })

      // Create a download link and trigger the download
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `${courseData.course_name} - Materials.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Export successful",
        description: "All materials have been exported successfully.",
      })
    } catch (error) {
      console.error("Error exporting materials:", error)
      toast({
        title: "Export failed",
        description: "Failed to export materials. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const resetProgress = () => {
    if (!courseData) return

    const resetCourseData = { ...courseData }
    resetCourseData.modules = resetCourseData.modules.map((module) => ({
      ...module,
      topics: module.topics.map((topic) => ({
        ...topic,
        completed: false,
      })),
      completed: false,
    }))

    setCourseData(resetCourseData)
    saveProgress(resetCourseData)
  }

  const calculateProgress = () => {
    if (!courseData || !Array.isArray(courseData.modules)) return 0

    const totalTopics = courseData.modules.reduce((total, module) => {
      if (!module || !Array.isArray(module.topics)) return total
      return total + module.topics.length
    }, 0)

    const completedTopics = courseData.modules.reduce((total, module) => {
      if (!module || !Array.isArray(module.topics)) return total
      return total + module.topics.filter((topic) => topic && topic.completed).length
    }, 0)

    return totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0
  }

  const handleAddTopics = () => {
    if (!courseData || !newTopicData.topics.trim()) return

    const updatedCourseData = { ...courseData }
    const moduleIndex = addTopicDialog.moduleIndex

    // Parse topics from the input
    const topicsText = newTopicData.topics.trim()
    let newTopics: string[] = []

    // Split by commas or hyphens
    if (topicsText.includes(",")) {
      newTopics = topicsText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t)
    } else if (topicsText.includes("-")) {
      newTopics = topicsText
        .split("-")
        .map((t) => t.trim())
        .filter((t) => t)
    } else {
      newTopics = [topicsText]
    }

    // Add new topics to the module
    const topicsToAdd = newTopics.map((name) => ({
      name,
      completed: false,
      materials: [],
      notes: "",
    }))

    updatedCourseData.modules[moduleIndex].topics = [...updatedCourseData.modules[moduleIndex].topics, ...topicsToAdd]

    // Update the course data in localStorage
    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)
    localStorage.setItem(`course_${courseId}`, JSON.stringify(updatedCourseData))

    // Update the main course list
    const courses = JSON.parse(localStorage.getItem("courses") || "[]")
    const updatedCourses = courses.map((course: any) => {
      if (course.id.toString() === courseId) {
        return {
          ...course,
          totalTopics: course.totalTopics + topicsToAdd.length,
        }
      }
      return course
    })
    localStorage.setItem("courses", JSON.stringify(updatedCourses))

    // Close the dialog and reset form
    setAddTopicDialog({ open: false, moduleIndex: -1 })
    setNewTopicData({ moduleName: "", topics: "" })
  }

  const handleAddModule = () => {
    if (!courseData || !newModuleData.moduleName.trim() || !newModuleData.topics.trim()) return

    const updatedCourseData = { ...courseData }

    // Parse topics from the input
    const topicsText = newModuleData.topics.trim()
    let newTopics: string[] = []

    // Split by commas or hyphens
    if (topicsText.includes(",")) {
      newTopics = topicsText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t)
    } else if (topicsText.includes("-")) {
      newTopics = topicsText
        .split("-")
        .map((t) => t.trim())
        .filter((t) => t)
    } else {
      newTopics = [topicsText]
    }

    // Create topics objects
    const topics = newTopics.map((name) => ({
      name,
      completed: false,
      materials: [],
      notes: "",
    }))

    // Create new module
    const moduleNumber = newModuleData.moduleNumber
      ? Number.parseInt(newModuleData.moduleNumber)
      : updatedCourseData.modules.length > 0
        ? Math.max(...updatedCourseData.modules.map((m) => m.module_number)) + 1
        : 1

    const newModule: Module = {
      module_number: moduleNumber,
      module_name: newModuleData.moduleName,
      topics: topics,
      completed: false,
    }

    // Add new module to course data
    updatedCourseData.modules.push(newModule)

    // Sort modules by module_number
    updatedCourseData.modules.sort((a, b) => a.module_number - b.module_number)

    // Update the course data in localStorage
    setCourseData(updatedCourseData)
    saveProgress(updatedCourseData)
    localStorage.setItem(`course_${courseId}`, JSON.stringify(updatedCourseData))

    // Update the main course list
    const courses = JSON.parse(localStorage.getItem("courses") || "[]")
    const updatedCourses = courses.map((course: any) => {
      if (course.id.toString() === courseId) {
        return {
          ...course,
          moduleCount: updatedCourseData.modules.length,
          totalTopics: updatedCourseData.modules.reduce((total, module) => total + module.topics.length, 0),
        }
      }
      return course
    })
    localStorage.setItem("courses", JSON.stringify(updatedCourses))

    // Update expanded modules state
    setExpandedModules((prev) => ({
      ...prev,
      [updatedCourseData.modules.length - 1]: true,
    }))

    // Close the dialog and reset form
    setAddModuleDialog({ open: false })
    setNewModuleData({ moduleName: "", moduleNumber: "", topics: "" })
  }

  if (!courseData) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{courseData.course_name}</h1>
              <Badge variant="secondary" className="mt-2">
                {courseData.course_code}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportAllMaterials} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    Export All Materials
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetProgress}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Progress
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(calculateProgress())}%</span>
            </div>
            <Progress value={calculateProgress()} className="w-full" />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 3D Visualization */}
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle>Course Structure Visualization</CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] p-0">
              <ThreeVisualization courseData={courseData} />
            </CardContent>
          </Card>

          {/* Interactive Checklist */}
          <Card className="h-[600px]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Study Checklist</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddModuleDialog({ open: true })}>
                <Plus className="h-3 w-3 mr-1" />
                Add Module
              </Button>
            </CardHeader>
            <CardContent className="h-[500px] overflow-y-auto">
              <div className="space-y-4">
                {courseData.modules.map((module, moduleIndex) => (
                  <div key={moduleIndex} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-6 w-6 mr-2"
                          onClick={() => toggleModuleExpansion(moduleIndex)}
                        >
                          {expandedModules[moduleIndex] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <Checkbox
                          checked={module.completed}
                          onCheckedChange={(checked) => toggleModuleCompletion(moduleIndex, !!checked)}
                          className="mr-2"
                        />
                        <h3 className="font-semibold">
                          Module {module.module_number}: {module.module_name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={module.completed ? "default" : "secondary"}>
                          {module.topics.filter((topic) => topic.completed).length}/{module.topics.length}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAddTopicDialog({ open: true, moduleIndex })}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Topics
                        </Button>
                      </div>
                    </div>

                    {expandedModules[moduleIndex] && (
                      <div className="space-y-3 pl-6 mt-2">
                        {module.topics.map((topic, topicIndex) => (
                          <div key={topicIndex} className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={topic.completed}
                                onCheckedChange={() => toggleTopicCompletion(moduleIndex, topicIndex)}
                              />

                              {editingTopic &&
                              editingTopic.moduleIndex === moduleIndex &&
                              editingTopic.topicIndex === topicIndex ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <Input
                                    value={editingTopic.value}
                                    onChange={(e) =>
                                      setEditingTopic({
                                        ...editingTopic,
                                        value: e.target.value,
                                      })
                                    }
                                    className="h-8"
                                    autoFocus
                                  />
                                  <Button size="sm" variant="ghost" onClick={saveEditedTopic} className="h-8 w-8 p-0">
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEditingTopic}
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1 flex items-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="p-0 h-6 w-6 mr-1"
                                      onClick={() => toggleTopicExpansion(moduleIndex, topicIndex)}
                                      disabled={topic.materials.length === 0 && !topic.notes}
                                    >
                                      {topic.materials.length > 0 || topic.notes ? (
                                        isTopicExpanded(moduleIndex, topicIndex) ? (
                                          <ChevronDown className="h-3 w-3" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3" />
                                        )
                                      ) : null}
                                    </Button>
                                    <span className={`${topic.completed ? "line-through text-muted-foreground" : ""}`}>
                                      {topic.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEditingTopic(moduleIndex, topicIndex, topic.name)}
                                      className="h-7 w-7 p-0"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeTopic(moduleIndex, topicIndex)}
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setUploadDialog({ open: true, moduleIndex, topicIndex })}
                                      className="h-7"
                                    >
                                      <Upload className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Materials and Notes (only shown when expanded) */}
                            {isTopicExpanded(moduleIndex, topicIndex) &&
                              (topic.materials.length > 0 || topic.notes) && (
                                <div className="ml-8 space-y-2 border-l-2 border-border pl-3 py-1">
                                  {/* Materials */}
                                  {topic.materials.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground">Materials:</p>
                                      {topic.materials.map((material) => (
                                        <div
                                          key={material.id}
                                          className="flex items-center justify-between bg-secondary/30 p-2 rounded text-sm"
                                        >
                                          <div className="flex items-center space-x-2">
                                            {material.type === "file" ? (
                                              <FileText className="h-4 w-4 text-blue-400" />
                                            ) : (
                                              <LinkIcon className="h-4 w-4 text-green-400" />
                                            )}
                                            <span className="truncate" title={material.name}>
                                              {material.type === "file"
                                                ? truncateFileName(material.name, 25)
                                                : material.name.length > 25
                                                  ? material.name.substring(0, 25) + "..."
                                                  : material.name}
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-1">
                                            <Button size="sm" variant="ghost" asChild>
                                              <a href={material.url} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-3 w-3" />
                                              </a>
                                            </Button>
                                            {material.type === "file" ? (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => downloadMaterial(material)}
                                              >
                                                <Download className="h-3 w-3" />
                                              </Button>
                                            ) : (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => copyLink(material.id, material.url)}
                                              >
                                                {copiedLinks[material.id] ? (
                                                  <CheckIcon className="h-3 w-3 text-green-500" />
                                                ) : (
                                                  <Copy className="h-3 w-3" />
                                                )}
                                              </Button>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => deleteMaterial(moduleIndex, topicIndex, material.id)}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Notes */}
                                  {topic.notes && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center space-x-1">
                                          <StickyNote className="h-3 w-3" />
                                          <span className="font-medium">Notes:</span>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => deleteNote(moduleIndex, topicIndex)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <p className="text-muted-foreground whitespace-pre-line">{topic.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Material Dialog */}
        <Dialog open={uploadDialog.open} onOpenChange={(open) => setUploadDialog({ ...uploadDialog, open })}>
          <DialogContent className="max-w-md bg-background border-border">
            <DialogHeader>
              <DialogTitle>Upload Study Material</DialogTitle>
              <DialogDescription>Add files, links, or notes for this topic</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="file" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="file">Upload Files</TabsTrigger>
                <TabsTrigger value="link">Add Links</TabsTrigger>
                <TabsTrigger value="notes">Add Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Files</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.pptx,.txt,.jpg,.png"
                      onChange={handleFileChange}
                      multiple
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Files
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">PDF, DOCX, PPTX, TXT, JPG, PNG files accepted</p>
                  </div>
                </div>

                {uploadData.files.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Files ({uploadData.files.length})</Label>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {uploadData.files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-secondary/30 p-2 rounded text-sm"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="h-4 w-4 flex-shrink-0 text-blue-400" />
                            <span className="truncate" title={file.name}>
                              {truncateFileName(file.name, 25)}
                            </span>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removeSelectedFile(index)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="link" className="space-y-4">
                <div className="space-y-2">
                  <Label>Study Links</Label>
                  {uploadData.links.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        placeholder="https://example.com/study-resource"
                        value={link}
                        onChange={(e) => updateLink(index, e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLink(index)}
                        disabled={uploadData.links.length === 1 && index === 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addLinkField} className="w-full mt-2">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Another Link
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <div className="space-y-2">
                  <Label>Study Notes</Label>
                  <Textarea
                    placeholder="Add important notes about this topic..."
                    value={uploadData.notes}
                    onChange={(e) => setUploadData({ ...uploadData, notes: e.target.value })}
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Notes will be timestamped and appended to any existing notes for this topic.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setUploadDialog({ ...uploadDialog, open: false })}>
                Cancel
              </Button>
              <Button onClick={handleUploadMaterial}>Add Material</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Topics Dialog */}
        <Dialog open={addTopicDialog.open} onOpenChange={(open) => setAddTopicDialog({ ...addTopicDialog, open })}>
          <DialogContent className="bg-background border-border">
            <DialogHeader>
              <DialogTitle>Add New Topics</DialogTitle>
              <DialogDescription>
                Add new topics to {courseData.modules[addTopicDialog.moduleIndex]?.module_name || "this module"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Topics (separated by comma or hyphen)</Label>
                <Textarea
                  placeholder="Topic 1, Topic 2, Topic 3"
                  value={newTopicData.topics}
                  onChange={(e) => setNewTopicData({ ...newTopicData, topics: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Example: "Variables, Functions, Loops" or "Variables - Functions - Loops"
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setAddTopicDialog({ ...addTopicDialog, open: false })}>
                Cancel
              </Button>
              <Button onClick={handleAddTopics}>
                <Save className="h-4 w-4 mr-2" />
                Save Topics
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Module Dialog */}
        <Dialog open={addModuleDialog.open} onOpenChange={(open) => setAddModuleDialog({ ...addModuleDialog, open })}>
          <DialogContent className="bg-background border-border">
            <DialogHeader>
              <DialogTitle>Add New Module</DialogTitle>
              <DialogDescription>Create a new module with topics for {courseData.course_name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Module Name</Label>
                  <Input
                    placeholder="e.g., Database Design"
                    value={newModuleData.moduleName}
                    onChange={(e) => setNewModuleData({ ...newModuleData, moduleName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Module Number (optional)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5"
                    value={newModuleData.moduleNumber}
                    onChange={(e) => setNewModuleData({ ...newModuleData, moduleNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Topics (separated by comma or hyphen)</Label>
                <Textarea
                  placeholder="Topic 1, Topic 2, Topic 3"
                  value={newModuleData.topics}
                  onChange={(e) => setNewModuleData({ ...newModuleData, topics: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Example: "Database Normalization, ER Diagrams, SQL Queries"
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setAddModuleDialog({ open: false })}>
                Cancel
              </Button>
              <Button onClick={handleAddModule}>
                <Save className="h-4 w-4 mr-2" />
                Save Module
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
