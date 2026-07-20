/**
 * GitHub REST helpers for the admin PDF import: dispatch the import-pdf
 * workflow and read a run back by its `pdf-import:<jobId>` run-name. The
 * workflow runs the real CLI pipeline (scripts/import-pdf.ts) in CI because
 * the extractor needs Python/PyMuPDF and minutes of Claude calls — neither
 * fits in a serverless function.
 */
import "server-only";
import { env } from "@/lib/env";

const WORKFLOW = "import-pdf.yml";

function config() {
  if (!env.GITHUB_IMPORT_TOKEN || !env.GITHUB_REPO) {
    throw new Error(
      "PDF import isn't configured on this server (GITHUB_IMPORT_TOKEN / GITHUB_REPO are unset).",
    );
  }
  return { token: env.GITHUB_IMPORT_TOKEN, repo: env.GITHUB_REPO };
}

async function ghFetch(path: string, init?: RequestInit): Promise<Response> {
  const { token } = config();
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res;
}

export type PdfImportInputs = {
  jobId: string;
  pdfUrl: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  authorAr?: string;
  authorEn?: string;
  level: number;
  genre: string;
  difficulty: number;
  blurb?: string;
  guidance?: string;
  forceOcr: boolean;
};

export async function dispatchPdfImport(input: PdfImportInputs): Promise<void> {
  const { repo } = config();
  await ghFetch(`/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: "main",
      inputs: {
        ...input,
        level: String(input.level),
        difficulty: String(input.difficulty),
        forceOcr: input.forceOcr ? "true" : "false",
      },
    }),
  });
}

export type ImportRun = {
  id: number;
  /** queued | in_progress | completed (+ waiting/requested/pending). */
  status: string;
  conclusion: string | null;
  htmlUrl: string;
};

/** Find the run for a job by its run-name. Null when the dispatch hasn't appeared yet. */
export async function findImportRun(jobId: string): Promise<ImportRun | null> {
  const { repo } = config();
  const res = await ghFetch(`/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=30`);
  const data = (await res.json()) as {
    workflow_runs: { id: number; name: string; status: string; conclusion: string | null; html_url: string }[];
  };
  const run = data.workflow_runs.find((r) => r.name === `pdf-import:${jobId}`);
  return run ? { id: run.id, status: run.status, conclusion: run.conclusion, htmlUrl: run.html_url } : null;
}

/** Plain-text log of the run's (single) job, or null when it hasn't started. */
export async function fetchRunLog(runId: number): Promise<string | null> {
  const { repo } = config();
  const res = await ghFetch(`/repos/${repo}/actions/runs/${runId}/jobs?per_page=1`);
  const data = (await res.json()) as { jobs: { id: number }[] };
  const jobId = data.jobs[0]?.id;
  if (!jobId) return null;
  // The job-logs endpoint 302s to a plain-text download; fetch follows.
  const logRes = await ghFetch(`/repos/${repo}/actions/jobs/${jobId}/logs`);
  return logRes.text();
}
