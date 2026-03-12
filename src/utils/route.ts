function isPathParamSegment(segment: string): boolean {
    return /^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(segment);
}

function getPathParamName(segment: string): string {
    return segment.slice(1, -1);
}

export function matchRoutePath(templatePath: string, actualPath: string): Record<string, string> | null {
    const templateSegments = templatePath.split('/').filter((segment) => segment.length > 0);
    const actualSegments = actualPath.split('/').filter((segment) => segment.length > 0);

    if (templateSegments.length !== actualSegments.length) {
        return null;
    }

    const params: Record<string, string> = {};

    for (let index = 0; index < templateSegments.length; index += 1) {
        const templateSegment = templateSegments[index];
        const actualSegment = actualSegments[index];

        if (isPathParamSegment(templateSegment)) {
            params[getPathParamName(templateSegment)] = decodeURIComponent(actualSegment);
            continue;
        }

        if (templateSegment !== actualSegment) {
            return null;
        }
    }

    return params;
}
