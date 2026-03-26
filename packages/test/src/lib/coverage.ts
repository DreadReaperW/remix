import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { colors } from './utils.ts'

let require = createRequire(import.meta.url)
let V8ToIstanbul = require('v8-to-istanbul') as any
let { createCoverageMap } =
  require('istanbul-lib-coverage') as typeof import('istanbul-lib-coverage')
let { createContext } = require('istanbul-lib-report') as typeof import('istanbul-lib-report')
let reports = require('istanbul-reports') as typeof import('istanbul-reports')

export interface CoverageConfig {
  dir: string
  include?: string[]
  exclude?: string[]
  lines?: number
  branches?: number
  functions?: number
}

export interface V8CoverageEntry {
  url: string
  source?: string
  functions: Array<{
    functionName: string
    isBlockCoverage: boolean
    ranges: Array<{ startOffset: number; endOffset: number; count: number }>
  }>
}

export type CoverageMap = ReturnType<typeof createCoverageMap>

function matchesGlobs(filePath: string, globs: string[]): boolean {
  return globs.some((glob) => path.matchesGlob(filePath, glob))
}

function filterCoverageMap(coverageMap: CoverageMap, cwd: string, config: CoverageConfig): CoverageMap {
  let filtered = createCoverageMap({})
  for (let filePath of coverageMap.files()) {
    // Browser coverage entries are keyed as /scripts/@test/<relative> (the dev server path),
    // not the real filesystem path, so path.relative would produce a ../../.. mess.
    let scriptTestPrefix = '/scripts/@test/'
    let idx = filePath.indexOf(scriptTestPrefix)
    let relative =
      idx >= 0 ? filePath.slice(idx + scriptTestPrefix.length) : path.relative(cwd, filePath)

    if (config.include && config.include.length > 0) {
      if (!matchesGlobs(relative, config.include)) continue
    }
    if (config.exclude && config.exclude.length > 0) {
      if (matchesGlobs(relative, config.exclude)) continue
    }
    let fc = coverageMap.fileCoverageFor(filePath) as any
    filtered.addFileCoverage({ ...fc.toJSON(), path: relative })
  }
  return filtered
}

function checkThresholds(coverageMap: CoverageMap, config: CoverageConfig): boolean {
  let { lines, branches, functions } = config
  if (lines === undefined && branches === undefined && functions === undefined) return true

  let summary = coverageMap.getCoverageSummary()
  let passed = true

  if (lines !== undefined) {
    let pct = summary.lines.pct
    if (pct < lines) {
      console.error(
        colors.red(`\nError: Coverage threshold not met (lines ${pct.toFixed(2)}% < ${lines}%)`),
      )
      passed = false
    }
  }
  if (branches !== undefined) {
    let pct = summary.branches.pct
    if (pct < branches) {
      console.error(
        colors.red(
          `\nError: Coverage threshold not met (branches ${pct.toFixed(2)}% < ${branches}%)`,
        ),
      )
      passed = false
    }
  }
  if (functions !== undefined) {
    let pct = summary.functions.pct
    if (pct < functions) {
      console.error(
        colors.red(
          `\nError: Coverage threshold not met (functions ${pct.toFixed(2)}% < ${functions}%)`,
        ),
      )
      passed = false
    }
  }

  return passed
}

async function writeIstanbulReports(coverageMap: CoverageMap, cwd: string, outDir: string) {
  await fsp.mkdir(outDir, { recursive: true })
  let ctx = createContext({ coverageMap, dir: outDir, watermarks: undefined } as any)
  console.log('\nCoverage report:')
  reports.create('text').execute(ctx)
  reports.create('lcovonly').execute(ctx)
  console.log(`\nLCOV coverage written to ${path.relative(cwd, path.join(outDir, 'lcov.info'))}`)
}

export async function collectServerCoverageMap(
  coverageDataDir: string,
  cwd: string,
  testFiles: Set<string>,
): Promise<CoverageMap | null> {
  let coverageMap = createCoverageMap({})
  let converted = 0

  let files: string[]
  try {
    files = (await fsp.readdir(coverageDataDir)).filter(
      (f) => f.startsWith('coverage-') && f.endsWith('.json'),
    )
  } catch {
    return null
  }

  for (let file of files) {
    let data = JSON.parse(await fsp.readFile(path.join(coverageDataDir, file), 'utf-8'))
    let scriptCoverages: Array<{ url: string; functions: any[] }> = data.result ?? []

    for (let entry of scriptCoverages) {
      if (!entry.url.startsWith('file://')) continue

      let filePath: string
      try {
        filePath = fileURLToPath(entry.url)
      } catch {
        continue
      }

      if (!filePath.startsWith(cwd + path.sep)) continue
      if (filePath.includes(`${path.sep}node_modules${path.sep}`)) continue
      if (testFiles.has(filePath)) continue

      try {
        let converter = new V8ToIstanbul(filePath)
        await converter.load()
        converter.applyCoverage(entry.functions)
        coverageMap.merge(converter.toIstanbul())
        converted++
      } catch {
        // Skip files that can't be converted
      }
    }
  }

  // Clean up raw V8 coverage JSON files now that we've processed them
  await Promise.all(files.map((f) => fsp.rm(path.join(coverageDataDir, f), { force: true })))

  return converted > 0 ? coverageMap : null
}

export async function collectBrowserCoverageMap(
  entries: V8CoverageEntry[],
  baseUrl: string,
  cwd: string,
  testFileUrls: Set<string>,
): Promise<CoverageMap | null> {
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

  return converted > 0 ? coverageMap : null
}

export async function generateCombinedCoverageReport(
  maps: (CoverageMap | null | undefined)[],
  cwd: string,
  config: CoverageConfig,
): Promise<boolean> {
  let combined = createCoverageMap({})
  for (let map of maps) {
    if (map) combined.merge(map)
  }

  if (combined.files().length === 0) {
    console.log('No coverage data collected.')
    return true
  }

  let filtered = filterCoverageMap(combined, cwd, config)
  await writeIstanbulReports(filtered, cwd, config.dir)
  return checkThresholds(filtered, config)
}
