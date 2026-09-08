import { httpsCallable, FunctionsError } from "firebase/functions";
import { functions, ensureSignedIn } from "./firebase";
import { labelMaps } from "./mapSvg";
import { replaceCaseInsensitive } from "../utils/string";

export type CloudProviderType = 'GCP' | 'AWS' | 'Azure';

export interface DiagramProposalInterface {
  description: string;
  diagram: string;
  runningCost: string;
  terraform: string;
  title: string;
}

// Vertex credentials and the Gemini prompt now live server-side in the
// generateProposals Cloud Function (see functions/src/index.ts). The
// client never sees an API key — it only calls the callable function
// behind Firebase Auth + App Check + a per-user rate limit.
const generateProposalsCallable = httpsCallable<
  {
    requirements: string;
    budget: number | null;
    isIncludeLoggingAndMonitoring: boolean;
    cloudProvider: CloudProviderType;
  },
  { proposals: DiagramProposalInterface[] }
>(functions, "generateProposals");

const parseTerraform = (terraform: string) => {
  terraform = replaceCaseInsensitive(terraform, "```terraform\n", "");
  terraform = replaceCaseInsensitive(terraform, "```terraform", "");
  terraform = replaceCaseInsensitive(terraform, "```", "");
  return terraform;
};

const parseDiagram = (diagram: string) => {
  if (diagram.includes("```mermaid\n")) {
    diagram = diagram.split("```mermaid\n")[1];
  } else if (diagram.includes("```mermaid")) {
    diagram = diagram.split("```mermaid")[1];
  } else if (diagram.includes("flowchart")) {
    diagram = "flowchart" + diagram.split(/flowchart(.*)/s)[1];
  } else if (diagram.includes("sequenceDiagram")) {
    diagram = "sequenceDiagram" + diagram.split(/sequenceDiagram(.*)/s)[1];
  } else if (
    diagram.includes("graph LR") ||
    diagram.includes("graph RL") ||
    diagram.includes("graph BT") ||
    diagram.includes("graph TB")
  ) {
    diagram = "graph" + diagram.split(/graph(.*)/s)[1];
  }

  diagram = replaceCaseInsensitive(diagram, "```", "");

  for (const key of Object.keys(labelMaps)) {
    if (diagram.toLowerCase().includes(key.toLowerCase())) {
      diagram = replaceCaseInsensitive(
        diagram,
        key,
        labelMaps[key] + "\nXXXXXXXXXXXXXXXXXX\nXXXXXXXXXXXXXXXXXX"
      );
    }
  }
  return diagram;
};

export const parseProposals = (proposals: DiagramProposalInterface[]) => {
  return proposals.map((proposal: DiagramProposalInterface) => {
    return {
      ...proposal,
      terraform: parseTerraform(proposal.terraform),
      diagram: parseDiagram(proposal.diagram),
    };
  });
};

const askVertex = async ({
  requirements,
  budget,
  isIncludeLoggingAndMonitoring,
  cloudProvider,
}: // isUseMockData,
{
  requirements: string;
  budget: number | null;
  isIncludeLoggingAndMonitoring: boolean;
  cloudProvider: 'GCP' | 'AWS' | 'Azure';
  // isUseMockData?: boolean;
}): Promise<DiagramProposalInterface[]> => {
  await ensureSignedIn();

  try {
    const result = await generateProposalsCallable({
      requirements,
      budget,
      isIncludeLoggingAndMonitoring,
      cloudProvider,
    });

    return parseProposals(result.data.proposals);
  } catch (err) {
    if (err instanceof FunctionsError && err.code === "resource-exhausted") {
      throw new Error(err.message);
    }
    throw err;
  }
};

export default askVertex;
