// Enhanced PDF parser with more robust regex patterns

export interface ParsedModule {
  number: number
  name: string
  topics: string[]
}

export interface ParsedCourse {
  name: string
  code: string
  modules: ParsedModule[]
}

export function parsePdfContent(content: string): ParsedCourse {
  // Extract course name and code
  // Look for patterns like "BCSE302L Database Systems" or "Course Title: Database Systems"
  const courseCodeRegex = /([A-Z]{2,4}\d{3}[A-Z]?)/
  const courseNameRegex = /([A-Z]{2,4}\d{3}[A-Z]?)\s*[-:]?\s*([A-Za-z\s&]+?)(?:\s*L\s|\s*\(|\s*\d|\s*$)/
  const courseTitleRegex = /Course\s*Title\s*:?\s*([A-Za-z\s&]+)/i

  let courseName = "Unknown Course"
  let courseCode = "Unknown Code"

  // Try to extract course code
  const codeMatch = content.match(courseCodeRegex)
  if (codeMatch) {
    courseCode = codeMatch[1]
  }

  // Try to extract course name using different patterns
  const nameMatch = content.match(courseNameRegex)
  if (nameMatch && nameMatch[2]) {
    courseName = nameMatch[2].trim()
  } else {
    const titleMatch = content.match(courseTitleRegex)
    if (titleMatch) {
      courseName = titleMatch[1].trim()
    }
  }

  // Extract modules and topics
  const modules: ParsedModule[] = []

  // Look for module patterns
  // Pattern 1: "Module X: Module Name"
  // Pattern 2: "Module X - Module Name"
  // Pattern 3: "X. Module Name"
  const modulePatterns = [
    /Module\s*:?\s*(\d+)\s*[-:]\s*([^0-9\n]+)(?:\s*\d+\s*hours|\s*$$\d+\s*hours$$)?/gi,
    /Module\s*(\d+)\s*[-:]\s*([^0-9\n]+)(?:\s*\d+\s*hours|\s*$$\d+\s*hours$$)?/gi,
    /(\d+)\.\s*([A-Za-z\s&]+?)(?:\s*$$\d+\s*hours$$|\s*\d+\s*hours|\s*$)/gm,
  ]

  // Try each pattern until we find modules
  for (const pattern of modulePatterns) {
    let moduleMatch
    const tempModules: ParsedModule[] = []

    while ((moduleMatch = pattern.exec(content)) !== null) {
      const moduleNumber = Number.parseInt(moduleMatch[1])
      const moduleName = moduleMatch[2].trim()

      // Find the content of this module (text between this module and the next one)
      const moduleStartIndex = moduleMatch.index + moduleMatch[0].length
      const nextModuleMatch = content.indexOf(`Module ${moduleNumber + 1}`, moduleStartIndex)
      const moduleEndIndex = nextModuleMatch > -1 ? nextModuleMatch : content.indexOf("Text Book", moduleStartIndex)

      const moduleContent = content.substring(moduleStartIndex, moduleEndIndex > -1 ? moduleEndIndex : undefined)

      // Extract topics using various patterns
      const topics = extractTopics(moduleContent)

      tempModules.push({
        number: moduleNumber,
        name: moduleName,
        topics: topics.slice(0, 10), // Limit to 10 topics per module for readability
      })
    }

    if (tempModules.length > 0) {
      modules.push(...tempModules)
      break // Stop if we found modules with this pattern
    }
  }

  // If no modules were found, try a more generic approach
  if (modules.length === 0) {
    // Look for numbered sections that might be modules
    const sectionRegex = /(\d+)\.\s*([A-Za-z\s&]+)/g
    let sectionMatch

    while ((sectionMatch = sectionRegex.exec(content)) !== null) {
      const sectionNumber = Number.parseInt(sectionMatch[1])
      const sectionName = sectionMatch[2].trim()

      // Only consider this a module if the number is reasonable
      if (sectionNumber >= 1 && sectionNumber <= 15) {
        const sectionStartIndex = sectionMatch.index + sectionMatch[0].length
        const nextSectionMatch = content.indexOf(`${sectionNumber + 1}.`, sectionStartIndex)
        const sectionEndIndex = nextSectionMatch > -1 ? nextSectionMatch : undefined

        const sectionContent = content.substring(sectionStartIndex, sectionEndIndex)
        const topics = extractTopics(sectionContent)

        modules.push({
          number: sectionNumber,
          name: sectionName,
          topics: topics.slice(0, 10),
        })
      }
    }
  }

  // Sort modules by number
  modules.sort((a, b) => a.number - b.number)

  return {
    name: courseName,
    code: courseCode,
    modules,
  }
}

function extractTopics(text: string): string[] {
  const topics: string[] = []

  // Clean up the text
  const cleanText = text.replace(/\n/g, " ").replace(/\s+/g, " ")

  // Try different patterns to extract topics

  // Pattern 1: Bullet points or numbered lists
  const bulletPattern = /[•\-*]\s*([A-Za-z][^•\-*\n\d]+?)(?=[•\-*]|$)/g
  let bulletMatch

  while ((bulletMatch = bulletPattern.exec(cleanText)) !== null) {
    const topic = bulletMatch[1].trim()
    if (topic && topic.length > 3 && !topics.includes(topic)) {
      topics.push(topic)
    }
  }

  // Pattern 2: Comma-separated items
  if (topics.length < 3) {
    const commaItems = cleanText.split(/,|;/).map((item) => item.trim())
    for (const item of commaItems) {
      // Only consider items that look like topics (not too short, starts with a letter)
      if (item && item.length > 5 && /^[A-Za-z]/.test(item) && !topics.includes(item)) {
        topics.push(item)
      }
    }
  }

  // Pattern 3: Sentences that might be topics
  if (topics.length < 3) {
    const sentences = cleanText.split(/\.|\n/).map((s) => s.trim())
    for (const sentence of sentences) {
      // Only consider sentences that look like topics
      if (
        sentence &&
        sentence.length > 5 &&
        sentence.length < 100 &&
        /^[A-Za-z]/.test(sentence) &&
        !topics.includes(sentence)
      ) {
        topics.push(sentence)
      }
    }
  }

  return topics
}
