export type CloudProviderType = "GCP" | "AWS" | "Azure";

export interface GenerateProposalsRequest {
  requirements: string;
  budget: number | null;
  isIncludeLoggingAndMonitoring: boolean;
  cloudProvider: CloudProviderType;
}

const MAX_REQUIREMENTS_LENGTH = 4000;

const promptContext = `
    I would like to design a system architecture using {CLOUD_PROVIDER} services.
    The mermaid output should start with the diagram type,
    and DO NOT APPLY any style or STYLE keyword to cloud service objects.

    Mermaid and terraform has to be in English.
    DO NOT use any Special characters in the Mermaid output.

    Title, description, and running cost should be in English.
    Also, give terraform code that would be deployable to {CLOUD_PROVIDER}, and estimate the running cost with a number in USD.

    For the output, I would like 3 proposed Mermaid diagrams.

    Order the proposals based on the best fit for the requirements.

    Here are the system requirements.

    \n
`;

/** Validates and normalizes the raw callable-function payload. */
export function validateRequest(data: unknown): GenerateProposalsRequest {
  const body = data as Partial<GenerateProposalsRequest> | null;

  if (!body || typeof body.requirements !== "string" || !body.requirements.trim()) {
    throw new Error("requirements is required");
  }
  if (body.requirements.length > MAX_REQUIREMENTS_LENGTH) {
    throw new Error(`requirements must be under ${MAX_REQUIREMENTS_LENGTH} characters`);
  }
  if (!["GCP", "AWS", "Azure"].includes(body.cloudProvider as string)) {
    throw new Error("cloudProvider must be one of GCP, AWS, Azure");
  }
  if (body.budget != null && typeof body.budget !== "number") {
    throw new Error("budget must be a number or null");
  }

  return {
    requirements: body.requirements,
    budget: body.budget ?? null,
    isIncludeLoggingAndMonitoring: Boolean(body.isIncludeLoggingAndMonitoring),
    cloudProvider: body.cloudProvider as CloudProviderType,
  };
}

export function buildPrompt(req: GenerateProposalsRequest): string {
  let prompt = promptContext.replace(/{CLOUD_PROVIDER}/g, req.cloudProvider) + req.requirements;

  if (req.budget != null) {
    prompt += `\n This is the monthly budget in USD: ${req.budget}`;
  }

  const monitoringPhrase =
    req.cloudProvider === "GCP"
      ? "Cloud Monitoring and Cloud Logging services"
      : req.cloudProvider === "AWS"
      ? "AWS CloudWatch for monitoring and logging services"
      : "Azure Monitor and Azure Log Analytics services";

  prompt += req.isIncludeLoggingAndMonitoring
    ? `\n Please include ${monitoringPhrase}.`
    : `\n Please do not include ${monitoringPhrase}.`;

  return prompt;
}
