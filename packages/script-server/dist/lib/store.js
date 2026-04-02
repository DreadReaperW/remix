export function createModuleStore() {
    let recordsByIdentityPath = new Map();
    let recordsByTrackedFile = new Map();
    return {
        get(identityPath) {
            let existing = recordsByIdentityPath.get(identityPath);
            if (existing)
                return existing;
            let record = {
                identityPath,
                lastInvalidatedAt: 0,
                trackedFiles: new Set(),
                trackedResolutions: [],
            };
            recordsByIdentityPath.set(identityPath, record);
            return record;
        },
        setTransformFailure(identityPath, failure) {
            let record = getOrCreateMutableRecord(identityPath);
            record.transformed = undefined;
            record.resolved = undefined;
            record.emitted = undefined;
            setTracking(record, {
                trackedFiles: failure.trackedFiles,
                trackedResolutions: [],
            });
        },
        setTransformed(identityPath, transformed) {
            let record = getOrCreateMutableRecord(identityPath);
            record.transformed = transformed;
            record.resolved = undefined;
            record.emitted = undefined;
            setTracking(record, {
                trackedFiles: transformed.trackedFiles,
                trackedResolutions: [],
            });
        },
        setResolved(identityPath, resolved) {
            let record = getOrCreateMutableRecord(identityPath);
            record.resolved = resolved;
            record.emitted = undefined;
            setTracking(record, {
                trackedFiles: resolved.trackedFiles,
                trackedResolutions: resolved.trackedResolutions,
            });
        },
        setResolveFailure(identityPath, failure) {
            let record = getOrCreateMutableRecord(identityPath);
            record.resolved = undefined;
            record.emitted = undefined;
            setTracking(record, {
                trackedFiles: failure.trackedFiles,
                trackedResolutions: failure.trackedResolutions,
            });
        },
        setEmitted(identityPath, emitted) {
            getOrCreateMutableRecord(identityPath).emitted = emitted;
        },
        invalidateForFileEvent(filePath, event) {
            let affected = new Set(recordsByTrackedFile.get(filePath) ?? []);
            if (event !== 'change') {
                for (let record of recordsByIdentityPath.values()) {
                    if (record.trackedResolutions.some((tracked) => mayAffectTrackedResolution(tracked, filePath))) {
                        affected.add(record.identityPath);
                    }
                }
            }
            for (let identityPath of affected) {
                let record = recordsByIdentityPath.get(identityPath);
                if (record)
                    invalidateRecord(record);
            }
        },
        invalidateAll() {
            for (let record of recordsByIdentityPath.values()) {
                invalidateRecord(record);
            }
        },
    };
    function getOrCreateMutableRecord(identityPath) {
        let existing = recordsByIdentityPath.get(identityPath);
        if (existing)
            return existing;
        let record = {
            identityPath,
            lastInvalidatedAt: 0,
            trackedFiles: new Set(),
            trackedResolutions: [],
        };
        recordsByIdentityPath.set(identityPath, record);
        return record;
    }
    function invalidateRecord(record) {
        removeIndexes(record);
        record.emitted = undefined;
        record.resolved = undefined;
        record.trackedFiles.clear();
        record.trackedResolutions = [];
        record.transformed = undefined;
        record.lastInvalidatedAt = Date.now();
    }
    function setTracking(record, tracking) {
        removeIndexes(record);
        record.trackedFiles = new Set(tracking.trackedFiles);
        record.trackedResolutions = [...tracking.trackedResolutions];
        for (let trackedFile of record.trackedFiles) {
            addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath);
        }
    }
    function removeIndexes(record) {
        for (let trackedFile of record.trackedFiles) {
            removeFromIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath);
        }
    }
}
function addToIndexedSet(map, key, value) {
    let existing = map.get(key) ?? new Set();
    existing.add(value);
    map.set(key, existing);
}
function removeFromIndexedSet(map, key, value) {
    let existing = map.get(key);
    if (!existing)
        return;
    existing.delete(value);
    if (existing.size === 0) {
        map.delete(key);
    }
}
function mayAffectTrackedResolution(trackedResolution, filePath) {
    return (trackedResolution.candidatePaths.includes(filePath) ||
        trackedResolution.candidatePrefixes.some((prefix) => filePath.startsWith(prefix)));
}
