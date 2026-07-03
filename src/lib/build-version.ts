import { generatedBuildVersion } from "@/lib/generated-build-version";

function safeBuildVersion(value: string) {
  return value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 64) || "dev";
}

export const buildVersion = safeBuildVersion(
  process.env.NEXT_PUBLIC_BUILD_VERSION ||
    process.env.BUILD_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    generatedBuildVersion,
);

export const displayBuildVersion = buildVersion.length > 12 ? buildVersion.slice(0, 12) : buildVersion;
