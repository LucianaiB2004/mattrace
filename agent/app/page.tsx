import type { Metadata } from "next";
import MatTraceDashboard from "./MatTraceDashboard";

export const metadata: Metadata = {
  title: "MatTrace｜材料文献数据提取与核验 Agent",
  description:
    "让每一条材料数据都有出处、有条件、可复查。",
};

export default function Home() {
  return <MatTraceDashboard />;
}
