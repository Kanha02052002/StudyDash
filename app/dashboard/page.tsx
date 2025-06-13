"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { BookOpen, Plus, LogOut, Trash2, Calendar, User, Loader2, Archive } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import JSZip from "jszip"

interface Course {
  id: number
  name: string
  code: string
  createdAt: string
  moduleCount: number
  completedTopics: number
  totalTopics: number
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const userData = localStorage.getItem("currentUser")
    if (!userData) {
      router.push("/")
      return
    }

    setUser(JSON.parse(userData))

    // Load courses from localStorage
    const savedCourses = localStorage.getItem("courses")
    if (savedCourses) {
      setCourses(JSON.parse(savedCourses))
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("currentUser")
    router.push("/")
  }

  const handleDeleteCourse = (courseId: number) => {
    const updatedCourses = courses.filter((course) => course.id !== courseId)
    setCourses(updatedCourses)
    localStorage.setItem("courses", JSON.stringify(updatedCourses))
  }

  const handleAddCourse = () => {
    router.push("/add-course")
  }

  const handleViewCourse = (courseId: number) => {
    router.push(`/course/${courseId}`)
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
    if (courses.length === 0) {
      toast({
        title: "No courses to export",
        description: "Add some courses first before exporting.",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    try {
      const zip = new JSZip()
      const rootFolder = zip.folder("StudyDash Materials")
      if (!rootFolder) throw new Error("Failed to create root folder")

      // Add user info
      rootFolder.file(
        "user-info.txt",
        `User: ${user.username}
Email: ${user.email}
Exported: ${new Date().toLocaleString()}
        
This archive contains all materials, links, and notes for your courses.
        `,
      )

      // Process each course
      for (const course of courses) {
        const courseData = localStorage.getItem(`course_${course.id}`)
        const progressData = localStorage.getItem(`progress_${course.id}`)

        if (!courseData) continue

        const parsedCourseData = JSON.parse(courseData)
        const parsedProgressData = progressData ? JSON.parse(progressData) : null

        const courseFolder = rootFolder.folder(parsedCourseData.course_name)
        if (!courseFolder) continue

        // Add course info
        courseFolder.file(
          "course-info.txt",
          `Course: ${parsedCourseData.course_name}
Course Code: ${parsedCourseData.course_code}
Created: ${new Date(course.createdAt).toLocaleString()}
Progress: ${course.completedTopics}/${course.totalTopics} topics completed (${Math.round((course.completedTopics / course.totalTopics) * 100)}%)
          `,
        )

        // Create a links.txt file for this course
        let linksText = `LINKS FOR ${parsedCourseData.course_name.toUpperCase()}\n===========\n\n`

        // Process modules and topics if progress data exists
        if (parsedProgressData && parsedProgressData.modules) {
          for (const module of parsedProgressData.modules) {
            const moduleFolder = courseFolder.folder(`Module ${module.module_number} - ${module.module_name}`)
            if (!moduleFolder) continue

            // Process topics
            for (const topic of module.topics) {
              const topicFolder = moduleFolder.folder(topic.name)
              if (!topicFolder) continue

              // Add notes as HTML for PDF conversion
              if (topic.notes) {
                const notesHtml = notesToHtml(topic.notes, topic.name, module.module_name)
                topicFolder.file("notes.html", notesHtml)
              }

              // Process materials
              if (topic.materials && Array.isArray(topic.materials)) {
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
          }
        }

        // Add the links file to the course folder
        courseFolder.file("all-links.txt", linksText)
      }

      // Generate the zip
      const content = await zip.generateAsync({ type: "blob" })

      // Create a download link and trigger the download
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `StudyDash - All Materials.zip`
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

  const handleExportMaterials = () => {
    exportAllMaterials()
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-2xl font-bold text-foreground">StudyDash</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{user.username}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Button onClick={handleAddCourse} className="flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add New Course
          </Button>
          <Button variant="outline" onClick={handleExportMaterials} disabled={isExporting}>
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
        </div>

        {/* Courses Grid */}
        {courses.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No courses yet</h3>
              <p className="text-muted-foreground mb-4">Get started by adding your first course</p>
              <Button onClick={handleAddCourse}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Course
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1" onClick={() => handleViewCourse(course.id)}>
                      <CardTitle className="text-lg mb-1">{course.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="secondary">{course.code}</Badge>
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Course</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{course.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteCourse(course.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>

                <CardContent onClick={() => handleViewCourse(course.id)}>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Created: {new Date(course.createdAt).toLocaleDateString()}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{Math.round((course.completedTopics / course.totalTopics) * 100)}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(course.completedTopics / course.totalTopics) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {course.completedTopics} of {course.totalTopics} topics completed
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">{course.moduleCount} modules</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
