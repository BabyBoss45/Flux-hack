import { FloorplanUpload } from "@/components/floorplan/FloorplanUpload";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default function QuestionnairePage() {
  return (
    <>
      <FloorplanUpload />
      <ChatPanel
        title="Describe your goals for this space"
        placeholder="Tell me about how you use this home, who lives here, and the mood you want each space to have..."
      />
    </>
  );
}


