import { CitationGraph } from "@/components/citation-graph";
import { buildGraph } from "@/lib/graph-data";

export const dynamic = "force-static";

export default function GraphPage() {
  const data = buildGraph();
  return <CitationGraph data={data} />;
}
