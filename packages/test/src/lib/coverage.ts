import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import { createRequire } from 'node:module'

let require = createRequire(import.meta.url)
let V8ToIstanbul = require('v8-to-istanbul') as any
let { createCoverageMap } = require('istanbul-lib-coverage') as typeof import('istanbul-lib-coverage')
let { createContext } = require('istanbul-lib-report') as typeof import('istanbul-lib-report')
let reports = require('istanbul-reports') as typeof import('istanbul-reports')

export interface V8CoverageEntry {
  url: string
  source?: string
  functions: Array<{
    functionName: string
    isBlockCoverage: boolean
    ranges: Array<{ startOffset: number; endOffset: number; count: number }>
  }>
}

export async function generateBrowserCoverageReport(
  entries: V8CoverageEntry[],
  baseUrl: string,
  cwd: string,
  outDir: string,
  testFileUrls: Set<string>,
) {
  let coverageMap = createCoverageMap({})
  let testUrlPrefix = `${baseUrl}/scripts/@test/`
  let converted = 0

  for (let entry of entries) {
    if (!entry.url.startsWith(testUrlPrefix) || !entry.source) continue

    let relativePath = decodeURIComponent(entry.url.slice(testUrlPrefix.length))
    // Strip query strings (e.g. ?t=...)
    let queryIndex = relativePath.indexOf('?')
    if (queryIndex !== -1) relativePath = relativePath.slice(0, queryIndex)

    let scriptPath = `/scripts/@test/${relativePath}`
    if (testFileUrls.has(scriptPath)) continue

    let filePath = path.join(cwd, relativePath)

    try {
      let converter = new V8ToIstanbul(filePath, 0, { source: entry.source })
      await converter.load()
      converter.applyCoverage(entry.functions)
      coverageMap.merge(converter.toIstanbul())
      converted++
    } catch {
      // Skip files that can't be converted (e.g. framework internals bundled in)
    }
  }

  if (converted === 0) {
    console.log('No coverage data collected.')
    return
  }

  await fsp.mkdir(outDir, { recursive: true })

  let ctx = createContext({ coverageMap, dir: outDir, watermarks: undefined } as any)

  console.log('\nCoverage report:')
  reports.create('text').execute(ctx)
  reports.create('lcovonly').execute(ctx)

  console.log(`\nLCOV coverage written to ${path.relative(cwd, path.join(outDir, 'lcov.info'))}`)
}
