"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Save, Trash2, ChevronDown, ChevronRight, HelpCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Module {
  id: string
  name: string
  topicsText: string
}

interface CourseData {
  course_name: string
  course_code: string
  modules: {
    module_number: number
    module_name: string
    topics: string[]
    completed: boolean
  }[]
}

export default function AddCourse() {
  const [courseName, setCourseName] = useState("")
  const [courseCode, setCourseCode] = useState("")
  const [modules, setModules] = useState<Module[]>([
    {
      id: "module-" + Date.now(),
      name: "",
      topicsText: "",
    },
  ])
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({ ["module-" + Date.now()]: true })
  const router = useRouter()

  const toggleModuleExpansion = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }))
  }

  const addModule = () => {
    const newModuleId = "module-" + Date.now()
    setModules([
      ...modules,
      {
        id: newModuleId,
        name: "",
        topicsText: "",
      },
    ])
    setExpandedModules((prev) => ({
      ...prev,
      [newModuleId]: true,
    }))
  }

  const removeModule = (moduleId: string) => {
    if (modules.length === 1) {
      alert("You need at least one module")
      return
    }
    setModules(modules.filter((module) => module.id !== moduleId))
  }

  const updateModuleName = (moduleId: string, name: string) => {
    setModules(modules.map((module) => (module.id === moduleId ? { ...module, name } : module)))
  }

  const updateTopicsText = (moduleId: string, topicsText: string) => {
    setModules(modules.map((module) => (module.id === moduleId ? { ...module, topicsText } : module)))
  }

  // Parse topics from text (split by hyphens or commas)
  const parseTopics = (text: string): string[] => {
    if (!text.trim()) return []

    // First check if there are hyphens
    if (text.includes("-")) {
      return text
        .split("-")
        .map((topic) => topic.trim())
        .filter((topic) => topic.length > 0)
    }

    // If no hyphens, try commas
    if (text.includes(",")) {
      return text
        .split(",")
        .map((topic) => topic.trim())
        .filter((topic) => topic.length > 0)
    }

    // If no separators, treat as a single topic
    return [text.trim()]
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!courseName.trim()) {
      alert("Course name is required")
      return
    }

    // Validate that all modules have names and topics
    for (const module of modules) {
      if (!module.name.trim()) {
        alert("All modules must have names")
        return
      }

      const parsedTopics = parseTopics(module.topicsText)
      if (parsedTopics.length === 0) {
        alert(`Module "${module.name}" must have at least one topic`)
        return
      }
    }

    // Format the data for saving
    const formattedCourseData: CourseData = {
      course_name: courseName,
      course_code: courseCode,
      modules: modules.map((module, index) => ({
        module_number: index + 1,
        module_name: module.name,
        topics: parseTopics(module.topicsText),
        completed: false,
      })),
    }

    // Calculate total topics
    const totalTopics = formattedCourseData.modules.reduce((total, module) => total + module.topics.length, 0)

    // Create the course object for the dashboard
    const newCourse = {
      id: Date.now(),
      name: courseName,
      code: courseCode,
      createdAt: new Date().toISOString(),
      moduleCount: modules.length,
      completedTopics: 0,
      totalTopics: totalTopics,
    }

    // Save to localStorage
    const existingCourses = JSON.parse(localStorage.getItem("courses") || "[]")
    const updatedCourses = [...existingCourses, newCourse]
    localStorage.setItem("courses", JSON.stringify(updatedCourses))

    // Save course data separately for detailed view
    localStorage.setItem(`course_${newCourse.id}`, JSON.stringify(formattedCourseData))

    router.push("/dashboard")
  }

  // Calculate total topics for display
  const calculateTotalTopics = () => {
    return modules.reduce((total, module) => {
      const topicsCount = parseTopics(module.topicsText).length
      return total + topicsCount
    }, 0)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Add New Course</h1>
        <p className="text-muted-foreground mt-2">Enter your course details to get started</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
              <CardDescription>Enter the basic information about your course</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="courseName">
                    Course Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="courseName"
                    placeholder="e.g., Software Engineering"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courseCode">
                    Course Code <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="courseCode"
                    placeholder="e.g., CSE301"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Modules & Topics</CardTitle>
                <CardDescription>Add modules and topics for your course</CardDescription>
              </div>
              <Button type="button" onClick={addModule} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Module
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {modules.map((module, moduleIndex) => (
                <div key={module.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6"
                        onClick={() => toggleModuleExpansion(module.id)}
                      >
                        {expandedModules[module.id] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <Label className="text-base font-medium">Module {moduleIndex + 1}</Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeModule(module.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`module-${module.id}-name`}>
                        Module Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`module-${module.id}-name`}
                        placeholder="e.g., Introduction to Programming"
                        value={module.name}
                        onChange={(e) => updateModuleName(module.id, e.target.value)}
                        required
                      />
                    </div>

                    {expandedModules[module.id] && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`module-${module.id}-topics`}>
                            Topics <span className="text-destructive">*</span>
                          </Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                                  <HelpCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Separate topics with hyphens (-) or commas (,)</p>
                                <p className="text-xs mt-1">Example: "Variables - Functions - Loops"</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Textarea
                          id={`module-${module.id}-topics`}
                          placeholder="Enter topics separated by hyphens (e.g., Variables - Functions - Loops)"
                          value={module.topicsText}
                          onChange={(e) => updateTopicsText(module.id, e.target.value)}
                          required
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          Topics can be separated by hyphens (-) or commas (,)
                        </p>

                        {module.topicsText && (
                          <div className="mt-2">
                            <Label className="text-sm">Preview:</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {parseTopics(module.topicsText).map((topic, index) => (
                                <div
                                  key={index}
                                  className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm"
                                >
                                  {topic}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <Alert>
                <AlertDescription>
                  Total: {calculateTotalTopics()} topics across {modules.length} modules
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              Save Course
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
